"""Search over the food database, for picking a food to log.

Runs on the Elasticsearch index (`food_index.py`) when one is configured: typo-tolerant,
as-you-type, across Romanian and English names. If the index isn't configured, isn't built
yet or doesn't answer, the same search runs on PostgreSQL instead, so the app keeps working.
"""

import logging
from typing import Any

from elasticsearch import ApiError, TransportError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.services.food_index import FoodIndex
from app.utils.naming import normalize_name

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 20

# Only foods with all four core values are returned — a food without calories or a macro
# cannot be logged meaningfully.
_LOGGABLE_FIELDS = ("kcal", "protein", "carbs", "fat")


def search_foods(
    db: Session, query: str, *, limit: int = DEFAULT_LIMIT, index: FoodIndex | None = None
) -> list[Food]:
    """Foods whose name matches `query`, best match first.

    With `index`, matching runs on Elasticsearch; the foods themselves are always loaded from
    PostgreSQL, the source of truth.
    """
    if index is not None:
        try:
            ids = _search_index(index, query, limit)
        except (ApiError, TransportError) as exc:
            # Not built yet (run scripts/index_foods.py), or Elasticsearch is down.
            logger.warning("food search index unavailable, searching PostgreSQL: %s", exc)
        else:
            return _load_in_order(db, ids)
    return _search_postgres(db, query, limit=limit)


def build_query(query: str) -> dict[str, Any]:
    """The Elasticsearch query for `query`, in its Query DSL.

    `must` decides which foods match: their name has the query's words — as written, in
    another word form, or as a synonym in the other language — or starts them while the user
    is still typing, or has them with a small typo. The three are weighted in that order, so a
    typo-corrected match never outranks a real one.

    `should` only reorders the matches: the exact name first, then names that start with the
    query, then names with the words in the same order. `filter` keeps out foods that cannot
    be logged, without affecting scores.
    """
    normalized = normalize_name(query)
    words = {
        "query": query,
        "type": "most_fields",
        # Up to 2 words must all match; with more, 3 in 4 must.
        "minimum_should_match": "2<75%",
    }
    return {
        "bool": {
            "must": [
                {
                    "bool": {
                        "should": [
                            # Whole words. A match on the name as written counts most; word
                            # forms and synonyms widen it.
                            {
                                "multi_match": {
                                    **words,
                                    "fields": ["name^3", "name.ro^2", "name.en^2", "name.syn"],
                                    "boost": 3,
                                }
                            },
                            # As you type: every word is the start of a word in the name.
                            {
                                "match": {
                                    "name.autocomplete": {
                                        "query": query,
                                        "operator": "and",
                                        "boost": 2,
                                    }
                                }
                            },
                            # Typos: no edits up to 3 letters, one up to 7, two after that, and
                            # the first letter must be right — looser than that and "chick"
                            # finds "thick".
                            {
                                "multi_match": {
                                    **words,
                                    "fields": ["name", "name.syn"],
                                    "fuzziness": "AUTO:4,8",
                                    "prefix_length": 1,
                                }
                            },
                        ],
                        "minimum_should_match": 1,
                    }
                }
            ],
            "should": [
                {"term": {"name_normalized": {"value": normalized, "boost": 10}}},
                {"prefix": {"name_normalized": {"value": normalized, "boost": 4}}},
                {"match_phrase": {"name": {"query": query, "boost": 2}}},
            ],
            "filter": [{"exists": {"field": field}} for field in _LOGGABLE_FIELDS],
        }
    }


def _search_index(index: FoodIndex, query: str, limit: int) -> list[int]:
    if not normalize_name(query):
        return []
    response = index.client.search(
        index=index.alias,
        query=build_query(query),
        size=limit,
        source=False,
    )
    return [int(hit["_id"]) for hit in response["hits"]["hits"]]


def _loggable(food: Food) -> bool:
    return None not in (
        food.calories_per_100g,
        food.protein_per_100g,
        food.carbs_per_100g,
        food.fat_per_100g,
    )


def _load_in_order(db: Session, ids: list[int]) -> list[Food]:
    if not ids:
        return []
    by_id = {food.id: food for food in db.execute(select(Food).where(Food.id.in_(ids))).scalars()}
    # A food deleted, or changed so it can no longer be logged, since it was indexed is left
    # out until the next reindex catches up.
    foods = (by_id.get(food_id) for food_id in ids)
    return [food for food in foods if food is not None and _loggable(food)]


def _search_postgres(db: Session, query: str, *, limit: int) -> list[Food]:
    """Foods whose name contains `query` or closely resembles it, best match first.

    Matching runs on `name_normalized`, so "Crème" finds "creme" and punctuation is ignored.
    Both conditions are served by the trigram index on that column, so this stays fast as
    farming grows the table.
    """
    # normalize_name leaves only letters, digits and spaces, so the LIKE patterns below need
    # no escaping.
    q = normalize_name(query)
    if not q:
        return []

    similarity = func.similarity(Food.name_normalized, q)
    statement = (
        select(Food)
        .where(or_(Food.name_normalized.like(f"%{q}%"), Food.name_normalized.op("%")(q)))
        .where(
            Food.calories_per_100g.is_not(None),
            Food.protein_per_100g.is_not(None),
            Food.carbs_per_100g.is_not(None),
            Food.fat_per_100g.is_not(None),
        )
        .order_by(
            (Food.name_normalized == q).desc(),
            Food.name_normalized.like(f"{q}%").desc(),
            similarity.desc(),
            func.length(Food.name),
            Food.id,
        )
        .limit(limit)
    )
    return list(db.execute(statement).scalars())
