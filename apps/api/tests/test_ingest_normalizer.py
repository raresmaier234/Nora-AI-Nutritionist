"""Tests for measurement parsing and per-100g normalization.

The fixtures here are real: the unit dialects come from a survey of live nutrition labels,
and the Atwater cases are the actual outputs llama3.2 produced when benchmarked — including
the two it got silently wrong.
"""

from decimal import Decimal

import pytest

from app.services.ingest.measures import (
    GRAM,
    KCAL,
    KJ,
    MILLIGRAM,
    parse_measurement,
    to_grams,
    to_kcal,
    to_milligrams,
)
from app.services.ingest.normalizer import (
    NormalizationError,
    check_atwater,
    normalize_food,
    normalize_name,
)


# --- measurement parsing: every dialect seen on real labels ------------------------


@pytest.mark.parametrize(
    ("raw", "value", "unit"),
    [
        ("372kcal", Decimal("372"), KCAL),           # no space
        ("334 kcal", Decimal("334"), KCAL),
        (" 502 Calories", Decimal("502"), KCAL),      # leading space, capitalised
        ("117 calories", Decimal("117"), KCAL),
        ("1560kJ", Decimal("1560"), KJ),
        ("272.8", Decimal("272.8"), None),            # bare number, no unit
        ("3 grams protein", Decimal("3"), GRAM),      # trailing nutrient name
        ("4g protein.", Decimal("4"), GRAM),          # trailing period
        ("22g protein. ", Decimal("22"), GRAM),
        ("34.9 g", Decimal("34.9"), GRAM),
        ("941mg sodium", Decimal("941"), MILLIGRAM),
        ("0.01g", Decimal("0.01"), GRAM),
        (350, Decimal("350"), None),                  # JSON number
        (12.5, Decimal("12.5"), None),
    ],
)
def test_parses_real_label_dialects(raw, value, unit) -> None:
    parsed = parse_measurement(raw)

    assert parsed is not None
    assert parsed.value == value
    assert parsed.unit == unit


@pytest.mark.parametrize("raw", [None, "", "trace", "n/a", True, False])
def test_returns_none_when_there_is_no_quantity(raw) -> None:
    assert parse_measurement(raw) is None


def test_reads_only_the_first_quantity() -> None:
    # "13g fat (1g saturated fat)" — the parenthesised value belongs to another field.
    parsed = parse_measurement("13g fat (1g saturated fat)")

    assert parsed is not None
    assert parsed.value == Decimal("13")


# --- unit conversion --------------------------------------------------------------


def test_converts_kilojoules_to_kilocalories() -> None:
    # 2000 kJ is the label llama3.2 turned into "0 kcal".
    assert to_kcal(parse_measurement("2000 kJ")) == pytest.approx(Decimal("478.0"), abs=0.5)


def test_assumes_a_unit_only_when_the_label_omits_one() -> None:
    assert to_kcal(parse_measurement("272.8"), assume=KCAL) == Decimal("272.8")
    assert to_grams(parse_measurement("941mg")) == Decimal("0.941")
    assert to_milligrams(parse_measurement("0.2 g")) == Decimal("200.000")


# --- the Atwater gate -------------------------------------------------------------


def test_accepts_a_consistent_label() -> None:
    # Cheddar, which the model extracted correctly: 416 kcal vs 416.1 implied.
    check_atwater(Decimal("416"), Decimal("25.4"), Decimal("0.1"), Decimal("34.9"))


def test_accepts_correctly_rebased_milk() -> None:
    check_atwater(Decimal("61"), Decimal("3.2"), Decimal("4.8"), Decimal("3.2"))


def test_rejects_the_zero_calorie_row_the_model_invented() -> None:
    # Brown rice: the model returned 0 kcal for a label stating 2000 kJ, while also
    # reporting 76g carbs. Storing that would poison the table.
    with pytest.raises(NormalizationError, match="contradicts|imply none"):
        check_atwater(Decimal("0"), Decimal("7.9"), Decimal("76"), Decimal("2.9"))


def test_skips_the_check_for_genuinely_near_zero_foods() -> None:
    check_atwater(Decimal("2"), Decimal("0.1"), Decimal("0.3"), Decimal("0"))


def test_skips_the_check_when_either_side_is_unknown() -> None:
    check_atwater(None, Decimal("10"), Decimal("10"), Decimal("1"))
    check_atwater(Decimal("400"), None, None, None)


# --- normalization end to end -----------------------------------------------------


def test_normalizes_a_per_100g_label() -> None:
    food = normalize_food(
        {
            "name": "Organic Plain White Flour",
            "basis": "per_100g",
            "calories": "372kcal",
            "protein": "11.5g",
            "fat": "1.2g",
            "carbs": "72.0g",
            "fiber": "3.4g",
            "sodium": "0.01g",
        }
    )

    assert food.name == "Organic Plain White Flour"
    assert food.name_normalized == "organic plain white flour"
    assert food.calories_per_100g == Decimal("372")
    assert food.protein_per_100g == Decimal("11.5")
    assert food.sodium_mg_per_100g == Decimal("10.00")


