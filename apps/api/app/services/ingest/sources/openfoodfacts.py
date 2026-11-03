"""Open Food Facts: products from its bulk CSV export, turned into raw food records.

Open Food Facts asks for bulk use to go through its exports, not the API ("scraping the
database through the API will very likely be blocked"), so this reads the export file. The
food export is one tab-separated CSV of every product in the world (~1.5 GB gzipped);
`romanian_rows` keeps the products sold in Romania as it streams.

Licence: the database is ODbL 1.0 and its contents DbCL 1.0. Public use needs the
attribution "Contains data from Open Food Facts, available under the Open Database License",
and an adapted database that is used publicly must itself be offered under the ODbL.

Every `_100g` column in the export is in grams — vitamins and minerals included — except
energy (kcal or kJ). Each value is passed on with its unit, so the normalizer converts it
like any label reading. Alcohol is left out: Open Food Facts records it as % vol, not grams.
"""

from __future__ import annotations

import csv
import re
import sys
from collections.abc import Iterable, Iterator

from app.services.ingest.brands import store_from_list, without_brand, without_pack_size
from app.services.ingest.normalizer import PER_100G
from app.services.ingest.servings import (
    estimated_kind,
    is_whole_egg,
    measured_kind,
    typical_slices,
    with_egg_sizes,
    with_kitchen_measures,
)
from app.utils.naming import clean_display_name

EXPORT_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
COUNTRY_TAG = "en:romania"

# Core label fields: our raw key -> the export's column (grams unless named otherwise).
_CORE = {
    "protein": "proteins_100g",
    "fat": "fat_100g",
    "saturated_fat": "saturated-fat_100g",
    "carbs": "carbohydrates_100g",
    "sugar": "sugars_100g",
    "fiber": "fiber_100g",
    "sodium": "sodium_100g",
}

# The full profile (app/services/ingest/nutrients.py): our key -> the export's column.
_EXTRA = {
    "starch": "starch_100g",
    "sucrose": "sucrose_100g",
    "glucose": "glucose_100g",
    "fructose": "fructose_100g",
    "lactose": "lactose_100g",
    "maltose": "maltose_100g",
    "galactose": "galactose_100g",
    "monounsaturated_fat": "monounsaturated-fat_100g",
    "polyunsaturated_fat": "polyunsaturated-fat_100g",
    "trans_fat": "trans-fat_100g",
    "omega_3": "omega-3-fat_100g",
    "omega_6": "omega-6-fat_100g",
    "ala": "alpha-linolenic-acid_100g",
    "epa": "eicosapentaenoic-acid_100g",
    "dha": "docosahexaenoic-acid_100g",
    "cholesterol": "cholesterol_100g",
    "vitamin_a": "vitamin-a_100g",
    "beta_carotene": "beta-carotene_100g",
    "vitamin_d": "vitamin-d_100g",
    "vitamin_e": "vitamin-e_100g",
    "vitamin_k": "vitamin-k_100g",
    "vitamin_c": "vitamin-c_100g",
    "thiamin": "vitamin-b1_100g",
    "riboflavin": "vitamin-b2_100g",
    "niacin": "vitamin-pp_100g",
    "vitamin_b6": "vitamin-b6_100g",
    "folate": "vitamin-b9_100g",
    "vitamin_b12": "vitamin-b12_100g",
    "pantothenic_acid": "pantothenic-acid_100g",
    "choline": "choline_100g",
    "potassium": "potassium_100g",
    "calcium": "calcium_100g",
    "phosphorus": "phosphorus_100g",
    "iron": "iron_100g",
    "magnesium": "magnesium_100g",
    "zinc": "zinc_100g",
    "copper": "copper_100g",
    "manganese": "manganese_100g",
    "fluoride": "fluoride_100g",
    "selenium": "selenium_100g",
    "caffeine": "caffeine_100g",
    "water": "water_100g",
}


# Letters beyond a–z that English, Romanian, Spanish, Italian and German names use, plus the
# ordinal signs in "Nº5". A name with any other letter — Cyrillic, Greek, French "œ", Czech
# "ř" — is in a language the app doesn't serve. A name in another language written only in
# a–z can't be told apart this way and gets through.
_SUPPORTED_LETTERS = frozenset("ăâîșțşţáéíóúñüàèìòùäößºª" + "ĂÂÎȘȚŞŢÁÉÍÓÚÑÜÀÈÌÒÙÄÖ")


def supported_language_name(name: str) -> str | None:
    """The name if it is in a supported language, else None.

    A bilingual name keeps its supported half: "Șuncă de porc / Деликатесна шунка" ->
    "Șuncă de porc". Only an unsupported name is split, since " / " also appears inside
    ordinary names ("Beef, ground, 70% lean / 30% fat").
    """
    def supported(text: str) -> bool:
        return all(ch.isascii() or not ch.isalpha() or ch in _SUPPORTED_LETTERS for ch in text)

    if supported(name):
        return name
    return next((part.strip() for part in name.split(" / ") if part.strip() and supported(part)), None)


def read_rows(lines: Iterable[str]) -> Iterator[dict[str, str]]:
    """Rows of the export as dicts. The export is tab-separated and never quotes a field."""
    csv.field_size_limit(sys.maxsize)  # ingredient lists can run past the 128 KB default
    return csv.DictReader(lines, delimiter="\t", quoting=csv.QUOTE_NONE)


def romanian_rows(rows: Iterable[dict[str, str]]) -> Iterator[dict[str, str]]:
    for row in rows:
        if COUNTRY_TAG in (row.get("countries_tags") or "").split(","):
            yield row


