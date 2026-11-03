"""Tests for the measures each kind of food gets: kitchen measures, slices, egg sizes."""

import pytest

from app.services.ingest.servings import (
    estimated_kind,
    is_whole_egg,
    measured_kind,
    typical_slices,
    with_egg_sizes,
    with_kitchen_measures,
)


def units(servings: list[dict]) -> dict[str, float]:
    return {s["unit"]: s["grams"] for s in servings}


def test_a_cup_gives_tbsp_and_tsp_of_the_same_food() -> None:
    milk = with_kitchen_measures([{"unit": "cup", "label": "1 cup", "grams": 244.0}])

    assert units(milk) == {"cup": 244.0, "tbsp": pytest.approx(15.25, abs=0.01), "tsp": pytest.approx(5.08, abs=0.01)}


def test_fl_oz_means_poured_so_ml_is_added_too() -> None:
    cream = units(with_kitchen_measures([{"unit": "fl oz", "label": "1 fl oz", "grams": 29.8}]))

    assert set(cream) == {"fl oz", "ml", "cup", "tbsp", "tsp"}
    assert cream["ml"] == pytest.approx(1.01, abs=0.01)


def test_each_pantry_kind_gets_the_measures_it_is_taken_in() -> None:
    flour = units(with_kitchen_measures([], measured_kind("en:cereals-and-their-products,en:flours")))
    honey = units(with_kitchen_measures([], measured_kind("en:spreads,en:honeys")))
    milk = units(with_kitchen_measures([], measured_kind("en:beverages,en:milks")))

    assert set(flour) == {"cup", "tbsp", "tsp"} and flour["cup"] == pytest.approx(125.4, abs=0.1)
    assert set(honey) == {"tbsp", "tsp"}  # spooned, not cupped
    assert set(milk) == {"ml", "cup", "tbsp", "tsp"}


def test_the_foods_own_volume_wins_over_its_category() -> None:
    weighed = with_kitchen_measures([{"unit": "tbsp", "label": "1 tbsp", "grams": 21.0}], (1.0, ("tbsp", "tsp")))

    assert units(weighed)["cup"] == pytest.approx(336.0, abs=0.1)


def test_a_block_of_cheese_gets_a_slice_and_no_spoons() -> None:
    categories = "en:dairies,en:fermented-foods,en:cheeses,en:swiss-cheeses"

    assert estimated_kind(categories, "Emmentaler") is None
    assert [(s["unit"], s["grams"], s["estimated"]) for s in typical_slices(categories, "Emmentaler")] == [("slice", 20.0, True)]


def test_grated_cheese_gets_spoons_and_no_slice() -> None:
    categories = "en:dairies,en:cheeses"
    grated = with_kitchen_measures([], estimate=estimated_kind(categories, "Cașcaval ras"))

    assert units(grated) == {"cup": pytest.approx(94.6, abs=0.1), "tbsp": pytest.approx(5.91, abs=0.01)}
    assert all(s["estimated"] for s in grated)
    assert typical_slices(categories, "Cașcaval ras") == []


@pytest.mark.parametrize(
    "categories",
    ["en:meats-and-their-products,en:meats", "en:snacks,en:biscuits", "en:chocolates", "en:meals,en:pizzas"],
)
def test_foods_not_measured_by_volume_get_no_kitchen_measures(categories: str) -> None:
    assert measured_kind(categories) is None
    assert estimated_kind(categories, "Anything") is None


def test_a_measured_density_is_never_flagged_as_estimated() -> None:
    milk = with_kitchen_measures([{"unit": "cup", "label": "1 cup", "grams": 249.0}], estimate=(0.3, ("cup",)))

    assert not any(s.get("estimated") for s in milk)
    assert units(milk)["tbsp"] == pytest.approx(15.56, abs=0.01)


@pytest.mark.parametrize(
    ("categories", "serving", "expected"),
    [
        ("en:beverages,en:milks,en:milk-powders", "", None),  # a cup of powder isn't a cup of milk
        ("", "1 bottle (330 ml)", (1.0, ("ml", "cup", "tbsp", "tsp"))),
    ],
)
def test_powders_are_not_poured_and_ml_servings_are(categories, serving, expected) -> None:
    assert measured_kind(categories, serving) == expected


def test_bread_and_deli_meat_come_by_the_slice() -> None:
    assert typical_slices("en:breads", "Pâine albă")[0]["grams"] == 30.0
    assert typical_slices("en:prepared-meats,en:hams", "Șuncă presată")[0]["grams"] == 15.0


@pytest.mark.parametrize(
    ("categories", "name", "expected"),
    [
        ("en:farming-products,en:eggs,en:chicken-eggs", "Ouă de găină M", True),
        ("en:eggs,en:egg-whites", "Albuș lichid", False),
        ("en:eggs", "Egg powder", False),
        ("en:chocolates", "Kinder Surprise egg", False),
        ("", "Ouă proaspete", True),  # no category: the name says eggs
        ("", "30 Ouă", True),
        ("", "Egg Protein", False),
    ],
)
def test_only_whole_eggs_get_egg_sizes(categories: str, name: str, expected: bool) -> None:
    assert is_whole_egg(categories, name) is expected


def test_egg_sizes_are_added_small_to_jumbo() -> None:
    eggs = with_egg_sizes([{"unit": "large", "label": "1 large", "grams": 50.0}])

    assert [s["unit"] for s in eggs] == ["large", "small", "medium", "extra large", "jumbo"]
    assert units(eggs)["jumbo"] == 63.0


def test_quail_eggs_get_one_small_egg_not_chicken_sizes() -> None:
    assert [(s["unit"], s["grams"]) for s in with_egg_sizes([], "Oua de prepeliță")] == [("egg", 9.0)]


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Miere de tei", ("tbsp", "tsp")),
        ("Lapte 1.5%", ("ml", "cup", "tbsp", "tsp")),
        ("Făină albă 000", ("cup", "tbsp", "tsp")),
        ("Ciocolată cu lapte", None),  # milk chocolate isn't milk
        ("Lapte praf", None),  # milk powder isn't poured
    ],
)
def test_a_product_without_a_category_is_known_by_its_name(name: str, expected) -> None:
    kind = measured_kind("", "", name)
    assert (kind[1] if kind else None) == expected


def test_cheese_and_bread_without_a_category_are_known_by_name() -> None:
    assert typical_slices("", "Pâinea Casei")[0]["grams"] == 30.0
    assert typical_slices("", "Cascaval Dalia")[0]["grams"] == 20.0
    assert estimated_kind("", "Cascaval ras Hochland") == (0.4, ("cup", "tbsp"))


def test_soft_cheese_is_spooned_not_sliced() -> None:
    assert estimated_kind("en:cheeses", "Brânză de vaci 6%") == (0.96, ("cup", "tbsp", "tsp"))
    assert typical_slices("en:cheeses", "Brânză de vaci 6%") == []