def test_rebases_per_serving_values_onto_100g() -> None:
    # Whole milk: 149 kcal per a 244g serving. The model returned nulls here; Python does
    # the arithmetic instead, and must land near 61 kcal/100g.
    food = normalize_food(
        {
            "name": "Whole Milk 3.5%",
            "basis": "per_serving",
            "serving_grams": "244",
            "calories": "149 kcal",
            "protein": "7.7g",
            "fat": "7.9g",
            "carbs": "11.7g",
        }
    )

    assert food.calories_per_100g == pytest.approx(Decimal("61.0"), abs=0.5)
    assert food.protein_per_100g == pytest.approx(Decimal("3.2"), abs=0.1)


def test_converts_kilojoule_labels() -> None:
    # Brown rice as actually labelled: 1550 kJ, which is consistent with its macros.
    food = normalize_food(
        {
            "name": "Brown Rice",
            "basis": "per_100g",
            "calories": "1550 kJ",
            "protein": "7.9g",
            "fat": "2.9g",
            "carbs": "76g",
        }
    )

    assert food.calories_per_100g == pytest.approx(Decimal("370.5"), abs=0.5)


def test_rejects_energy_too_high_for_its_macros() -> None:
    # Same macros, but 2000 kJ (478 kcal) against 362 implied — a ratio of 1.32.
    with pytest.raises(NormalizationError, match="contradicts"):
        normalize_food(
            {
                "name": "Brown Rice",
                "basis": "per_100g",
                "calories": "2000 kJ",
                "protein": "7.9g",
                "fat": "2.9g",
                "carbs": "76g",
            }
        )


def test_a_serving_weight_overrides_a_per_100g_claim() -> None:
    """Serving values mislabelled per_100g are the one error Atwater cannot see.

    Real case: a 28g cheese panel reported as per_100g. Every nutrient is scaled by the
    same factor, so the macros explain the calories perfectly and the ratio is 1.00 — but
    the food is stored at less than a third of its true energy. The stated serving weight
    contradicts the claim, and is the more trustworthy of the two.
    """
    food = normalize_food(
        {
            "name": "Blue Cheese",
            "basis": "per_100g",  # what the model said
            "serving_grams": "28g",  # what the page actually printed
            "calories": "100",
            "protein": "6g",
            "fat": "8g",
            "carbs": "1g",
        }
    )

    assert food.calories_per_100g == pytest.approx(Decimal("357"), abs=2)


def test_a_genuine_per_100g_panel_is_left_alone() -> None:
    food = normalize_food(
        {
            "name": "Plain Flour",
            "basis": "per_100g",
            "serving_grams": None,
            "calories": "372kcal",
            "protein": "11.5g",
            "fat": "1.2g",
            "carbs": "72g",
        }
    )

    assert food.calories_per_100g == Decimal("372")


def test_a_serving_that_really_is_100g_is_not_treated_as_a_contradiction() -> None:
    food = normalize_food(
        {
            "name": "Plain Flour",
            "basis": "per_100g",
            "serving_grams": "100g",
            "calories": "372kcal",
            "protein": "11.5g",
            "fat": "1.2g",
            "carbs": "72g",
        }
    )

    assert food.calories_per_100g == Decimal("372")


def test_rejects_per_serving_values_without_a_serving_weight() -> None:
    with pytest.raises(NormalizationError, match="serving weight"):
        normalize_food(
            {
                "name": "Mystery Snack",
                "basis": "per_serving",
                "calories": "149 kcal",
                "protein": "7.7g",
            }
        )


def test_rejects_an_extraction_with_no_name() -> None:
    with pytest.raises(NormalizationError, match="no food name"):
        normalize_food({"name": "  ", "calories": "100 kcal"})


def test_rejects_an_extraction_with_no_nutrition() -> None:
    with pytest.raises(NormalizationError, match="no usable nutrition"):
        normalize_food({"name": "Air", "basis": "per_100g"})


def test_rejects_a_row_whose_energy_contradicts_its_macros() -> None:
    with pytest.raises(NormalizationError):
        normalize_food(
            {
                "name": "Brown Rice (uncooked)",
                "basis": "per_100g",
                "calories": "0",
                "protein": "7.9g",
                "fat": "2.9g",
                "carbs": "76g",
            }
        )


# --- dedup key --------------------------------------------------------------------


@pytest.mark.parametrize(
    ("left", "right"),
    [
        ("Plain Flour", "plain flour"),
        ("Crème Fraîche", "Creme Fraiche"),
        ("Whole-Wheat Bread", "Whole Wheat Bread"),
        ("Olive Oil, Extra Virgin", "Olive Oil Extra Virgin"),
        ("  Brown   Rice  ", "Brown Rice"),
    ],
)
def test_names_that_mean_the_same_food_share_a_key(left, right) -> None:
    assert normalize_name(left) == normalize_name(right)


def test_names_that_mean_different_foods_do_not_collide() -> None:
    assert normalize_name("Whole Milk") != normalize_name("Skimmed Milk")
