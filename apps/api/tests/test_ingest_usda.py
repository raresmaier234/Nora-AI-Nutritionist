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


def portion(amount: float, modifier: str, grams: float, measure: str = "undetermined", seq: int = 1) -> dict:
    return {"amount": amount, "modifier": modifier, "gramWeight": grams, "sequenceNumber": seq, "measureUnit": {"name": measure}}


def test_usda_portions_become_units_with_the_grams_one_weighs() -> None:
    record = {
        **BANANA,
        "foodPortions": [
            portion(1, "cup, sliced", 150, seq=1),
            portion(1, "tablespoon", 9, seq=2),
            portion(3, "oz", 85, seq=3),  # the app offers oz for every food
            portion(1, 'medium (7" to 7-7/8" long)', 118, seq=4),
            portion(1, "", 120, measure="RACC", seq=5),
        ],
    }

    servings = normalize_food(food_to_raw(record)).servings

    assert [(s["unit"], s["grams"]) for s in servings] == [
        ("cup, sliced", 150),
        ("tbsp", 9),
        ("medium", 118),
        # No "serving": a banana isn't a prepared dish. Kitchen measures from the tbsp: the same food, by volume.
        ("cup", 144.0),
        ("tsp", 3.0),
    ]
    assert servings[2]["label"] == '1 medium (7" to 7-7/8" long)'


def test_liquid_milk_is_also_measured_in_ml() -> None:
    milk = {**BANANA, "description": "Milk, whole, 3.25% milkfat", "foodPortions": [portion(1, "cup", 249)]}
    powder = {**milk, "description": "Milk, dry, whole"}

    assert "ml" in [s["unit"] for s in normalize_food(food_to_raw(milk)).servings]
    assert "ml" not in [s["unit"] for s in normalize_food(food_to_raw(powder)).servings]


def test_a_prepared_dish_keeps_its_serving() -> None:
    burger = {**BANANA, "foodCategory": {"description": "Fast Foods"}, "foodPortions": [portion(1, "", 226, measure="RACC")]}

    # Its serving, and no cups or spoons: nobody measures a burger by volume.
    assert [s["unit"] for s in normalize_food(food_to_raw(burger)).servings] == ["serving"]
