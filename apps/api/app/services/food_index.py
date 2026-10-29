"""The Elasticsearch index behind food search.

PostgreSQL stays the source of truth: this index is derived from the `foods` table and can be
thrown away and rebuilt at any time (`python scripts/index_foods.py`). Search reads matching
ids from here and loads the foods themselves from PostgreSQL — see `food_search.py`.

The index is reached through an alias (`settings.elasticsearch_index`, "foods"). A rebuild
fills a new, timestamped index and then moves the alias onto it in one step, so searches
never see a half-built index.

One document per food: its name, analyzed several ways so typos, partial words, accents,
Romanian and English word forms, and the synonyms in `food_synonyms.py` all match, plus its
macros per 100 g, which search filters on. The query itself is `food_search.build_query`.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any

from elasticsearch import Elasticsearch, NotFoundError, helpers
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.food import Food
from app.services.food_synonyms import FOOD_SYNONYMS

logger = logging.getLogger(__name__)

# A search should answer in milliseconds; if the index is slow or down, search falls back
# to PostgreSQL (see food_search.py) rather than making the app wait.
SEARCH_TIMEOUT_SECONDS = 2.0
# Writing the whole table is bulk work; give it room.
WRITE_TIMEOUT_SECONDS = 60.0
# Foods per bulk request when (re)indexing.
BATCH_SIZE = 500

INDEX_SETTINGS: dict[str, Any] = {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    # Edge n-grams of up to 20 characters per word (see `autocomplete` below).
    "max_ngram_diff": 19,
    "analysis": {
        "filter": {
            # Applied while indexing: a food named "aripi pui" is also indexed under "chicken"
            # and "wings". Done here rather than to the query so that a typo of a synonym
            # ("chiken") and a prefix of one ("chick") still find it — typo tolerance and
            # prefixes work on indexed words. flatten_graph is required after a synonym graph
            # at index time.
            "food_synonyms": {"type": "synonym_graph", "synonyms": FOOD_SYNONYMS, "lenient": True},
            # Connecting words don't decide a match: "piept de pui" (chicken breast) must not
            # find "aripi de pui" (chicken wings) on "de" + "pui". Folded, both languages.
            # "fara" (without) stays — "fara zahar" is sugar free.
            "food_stop": {
                "type": "stop",
                "stopwords": [
                    "de", "cu", "si", "la", "in", "pe", "din", "pentru", "sau", "al", "ale",
                    "a", "un", "o", "of", "with", "and", "the", "an", "for", "or", "to", "on",
                ],
            },
            "romanian_stemmer": {"type": "stemmer", "language": "romanian"},
            "english_possessive": {"type": "stemmer", "language": "possessive_english"},
            "english_stemmer": {"type": "stemmer", "language": "light_english"},
            "autocomplete": {"type": "edge_ngram", "min_gram": 1, "max_gram": 20},
        },
        "analyzer": {
            # Words as written, lowercased and with accents folded ("Smântână" -> "smantana").
            # Also the search analyzer for every field below.
            "food_name": {
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding", "food_stop"],
            },
            # Romanian word forms: "aripi" and "aripa" meet at the same stem.
            "food_name_ro": {
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding", "food_stop", "romanian_stemmer"],
            },
            # English word forms: "eggs" finds "Egg", "berries" finds "berry".
            "food_name_en": {
                "tokenizer": "standard",
                "filter": [
                    "lowercase",
                    "asciifolding",
                    "english_possessive",
                    "food_stop",
                    "english_stemmer",
                ],
            },
            # The name plus its synonyms in the other language (food_synonyms.py).
            "food_name_synonyms": {
                "tokenizer": "standard",
                # Synonyms before the stop filter, so multi-word ones like "branza de vaci"
                # (cottage cheese) see the name as written.
                "filter": [
                    "lowercase",
                    "asciifolding",
                    "food_synonyms",
                    "flatten_graph",
                    "food_stop",
                ],
            },
            # As you type: every word and synonym, also as its prefixes, so "alm" finds
            # "almonds" and "chick" finds "piept de pui" (a, al, alm, almo, ...). Keeps the
            # connecting words, so "piept d" still matches while "de" is being typed.
            "food_name_autocomplete": {
                "tokenizer": "standard",
                "filter": [
                    "lowercase",
                    "asciifolding",
                    "food_synonyms",
                    "flatten_graph",
                    "autocomplete",
                ],
            },
        },
    },
}

INDEX_MAPPINGS: dict[str, Any] = {
    "dynamic": "strict",
    "properties": {
        "name": {
            "type": "text",
            "analyzer": "food_name",
            "fields": {
                "ro": {"type": "text", "analyzer": "food_name_ro"},
                "en": {"type": "text", "analyzer": "food_name_en"},
                "syn": {
                    "type": "text",
                    "analyzer": "food_name_synonyms",
                    "search_analyzer": "food_name",
                },
                "autocomplete": {
                    "type": "text",
                    "analyzer": "food_name_autocomplete",
                    "search_analyzer": "food_name",
                },
            },
        },
        # The same normalized name PostgreSQL stores (app/utils/naming.py), for exact-name and
        # starts-with boosts.
        "name_normalized": {"type": "keyword"},
        # Per 100 g. Search only returns foods with all four: one without calories or a
        # macro cannot be logged meaningfully.
        "kcal": {"type": "float"},
        "protein": {"type": "float"},
        "carbs": {"type": "float"},
        "fat": {"type": "float"},
    },
}


@dataclass(frozen=True)
class FoodIndex:
    """A connection to the food search index: the client and the alias to use."""

    client: Elasticsearch
    alias: str


@lru_cache
def get_food_index() -> FoodIndex | None:
    """The configured food index, or None when Elasticsearch isn't set up.

    Also a FastAPI dependency (see routes/foods.py), so tests can swap the index out.
    """
    settings = get_settings()
    if not settings.elasticsearch_url:
        return None
    client = Elasticsearch(
        settings.elasticsearch_url,
        api_key=settings.elasticsearch_api_key,
        request_timeout=SEARCH_TIMEOUT_SECONDS,
        # Down means down: fall back at once rather than retrying while the user waits.
        max_retries=0,
    )
    return FoodIndex(client=client, alias=settings.elasticsearch_index)


def _number(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def to_document(food: Food) -> dict[str, Any]:
    return {
        "name": food.name,
        "name_normalized": food.name_normalized,
        "kcal": _number(food.calories_per_100g),
        "protein": _number(food.protein_per_100g),
        "carbs": _number(food.carbs_per_100g),
        "fat": _number(food.fat_per_100g),
    }


def _index_actions(foods: Iterable[Food], index: str) -> Iterator[dict[str, Any]]:
    for food in foods:
        yield {
            "_op_type": "index",
            "_index": index,
            "_id": str(food.id),
            "_source": to_document(food),
        }


def rebuild(db: Session, index: FoodIndex) -> int:
    """Index every food into a fresh index, then point the alias at it. Returns the count.

    The previous index stays live until the new one is complete, and is deleted afterwards.
    """
    client = index.client.options(request_timeout=WRITE_TIMEOUT_SECONDS)
    name = f"{index.alias}-{datetime.now(UTC):%Y%m%d%H%M%S%f}"
    client.indices.create(index=name, settings=INDEX_SETTINGS, mappings=INDEX_MAPPINGS)

    statement = select(Food).order_by(Food.id).execution_options(yield_per=BATCH_SIZE)
    foods = db.execute(statement).scalars()
    count, _ = helpers.bulk(client, _index_actions(foods, name), chunk_size=BATCH_SIZE)
    client.indices.refresh(index=name)

    try:
        previous = list(client.indices.get_alias(name=index.alias))
    except NotFoundError:
        previous = []
    client.indices.update_aliases(
        actions=[{"remove": {"index": old, "alias": index.alias}} for old in previous]
        + [{"add": {"index": name, "alias": index.alias}}]
    )
    for old in previous:
        client.indices.delete(index=old)

    logger.info("indexed %s foods into %s (alias %s)", count, name, index.alias)
    return count


def index_foods(
    db: Session, index: FoodIndex, food_ids: Iterable[int], *, refresh: bool = False
) -> None:
    """Bring these foods' documents up to date: index the ones that exist, drop the rest.

    For keeping the index current as foods are saved (the ingest pipeline). Call it after
    the transaction that changed them has committed, so the index never holds a food that
    was rolled back.
    """
    ids = set(food_ids)
    if not ids:
        return
    foods = list(db.execute(select(Food).where(Food.id.in_(ids))).scalars())
    gone = ids - {food.id for food in foods}
    actions: list[dict[str, Any]] = list(_index_actions(foods, index.alias))
    actions += [
        {"_op_type": "delete", "_index": index.alias, "_id": str(food_id)} for food_id in gone
    ]
    helpers.bulk(
        index.client.options(request_timeout=WRITE_TIMEOUT_SECONDS),
        actions,
        refresh="wait_for" if refresh else False,
        # Deleting a food the index never had is fine.
        raise_on_error=False,
    )
