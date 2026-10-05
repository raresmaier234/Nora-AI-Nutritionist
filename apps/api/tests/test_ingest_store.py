"""Tests for food deduplication and upsert."""

from dataclasses import replace
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.db.models.food import Food
from app.services.ingest.normalizer import NormalizedFood, normalize_name
from app.services.ingest.store import find_similar, upsert_food


# These tests share the real development database, which fills up as foods are farmed. Names
# are therefore synthetic: a real "Whole milk" or "Paprika" would otherwise collide with, or
# look similar to, the foods a test creates.
def make_food(name: str, **overrides) -> NormalizedFood:
    values = {
        "calories_per_100g": Decimal("372"),
        "protein_per_100g": Decimal("11.5"),
        "fat_per_100g": Decimal("1.2"),
        "carbs_per_100g": Decimal("72"),
        "fiber_per_100g": None,
        "sugar_per_100g": None,
        "saturated_fat_per_100g": None,
        "sodium_mg_per_100g": None,
    }
    values.update(overrides)
    return NormalizedFood(name=name, name_normalized=normalize_name(name), **values)


def test_inserts_a_new_food(db_session) -> None:
    result = upsert_food(db_session, make_food("Zqx Plain White Flour"))

    assert result.created is True
    assert result.food.id is not None
    assert result.food.name_normalized == "zqx plain white flour"
    assert result.food.needs_review is False


def test_reingesting_the_same_food_does_not_duplicate_it(db_session) -> None:
    first = upsert_food(db_session, make_food("Zqx Plain White Flour"))
    second = upsert_food(db_session, make_food("zqx plain white FLOUR"))

    assert second.created is False
    assert second.food.id == first.food.id

    count = db_session.execute(
        select(func.count())
        .select_from(Food)
        .where(Food.name_normalized == "zqx plain white flour")
    ).scalar_one()
    assert count == 1


def test_reingesting_fills_in_values_that_were_missing(db_session) -> None:
    upsert_food(db_session, make_food("Zqx Rolled Oats", fiber_per_100g=None))

    result = upsert_food(
        db_session, make_food("Zqx Rolled Oats", fiber_per_100g=Decimal("10.6"))
    )

    assert result.created is False
    assert result.food.fiber_per_100g == Decimal("10.6")


def test_reingesting_does_not_overwrite_values_already_known(db_session) -> None:
    upsert_food(db_session, make_food("Zqx Caster Sugar", calories_per_100g=Decimal("400")))

    result = upsert_food(
        db_session, make_food("Zqx Caster Sugar", calories_per_100g=Decimal("999"))
    )

    assert result.food.calories_per_100g == Decimal("400")


def test_a_near_duplicate_name_is_flagged_for_review(db_session) -> None:
    upsert_food(db_session, make_food("Zqx Plain White Flour"))
    db_session.flush()

    result = upsert_food(db_session, make_food("Zqx Plain White Flours"))

    assert result.created is True
    assert result.food.needs_review is True
    assert any("Zqx Plain White Flour" == s.name for s in result.similar)


def test_an_unrelated_food_is_not_flagged(db_session) -> None:
    upsert_food(db_session, make_food("Zqx Plain White Flour"))
    db_session.flush()

    result = upsert_food(db_session, make_food("Kjwtrb Vlmxq"))

    assert result.created is True
    assert result.similar == []
    assert result.food.needs_review is False


def test_similarity_search_ignores_an_exact_match(db_session) -> None:
    upsert_food(db_session, make_food("Qzxvw Bnmtk"))
    db_session.flush()

    assert find_similar(db_session, "qzxvw bnmtk") == []


def test_a_product_variant_is_surfaced_rather_than_silently_merged(db_session) -> None:
    """Similarity cannot tell a variant from a restatement, so both go to review.

    Measured on real names: "nutella" vs "nutella ferrero" (the same product) scores 0.50,
    while "coca cola" vs "coca cola zero" (different products) scores 0.615 — higher. No
    threshold separates them, which is why a match flags the row instead of merging it.
    """
    upsert_food(db_session, make_food("Zqx Coca-Cola"))
    db_session.flush()

    result = upsert_food(db_session, make_food("Zqx Coca-Cola Zero"))

    # Stored as its own food — never folded into the original — but marked for a human.
    assert result.created is True
    assert result.food.needs_review is True


def test_rebased_values_are_not_stored_with_false_precision(db_session) -> None:
    from decimal import Decimal as D

    from app.services.ingest.normalizer import normalize_food

    # 3.6g of protein in a 43g serving is 8.372093023...g per 100g.
    food = normalize_food(
        {
            "name": "Wafer Bar",
            "basis": "per_serving",
            "serving_grams": "43",
            "calories": "244 kcal",
            "protein": "3.6g",
            "fat": "16g",
            "carbs": "21.2g",
        }
    )

    assert food.protein_per_100g == D("8.372")
    assert food.protein_per_100g.as_tuple().exponent >= -3


def test_the_unique_constraint_is_the_backstop(db_session) -> None:
    # Even bypassing upsert_food entirely, the database refuses a duplicate.
    # Deliberately synthetic: the fixture shares a real database, so a plausible food name
    # would collide with genuinely ingested rows rather than with this test's own insert.
    db_session.add(Food(name="Zzz Test Food", name_normalized="zzz test food"))
    db_session.flush()
    db_session.add(Food(name="ZZZ TEST FOOD", name_normalized="zzz test food"))

    with pytest.raises(Exception):  # IntegrityError, surfaced by the driver
        db_session.flush()


def test_extra_nutrients_are_stored(db_session) -> None:
    food = replace(make_food("Zzz Test Brie"), extra={"leucine_per_100g": Decimal("1.929")})

    result = upsert_food(db_session, food)

    assert result.food.leucine_per_100g == Decimal("1.929")


def test_reingesting_the_same_page_fills_missing_extras(db_session) -> None:
    url = "https://zzz.example/brie"
    upsert_food(db_session, make_food("Zzz Test Brie"), source_url=url)
    richer = replace(make_food("Zzz Test Brie"), extra={"water_per_100g": Decimal("48.42")})

    result = upsert_food(db_session, richer, source_url=url)

    assert result.food.water_per_100g == Decimal("48.42")


def test_a_different_page_with_the_same_name_is_not_merged_in(db_session) -> None:
    """EatThisMuch has several foods called "Salmon"; one must not fill in another."""
    upsert_food(
        db_session, make_food("Zzz Test Salmon"), source_url="https://zzz.example/salmon-1"
    )
    other = make_food("Zzz Test Salmon", fiber_per_100g=Decimal("9"))

    result = upsert_food(db_session, other, source_url="https://zzz.example/salmon-2")

    assert result.created is False
    assert result.name_taken is True
    assert result.food.fiber_per_100g is None
