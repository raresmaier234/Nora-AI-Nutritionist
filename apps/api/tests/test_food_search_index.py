"""Tests for food search on the Elasticsearch index (GET /api/v1/foods).

Each test builds a throwaway index holding only its own foods, so neither the development
index nor real foods affect results. Skipped when Elasticsearch isn't running
(`docker compose up -d elasticsearch`), except the fallback test, which needs it down anyway.
"""

import uuid
from decimal import Decimal

import pytest
from elasticsearch import Elasticsearch

from app.core.config import get_settings
from app.db.models.food import Food
from app.main import app
from app.services.food_index import (
    INDEX_MAPPINGS,
    INDEX_SETTINGS,
    FoodIndex,
    get_food_index,
    index_foods,
    rebuild,
)

FOODS = "/api/v1/foods"


def running_elasticsearch() -> Elasticsearch | None:
    url = get_settings().elasticsearch_url or "http://127.0.0.1:9200"
    client = Elasticsearch(url, request_timeout=2, max_retries=0)
    try:
        client.info()
    except Exception:
        return None
    return client


@pytest.fixture()
def search_index(client):
    es = running_elasticsearch()
    if es is None:
        pytest.skip("Elasticsearch is not running")
    name = f"foods-test-{uuid.uuid4().hex[:12]}"
    es.indices.create(index=name, settings=INDEX_SETTINGS, mappings=INDEX_MAPPINGS)
    index = FoodIndex(client=es, alias=name)
    app.dependency_overrides[get_food_index] = lambda: index
    yield index
    es.indices.delete(index=name)


def add_food(db, index: FoodIndex | None, name: str, **values) -> Food:
    defaults = {
        "calories_per_100g": Decimal("61"),
        "protein_per_100g": Decimal("3.2"),
        "carbs_per_100g": Decimal("4.8"),
        "fat_per_100g": Decimal("3.3"),
    }
    food = Food(name=name, **{**defaults, **values})
    db.add(food)
    db.flush()
    if index is not None:
        index_foods(db, index, [food.id], refresh=True)
    return food


def names(client, q: str) -> list[str]:
    response = client.get(FOODS, params={"q": q})
    assert response.status_code == 200
    return [food["name"] for food in response.json()]


def test_returns_the_food_with_its_values(client, db_session, search_index) -> None:
    food = add_food(db_session, search_index, "Qzvwx Whole Milk")

    assert client.get(FOODS, params={"q": "qzvwx"}).json() == [
        {
            "id": food.id,
            "name": "Qzvwx Whole Milk",
            "per_100g": {"kcal": 61.0, "protein": 3.2, "carbs": 4.8, "fat": 3.3},
        }
    ]


def test_matches_as_you_type(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "Almond butter")

    assert names(client, "alm") == ["Almond butter"]
    assert names(client, "almond bu") == ["Almond butter"]


def test_forgives_a_typo(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "Granola with honey")

    assert names(client, "granloa") == ["Granola with honey"]


def test_a_typo_never_changes_the_first_letter(client, db_session, search_index) -> None:
    """"chick" is one letter from "thick"; matching that is how searches fill with noise."""
    add_food(db_session, search_index, "Thick sliced bacon")
    add_food(db_session, search_index, "piept de pui")

    assert names(client, "chick") == ["piept de pui"]


def test_english_and_romanian_names_find_each_other(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "aripi de pui crude")
    add_food(db_session, search_index, "Chicken breast, raw")

    assert names(client, "chicken wings") == ["aripi de pui crude"]
    assert names(client, "piept de pui") == ["Chicken breast, raw"]
    # A typo in the synonym still finds it.
    assert set(names(client, "chiken")) == {"aripi de pui crude", "Chicken breast, raw"}


def test_ignores_case_and_accents(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "Smântână fermentată")

    assert names(client, "SMANTANA") == ["Smântână fermentată"]
    assert names(client, "smântână") == ["Smântână fermentată"]


def test_ranks_the_exact_name_first(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "Qzvwx cake with extra filling")
    add_food(db_session, search_index, "Qzvwx bar")
    add_food(db_session, search_index, "Qzvwx")

    assert names(client, "qzvwx")[0] == "Qzvwx"


def test_leaves_out_foods_missing_a_macro(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "Qzvwx complete")
    add_food(db_session, search_index, "Qzvwx no fat", fat_per_100g=None)

    assert names(client, "qzvwx") == ["Qzvwx complete"]


def test_a_query_of_only_punctuation_finds_nothing(client, db_session, search_index) -> None:
    add_food(db_session, search_index, "Qzvwx")

    assert names(client, "!!!") == []


def test_a_deleted_food_leaves_the_index(client, db_session, search_index) -> None:
    food = add_food(db_session, search_index, "Qzvwx gone soon")
    db_session.delete(food)
    db_session.flush()

    index_foods(db_session, search_index, [food.id], refresh=True)

    assert search_index.client.count(index=search_index.alias)["count"] == 0


def test_rebuild_swaps_in_a_fresh_index(db_session) -> None:
    es = running_elasticsearch()
    if es is None:
        pytest.skip("Elasticsearch is not running")
    index = FoodIndex(client=es, alias=f"foods-test-{uuid.uuid4().hex[:12]}")
    food = add_food(db_session, None, "Qzvwx rebuilt")
    try:
        count = rebuild(db_session, index)
        first = set(es.indices.get_alias(name=index.alias))
        rebuild(db_session, index)
        second = set(es.indices.get_alias(name=index.alias))

        assert count >= 1
        assert len(first) == len(second) == 1 and first != second
        assert not es.indices.exists(index=first.pop())  # the old index is gone
        assert es.exists(index=index.alias, id=str(food.id))
    finally:
        # Elasticsearch refuses wildcard deletes, so name each index.
        for name in es.indices.get(index=f"{index.alias}-*"):
            es.indices.delete(index=name)


def test_falls_back_to_postgres_when_the_index_is_down(client, db_session) -> None:
    unreachable = FoodIndex(
        client=Elasticsearch("http://127.0.0.1:9", request_timeout=1, max_retries=0), alias="foods"
    )
    app.dependency_overrides[get_food_index] = lambda: unreachable
    add_food(db_session, None, "Qzvwx only in postgres")

    assert names(client, "qzvwx") == ["Qzvwx only in postgres"]