def barcode(code: str) -> str | None:
    """The code if it is a retail barcode (EAN-8, UPC-A, EAN-13, GTIN-14), else None.

    The export also holds shops' internal codes and typos; those cannot be scanned.
    """
    code = code.strip()
    return code if code.isdigit() and 8 <= len(code) <= 14 else None


# Prepared dishes, the only products a "serving" is offered for: for an ingredient or a snack
# it's an arbitrary amount, and grams or the product's own pieces say it better.
_PREPARED_TAGS = {
    "en:meals", "en:pizzas", "en:pizzas-pies-and-quiches", "en:sandwiches", "en:burgers",
    "en:hamburgers", "en:soups", "en:prepared-salads", "en:pasta-dishes",
}
# Words for "one portion" in the export, shown as "serving".
_SERVING_WORDS = {"portion", "portie", "porție", "portii", "porții", "serving", "servings", "serv"}
# Romanian and plural unit words, in the English the app shows.
_UNIT_WORDS = {
    "felie": "slice", "felii": "slice", "slices": "slice",
    "buc": "piece", "bucata": "piece", "bucată": "piece", "bucati": "piece", "bucăți": "piece", "pieces": "piece",
    "plic": "packet", "pliculet": "packet", "plicuri": "packet",
    "cookies": "cookie", "biscuits": "biscuit", "bars": "bar", "cans": "can", "bottles": "bottle",
}
# Mass and volume units: a serving size of just "30 g" or "250 ml" is one serving of that much.
_MEASURE_WORDS = {"g", "gr", "gram", "grams", "grame", "kg", "ml", "l", "cl", "dl"}
# "1 cookie (12.5 g)", "2 slices (50 g)", "1 portion (100 g)".
_COUNTED_RE = re.compile(r"^\s*(?P<count>\d+(?:[.,]\d+)?)?\s*(?P<word>[^\d(]+?)\s*\(")


def servings(row: dict[str, str]) -> list[dict]:
    """The product's one serving size as a unit: "1 cookie (12.5 g)" -> cookie, 12.5 g.

    A plain "serving" is only kept for prepared dishes (`_PREPARED_TAGS`).

    `serving_quantity` is the serving's grams (or ml, read as grams like everything here
    per 100 ml). A size that is only a weight, "30 g", becomes "serving (30 g)".
    """
    text = (row.get("serving_size") or "").strip()
    try:
        grams = float((row.get("serving_quantity") or "").replace(",", "."))
    except ValueError:
        return []
    if not text or grams <= 0:
        return []
    counted = _COUNTED_RE.match(text)
    word = counted.group("word").strip().lower() if counted else ""
    prepared = bool(_PREPARED_TAGS & set((row.get("categories_tags") or "").split(",")))
    if counted and word and word not in _MEASURE_WORDS:
        count = float((counted.group("count") or "1").replace(",", "."))
        unit = "serving" if word in _SERVING_WORDS else _UNIT_WORDS.get(word, word)
        if unit == "serving" and not prepared:
            return []
        size = text[text.index("("):].strip()
        return [{"unit": unit, "label": f"1 {unit} {size}" if count == 1 else f"{text}", "grams": grams / count}]
    return [{"unit": "serving", "label": f"1 serving ({text})", "grams": grams}] if prepared else []


def package_serving(row: dict[str, str]) -> dict | None:
    """The serving the label states, as printed, whatever kind of product it is."""
    text = (row.get("serving_size") or "").strip()
    try:
        grams = float((row.get("serving_quantity") or "").replace(",", "."))
    except ValueError:
        return None
    return {"label": text, "grams": grams} if text and grams > 0 else None


def kitchen_servings(row: dict[str, str]) -> list[dict]:
    """The measures that make sense for the product (app/services/ingest/servings.py): its own
    serving size, egg sizes for eggs, a typical slice for cheese, bread and deli meat, and the
    kitchen measures its kind is taken in — measured, or estimated from a typical density."""
    categories, name = row.get("categories_tags") or "", row.get("product_name") or ""
    own = [*servings(row), *typical_slices(categories, name)]
    if is_whole_egg(categories, name):
        own = with_egg_sizes(own, name)
    measured = measured_kind(categories, row.get("serving_size") or "", name)
    return with_kitchen_measures(own, measured, estimate=None if measured else estimated_kind(categories, name))


def product_url(code: str) -> str:
    return f"https://world.openfoodfacts.org/product/{code}"


def row_to_raw(row: dict[str, str]) -> dict | None:
    """One export row as a raw food record, or None without a name in a supported language
    or without nutrition."""
    name = supported_language_name(clean_display_name(without_pack_size((row.get("product_name") or "").strip())))
    if not name or row.get("no_nutrition_data") == "on":
        return None

    brand = (row.get("brands") or "").split(",")[0].strip() or None
    store = store_from_list(row.get("stores") or "")
    kcal, kj = _value(row, "energy-kcal_100g"), _value(row, "energy-kj_100g")
    raw: dict = {
        # The brand and store have fields of their own; in the name they would show twice.
        "name": without_brand(without_brand(name, brand), store),
        "brand": brand,
        "store": store,
        "servings": kitchen_servings(row),
        "package_serving": package_serving(row),
        "basis": PER_100G,
        "serving_grams": None,
        "calories": f"{kcal} kcal" if kcal else f"{kj} kJ" if kj else None,
    }
    for key, column in (*_CORE.items(), *_EXTRA.items()):
        value = _value(row, column)
        raw[key] = f"{value} g" if value else None
    return raw


def _value(row: dict[str, str], column: str) -> str | None:
    value = (row.get(column) or "").strip()
    return value or None
