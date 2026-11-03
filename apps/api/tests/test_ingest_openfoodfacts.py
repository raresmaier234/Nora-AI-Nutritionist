"""Tests for turning Open Food Facts export rows into foods. Values from a real product."""

from decimal import Decimal

import pytest

from app.services.ingest.brands import without_brand, without_pack_size
from app.services.ingest.normalizer import normalize_food
from app.services.ingest.sources.openfoodfacts import (
    barcode,
    read_rows,
    romanian_rows,
    row_to_raw,
    servings,
    supported_language_name,
)

COLUMNS = [
    "code", "product_name", "brands", "stores", "countries_tags", "no_nutrition_data",
    "energy-kcal_100g", "energy-kj_100g", "fat_100g", "saturated-fat_100g",
    "carbohydrates_100g", "sugars_100g", "fiber_100g", "proteins_100g", "sodium_100g",
    "vitamin-c_100g", "calcium_100g",
]


def export(*rows: dict) -> list[str]:
    lines = ["\t".join(COLUMNS)]
    lines += ["\t".join(row.get(column, "") for column in COLUMNS) for row in rows]
    return [line + "\n" for line in lines]


LAPTE = {
    "code": "5941065000123",
    "product_name": "Lapte de vacă 3,5% grăsime 1L",
    "brands": "Zuzu,Albalact",
    "stores": "Kaufland, Lidl",
    "countries_tags": "en:romania",
    "energy-kcal_100g": "64",
    "fat_100g": "3.5",
    "saturated-fat_100g": "2.3",
    "carbohydrates_100g": "4.7",
    "sugars_100g": "4.7",
    "proteins_100g": "3.4",
    "sodium_100g": "0.04",
    "vitamin-c_100g": "0.0012",
    "calcium_100g": "0.12",
}


def test_keeps_only_products_sold_in_romania() -> None:
    rows = export(LAPTE, {**LAPTE, "code": "1", "countries_tags": "en:france,en:germany"})

    assert [row["code"] for row in romanian_rows(read_rows(rows))] == ["5941065000123"]


def test_a_row_becomes_a_food_with_brand_store_and_units() -> None:
    [row] = read_rows(export(LAPTE))

    food = normalize_food(row_to_raw(row))

    assert (food.name, food.brand, food.store) == ("Lapte de vacă 3,5% grăsime", "Zuzu", "Kaufland")
    assert food.calories_per_100g == Decimal("64")
    assert food.sodium_mg_per_100g == Decimal("40")  # the export is in grams
    assert food.extra["vitamin_c_mg_per_100g"] == Decimal("1.2")
    assert food.extra["calcium_mg_per_100g"] == Decimal("120")


def test_energy_in_kj_only_is_converted() -> None:
    [row] = read_rows(export({**LAPTE, "energy-kcal_100g": "", "energy-kj_100g": "268"}))

    assert normalize_food(row_to_raw(row)).calories_per_100g.quantize(Decimal("1")) == 64


def test_rows_without_a_name_or_nutrition_are_skipped() -> None:
    rows = read_rows(export({**LAPTE, "product_name": ""}, {**LAPTE, "no_nutrition_data": "on"}))

    assert [row_to_raw(row) for row in rows] == [None, None]


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        ("5941065000123", "5941065000123"),  # EAN-13
        ("40084107", "40084107"),  # EAN-8
        ("012345678905", "012345678905"),  # UPC-A
        ("123", None),  # an internal code
        ("594106500012a", None),
    ],
)
def test_only_retail_barcodes_are_kept(code: str, expected: str | None) -> None:
    assert barcode(code) == expected


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Snack cu sare 180g", "Snack cu sare"),
        ("Apa minerala 1,5 L", "Apa minerala"),
        ("Bere blonda 6x330ml", "Bere blonda"),
        ("Oua de gaina 10 buc", "Oua de gaina"),
        ("Iaurt 3.5% grasime", "Iaurt 3.5% grasime"),  # a percentage is not a pack size
        ("7 Days", "7 Days"),
    ],
)
def test_pack_size_is_dropped_from_the_name(name: str, expected: str) -> None:
    assert without_pack_size(name) == expected


@pytest.mark.parametrize(
    ("name", "brand", "expected"),
    [
        ("Lapte Olympus", "Olympus", "Lapte"),
        ("Granini orange", "Granini", "orange"),
        ("Slim Pasta - Fettuccine", "Slim Pasta", "Fettuccine"),  # separators go with it
        ("Unt PRÉSIDENT", "President", "Unt"),  # case and accents don't matter
        ("Unt president 200 grame", "Président", "Unt president 200 grame"),  # middle: kept
        ("Raffaello", "Raffaello", "Raffaello"),  # nothing would be left
        ("Lapte de vaca", None, "Lapte de vaca"),
    ],
)
def test_brand_is_dropped_from_the_name(name: str, brand: str | None, expected: str) -> None:
    assert without_brand(name, brand) == expected


def test_a_row_names_the_food_without_its_brand_or_store() -> None:
    [row] = read_rows(export({**LAPTE, "product_name": "Kaufland Lapte Zuzu 1L"}))

    assert normalize_food(row_to_raw(row)).name == "Lapte"


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Pâine albă", "Pâine albă"),  # Romanian
        ("Jamón serrano", "Jamón serrano"),  # Spanish
        ("Caffè espresso", "Caffè espresso"),  # Italian
        ("Käse Brötchen", "Käse Brötchen"),  # German
        ("Spaghetti Nº5", "Spaghetti Nº5"),
        ("Милка орео", None),  # Russian
        ("Ταραμοσαλάτα", None),  # Greek
        ("Bœuf bourguignon", None),  # French
        ("Hořké čokolády", None),  # Czech
        ("Șuncă de porc / Деликатесна шунка", "Șuncă de porc"),  # bilingual: the supported half
        ("Maïs / Sweet Corn", "Sweet Corn"),
        ("Beef, ground, 70% lean / 30% fat", "Beef, ground, 70% lean / 30% fat"),  # not bilingual
    ],
)
def test_only_names_in_supported_languages_are_kept(name: str, expected: str | None) -> None:
    assert supported_language_name(name) == expected


@pytest.mark.parametrize(
    ("size", "grams", "expected"),
    [
        ("1 cookie (12.5 g)", "12.5", ("cookie", "1 cookie (12.5 g)", 12.5)),
        ("2 felii (50 g)", "50", ("slice", "2 felii (50 g)", 25)),  # per one, in English
    ],
)
def test_the_serving_size_becomes_a_unit(size: str, grams: str, expected: tuple) -> None:
    [row] = read_rows(export({**LAPTE}))
    [serving] = servings({**row, "serving_size": size, "serving_quantity": grams})

    assert (serving["unit"], serving["label"], serving["grams"]) == expected


@pytest.mark.parametrize("size", ["1 portion (100 g)", "30 g", "250 ml"])
def test_a_serving_is_only_for_prepared_dishes(size: str) -> None:
    [milk] = read_rows(export(LAPTE))
    pizza = {**milk, "categories_tags": "en:meals,en:pizzas"}

    assert servings({**milk, "serving_size": size, "serving_quantity": "100"}) == []
    [serving] = servings({**pizza, "serving_size": size, "serving_quantity": "100"})
    assert serving["unit"] == "serving"


def test_no_serving_size_means_no_units() -> None:
    [row] = read_rows(export(LAPTE))

    assert servings(row) == []
