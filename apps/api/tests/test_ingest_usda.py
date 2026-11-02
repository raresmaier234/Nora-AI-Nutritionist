"""Tests for turning USDA FoodData Central records into foods. Values from SR Legacy 9040."""

from decimal import Decimal

from app.services.ingest.normalizer import normalize_food
from app.services.ingest.sources.usda import food_to_raw


def nutrient(number: str, unit: str, amount: float) -> dict:
    return {"nutrient": {"number": number, "unitName": unit}, "amount": amount}


BANANA = {
    "fdcId": 173944,
    "description": "Bananas, raw",
    "foodNutrients": [
        nutrient("208", "kcal", 89),
        nutrient("203", "g", 1.09),
        nutrient("204", "g", 0.33),
        nutrient("205", "g", 22.84),
        nutrient("291", "g", 2.6),
        nutrient("269", "g", 12.23),
        nutrient("307", "mg", 1),
        nutrient("401", "mg", 8.7),
        nutrient("418", "µg", 0),
        nutrient("417", "µg", 20),
        nutrient("306", "mg", 358),
        nutrient("318", "IU", 64),  # IU is not a mass: left out
    ],
}


def test_a_usda_food_keeps_its_full_profile_in_the_right_units() -> None:
    food = normalize_food(food_to_raw(BANANA))

    assert food.name == "Bananas, raw"
    assert (food.calories_per_100g, food.protein_per_100g, food.carbs_per_100g) == (
        Decimal("89"),
        Decimal("1.09"),
        Decimal("22.84"),
    )
    assert food.sodium_mg_per_100g == Decimal("1")
    assert food.extra["vitamin_c_mg_per_100g"] == Decimal("8.7")
    assert food.extra["folate_ug_per_100g"] == Decimal("20")
    assert food.extra["vitamin_b12_ug_per_100g"] == Decimal("0")  # a measured zero is kept
    assert food.extra["potassium_mg_per_100g"] == Decimal("358")


def test_foundation_foods_without_208_use_the_atwater_energy() -> None:
    nutrients = [n for n in BANANA["foodNutrients"] if n["nutrient"]["number"] != "208"]
    record = {**BANANA, "foodNutrients": [*nutrients, nutrient("958", "kcal", 90)]}

    assert normalize_food(food_to_raw(record)).calories_per_100g == Decimal("90")
