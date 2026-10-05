"""Tests for the full nutrient profile: columns, conversion, rebasing, energy."""

from decimal import Decimal

import pytest
from sqlalchemy import Numeric

from app.db.models.food import Food
from app.services.ingest.normalizer import NormalizationError, normalize_food
from app.services.ingest.nutrients import EXTRA_NUTRIENTS

CORE_COLUMNS = {
    "calories_per_100g",
    "protein_per_100g",
    "fat_per_100g",
    "carbs_per_100g",
    "fiber_per_100g",
    "sugar_per_100g",
    "saturated_fat_per_100g",
    "sodium_mg_per_100g",
}


def test_every_nutrient_has_a_column_and_every_column_a_nutrient() -> None:
    """The model and migration are written out by hand; this catches either drifting."""
    numeric = {c.name for c in Food.__table__.columns if isinstance(c.type, Numeric)}

    assert numeric == CORE_COLUMNS | {n.column for n in EXTRA_NUTRIENTS}


def test_column_names_carry_their_unit() -> None:
    columns = {n.key: n.column for n in EXTRA_NUTRIENTS}

    assert columns["leucine"] == "leucine_per_100g"
    assert columns["vitamin_c"] == "vitamin_c_mg_per_100g"
    assert columns["folate"] == "folate_ug_per_100g"


LABEL = {"name": "Brie", "basis": "per_100g", "calories": "334", "protein": "20.75",
         "fat": "27.68", "carbs": "0.45"}


def test_bare_numbers_are_read_in_the_columns_own_unit() -> None:
    food = normalize_food({**LABEL, "leucine": 1.929, "calcium": 184, "vitamin_b12": 1.65})

    assert food.extra["leucine_per_100g"] == Decimal("1.929")
    assert food.extra["calcium_mg_per_100g"] == Decimal("184")
    assert food.extra["vitamin_b12_ug_per_100g"] == Decimal("1.65")


def test_a_stated_unit_is_converted_to_the_columns_unit() -> None:
    food = normalize_food({**LABEL, "vitamin_b12": "0.00165 mg", "calcium": "0.184 g"})

    assert food.extra["vitamin_b12_ug_per_100g"] == Decimal("1.65")
    assert food.extra["calcium_mg_per_100g"] == Decimal("184")


def test_extras_are_rebased_with_the_rest_of_a_serving() -> None:
    """EatThisMuch gives 1 oz of brie: 0.5469g of leucine in 28.35g is 1.929g per 100g."""
    food = normalize_food(
        {
            "name": "Brie",
            "basis": "per_serving",
            "serving_grams": 28.35,
            "calories": 94.689,
            "protein": 5.882625,
            "fat": 7.84728,
            "carbs": 0.127575,
            "leucine": 0.5468715,
            "water": 13.72707,
        }
    )

    assert food.extra["leucine_per_100g"] == Decimal("1.929")
    assert food.extra["water_per_100g"] == Decimal("48.42")


def test_a_tiny_value_written_in_scientific_notation_is_not_misread() -> None:
    food = normalize_food({**LABEL, "epa": 1e-05})

    assert food.extra["epa_per_100g"] == Decimal("0")  # 0.00001g rounds below 0.001g


def test_an_impossible_extra_is_dropped_but_the_food_kept() -> None:
    food = normalize_food({**LABEL, "water": "480 g", "calcium": 184})

    assert "water_per_100g" not in food.extra
    assert food.extra["calcium_mg_per_100g"] == Decimal("184")


def test_alcohol_counts_toward_energy() -> None:
    """Regular beer: 43 kcal, 3.55g carbs, 0.46g protein — and 3.9g alcohol at 7 kcal/g."""
    beer = {"name": "Beer", "basis": "per_100g", "calories": 43, "protein": 0.46, "fat": 0,
            "carbs": 3.55, "alcohol": 3.9}

    assert normalize_food(beer).extra["alcohol_per_100g"] == Decimal("3.9")

    without_alcohol = {k: v for k, v in beer.items() if k != "alcohol"}
    with pytest.raises(NormalizationError, match="contradicts"):
        normalize_food(without_alcohol)
