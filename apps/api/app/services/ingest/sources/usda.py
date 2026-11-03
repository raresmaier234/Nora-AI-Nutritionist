"""USDA FoodData Central: generic foods with their full nutrient profile, in English.

Two of its datasets, both public domain (CC0) and published as JSON:

- Foundation Foods: ~400 foods from current lab analysis, updated twice a year.
- SR Legacy: ~7,800 foods, the classic USDA reference, frozen since 2018.

Values are per 100 g. Nutrients are matched by their USDA number ("203" is protein), which
is stable across releases, unlike the names. Energy is "208" where present; Foundation Foods
often gives only the Atwater-factor estimates ("958" specific, "957" general).
"""

from __future__ import annotations

import re
from collections.abc import Iterator

from app.services.ingest.normalizer import PER_100G
from app.services.ingest.servings import estimated_usda_kind, with_kitchen_measures

DATASETS = {
    "foundation": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-10-29.zip",
    "sr_legacy": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip",
}

_ENERGY_KCAL = ("208", "958", "957")

# Our raw key -> USDA nutrient number.
_NUMBERS = {
    "protein": "203",
    "fat": "204",
    "carbs": "205",
    "fiber": "291",
    "sugar": "269",
    "saturated_fat": "606",
    "sodium": "307",
    "starch": "209",
    "sucrose": "210",
    "glucose": "211",
    "fructose": "212",
    "lactose": "213",
    "maltose": "214",
    "galactose": "287",
    "monounsaturated_fat": "645",
    "polyunsaturated_fat": "646",
    "trans_fat": "605",
    "ala": "851",
    "epa": "629",
    "dha": "621",
    "dpa": "631",
    "cholesterol": "601",
    "tryptophan": "501",
    "threonine": "502",
    "isoleucine": "503",
    "leucine": "504",
    "lysine": "505",
    "methionine": "506",
    "cystine": "507",
    "phenylalanine": "508",
    "tyrosine": "509",
    "valine": "510",
    "arginine": "511",
    "histidine": "512",
    "alanine": "513",
    "aspartic_acid": "514",
    "glutamic_acid": "515",
    "glycine": "516",
    "proline": "517",
    "serine": "518",
    "hydroxyproline": "521",
    "vitamin_a": "320",  # RAE, µg
    "retinol": "319",
    "beta_carotene": "321",
    "alpha_carotene": "322",
    "lycopene": "337",
    "vitamin_d": "328",  # D2 + D3, µg
    "vitamin_d2": "325",
    "vitamin_d3": "326",
    "vitamin_k": "430",
    "folate": "417",  # total
    "vitamin_b12": "418",
    "vitamin_c": "401",
    "vitamin_e": "323",  # alpha-tocopherol
    "thiamin": "404",
    "riboflavin": "405",
    "niacin": "406",
    "pantothenic_acid": "410",
    "vitamin_b6": "415",
    "choline": "421",
    "betaine": "454",
    "calcium": "301",
    "iron": "303",
    "magnesium": "304",
    "phosphorus": "305",
    "potassium": "306",
    "zinc": "309",
    "copper": "312",
    "fluoride": "313",
    "manganese": "315",
    "selenium": "317",
    "water": "255",
    "alcohol": "221",
    "caffeine": "262",
    "theobromine": "263",
}

# USDA unit names as our parser reads them. IU is left out: every vitamin it is used for
# also has a mass value.
_UNITS = {"g": "g", "mg": "mg", "µg": "ug", "kcal": "kcal"}


# USDA's unit words, as the app shows them. Weights in oz and lb are left out: the app offers
# both for every food. "RACC" is the FDA's reference amount for one serving.
_UNIT_NAMES = {
    "tablespoon": "tbsp",
    "teaspoon": "tsp",
    "racc": "serving",
    "nlea serving": "serving",
    "serving, nlea": "serving",
    "fluid ounce": "fl oz",
}
_SKIPPED_UNITS = {"oz", "lb", "g", "gram", "grams", "cubic inch", "undetermined"}


# "Serving" only means something for a prepared dish (a burger, a meal); for an ingredient
# it's an arbitrary amount, and grams, cups or pieces say it better.
_PREPARED_CATEGORIES = {"fast foods", "restaurant foods", "meals, entrees, and side dishes"}


def _servings(food: dict) -> list[dict]:
    """The food's USDA portions as units with the grams one weighs, in USDA's own order.

    {"amount": 4, "modifier": "large", "gramWeight": 30} becomes {"unit": "large", "grams": 7.5};
    {"amount": 1, "modifier": "cup, chopped", "gramWeight": 160} becomes "cup, chopped".
    """
    servings = []
    prepared = ((food.get("foodCategory") or {}).get("description") or "").lower() in _PREPARED_CATEGORIES
    portions = sorted(food.get("foodPortions") or [], key=lambda p: p.get("sequenceNumber") or 0)
    for portion in portions:
        measure = ((portion.get("measureUnit") or {}).get("name") or "").strip()
        text = measure if measure.lower() not in ("", "undetermined") else (portion.get("modifier") or "")
        if measure and measure.lower() not in ("undetermined", "racc") and portion.get("modifier"):
            text = f"{measure}, {portion['modifier']}"  # Foundation: "cup" + "chopped"
        # "piece (1/8 of 9\" dia)" keeps its detail in the label; the unit is "piece".
        unit = re.sub(r"\s*\(.*$", "", text).strip(" ,").lower()
        unit = _UNIT_NAMES.get(unit, unit)
        amount, grams = portion.get("amount") or 1, portion.get("gramWeight")
        if not unit or unit in _SKIPPED_UNITS or not grams or amount <= 0 or (unit == "serving" and not prepared):
            continue
        detail = text[len(re.sub(r"\s*\(.*$", "", text)):].strip()
        label = f"1 {unit}" + (f" {detail}" if detail else "")
        servings.append({"unit": unit, "label": label, "grams": grams / amount})
    return servings


def _poured(food: dict) -> bool:
    """Drinks and liquid milks, which are also measured in ml."""
    name = (food.get("description") or "").lower()
    category = ((food.get("foodCategory") or {}).get("description") or "").lower()
    solid = any(word in name for word in ("dry", "powder", "condensed", "evaporated"))
    return not solid and (category == "beverages" or name.startswith("milk,"))


def foods(data: dict) -> Iterator[dict]:
    """The food records in a dataset file, whichever dataset it is."""
    for key in ("FoundationFoods", "SRLegacyFoods"):
        yield from data.get(key, [])


def food_url(fdc_id: int) -> str:
    return f"https://fdc.nal.usda.gov/food-details/{fdc_id}/nutrients"


def food_to_raw(food: dict) -> dict | None:
    """One USDA food as a raw food record, or None when it has no name."""
    name = (food.get("description") or "").strip()
    if not name:
        return None

    readings: dict[str, str] = {}
    for entry in food.get("foodNutrients") or []:
        nutrient = entry.get("nutrient") or {}
        unit = _UNITS.get(nutrient.get("unitName") or "")
        number, amount = nutrient.get("number"), entry.get("amount")
        if unit and number and amount is not None and number not in readings:
            readings[number] = f"{amount} {unit}"

    raw: dict = {
        "name": name,
        "basis": PER_100G,
        "serving_grams": None,
        "servings": with_kitchen_measures(
            _servings(food),
            poured=_poured(food),
            estimate=estimated_usda_kind((food.get("foodCategory") or {}).get("description") or ""),
        ),
        "calories": next((readings[n] for n in _ENERGY_KCAL if n in readings), None),
    }
    for key, number in _NUMBERS.items():
        raw[key] = readings.get(number)
    return raw
