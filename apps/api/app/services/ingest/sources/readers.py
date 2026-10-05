"""Readers for sites that publish nutrition as structured data instead of a visible table.

A reader turns one page's HTML into raw food records — the same verbatim-string shape the
model returns, so everything downstream (units, bounds, Atwater, dedup) is shared. Unlike
the model, a reader cannot invent a value: it copies fields the site labelled itself.

A site uses one by naming it in sites.toml (`reader = "freshful"`).
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable

from bs4 import BeautifulSoup

from app.services.ingest.extractor import field_for_label, fill_from_labels, nutrition_panel
from app.services.ingest.normalizer import PER_100G, PER_SERVING

# The Next.js page state that carries a product's data on server-rendered pages.
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(?P<json>.*?)</script>', re.DOTALL | re.IGNORECASE
)

# The unit a Freshful label carries in parentheses: "Energie (kcal)", "Grasimi (grame)".
_LABEL_UNIT_RE = re.compile(r"\((?P<unit>[^)]*)\)")
_UNITS = {"kcal": "kcal", "kj": "kJ", "grame": "g", "g": "g", "mg": "mg"}

# A nested row belongs to its parent's nutrient: "din care zaharuri" under carbohydrates is
# sugar, "din care saturate" under fat is saturated fat.
_CHILD_FIELDS = {"fat": "saturated_fat", "carbs": "sugar"}


def read_freshful(html: str) -> list[dict]:
    """freshful.ro: the nutrition table sits in the page's Next.js data, per 100g.

    Each row is {"name": "Grasimi (grame)", "value": "2.5", "children": [...]}. The row
    labelled "Sare / Sodium" holds salt, as EU labels require; it is converted to sodium
    by the EU's own definition (salt = sodium x 2.5) rather than stored as if it were one.
    """
    match = _NEXT_DATA_RE.search(html)
    if match is None:
        return []
    try:
        data = json.loads(match.group("json"))
    except json.JSONDecodeError:
        return []

    rows = [row for table in _nested_tables(data) for row in table.get("attributes", [])]
    if not rows:
        return []  # not a food: detergent, salt, tea without a declaration

    food: dict = {"name": _page_heading(html), "basis": PER_100G, "serving_grams": None}
    for row in rows:
        label = str(row.get("name", ""))
        if re.match(r"\s*sare\b", label, re.IGNORECASE):
            salt = _number(row.get("value"))
            if salt is not None and food.get("sodium") is None:
                food["sodium"] = salt * _SODIUM_MG_PER_G_SALT
            continue
        field = field_for_label(label)
        if field is None:
            continue
        _set(food, field, row)
        for child in row.get("children") or []:
            if field in _CHILD_FIELDS:
                _set(food, _CHILD_FIELDS[field], child, unit_from=row)

    return [food] if food["name"] else []


# Sodium is 40% of salt by weight: 1g of salt holds 400mg of sodium.
_SODIUM_MG_PER_G_SALT = 400.0


def _number(value: object) -> float | None:
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def _set(food: dict, field: str, row: dict, *, unit_from: dict | None = None) -> None:
    value = str(row.get("value", "")).strip()
    if not value or not re.search(r"\d", value):
        return
    unit = _unit(str((unit_from or row).get("name", "")))
    if field == "calories" and unit == "g":
        unit = None  # an unlabelled energy row is read as kcal downstream
    reading = f"{value} {unit}" if unit else value
    # kcal wins over kJ when a site gives both; the first mass reading of a field wins.
    if field == "calories" and food.get("calories") and "kcal" in food["calories"]:
        return
    if field != "calories" and food.get(field):
        return
    food[field] = reading


def _unit(label: str) -> str | None:
    match = _LABEL_UNIT_RE.search(label)
    if match:
        return _UNITS.get(match.group("unit").strip().lower())
    return "g"  # an unlabelled mass row ("Proteine", "Fibre") is in grams


def _nested_tables(node: object):
    if isinstance(node, dict):
        if node.get("type") == "nestedTable":
            yield node
        for value in node.values():
            yield from _nested_tables(value)
    elif isinstance(node, list):
        for value in node:
            yield from _nested_tables(value)


def _page_heading(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for selector in ("h1", "title"):
        found = soup.find(selector)
        if found and found.get_text(strip=True):
            return found.get_text(strip=True).split(" | ")[0]
    return ""


# EatThisMuch's record keys for the full profile, mapped onto ours. Units already match:
# checked value by value against the page's own visible table, and against USDA for the
# fields that table leaves out (water, alcohol).
_EATTHISMUCH_KEYS = {
    **{key: key for key in (
        "starch", "sucrose", "glucose", "fructose", "lactose", "maltose", "galactose",
        "cholesterol", "tryptophan", "threonine", "isoleucine", "leucine", "lysine",
        "methionine", "cystine", "phenylalanine", "tyrosine", "valine", "arginine",
        "histidine", "alanine", "aspartic_acid", "glutamic_acid", "glycine", "proline",
        "serine", "hydroxyproline", "retinol", "beta_carotene", "alpha_carotene", "lycopene",
        "folate", "riboflavin", "niacin", "pantothenic_acid", "choline", "betaine",
        "calcium", "iron", "magnesium", "phosphorus", "potassium", "zinc", "copper",
        "manganese", "selenium", "fluoride", "water", "alcohol", "caffeine", "theobromine",
    )},
    "monounsaturated_fats": "monounsaturated_fat",
    "polyunsaturated_fats": "polyunsaturated_fat",
    "trans_fats": "trans_fat",
    "total_omega_3": "omega_3",
    "total_omega_6": "omega_6",
    "ala_fatty_acid": "ala",
    "epa_fatty_acid": "epa",
    "dha_fatty_acid": "dha",
    "dpa_fatty_acid": "dpa",
    "vit_a": "vitamin_a",
    "vit_d": "vitamin_d",
    "vit_d2": "vitamin_d2",
    "vit_d3": "vitamin_d3",
    "vit_k": "vitamin_k",
    "vit_b12": "vitamin_b12",
    "vit_c": "vitamin_c",
    "vit_e": "vitamin_e",
    "vit_b6": "vitamin_b6",
    "thiamine": "thiamin",
}

_CANONICAL_ID_RE = re.compile(r'<link rel="canonical" href="[^"]*-(?P<id>\d+)"')


def read_eatthismuch(html: str) -> list[dict]:
    """eatthismuch.com: the full profile, from the food record the page embeds as data.

    The visible table is rounded for one serving — "Leucine 1g" in 28g of brie — and
    scaling that to 100g would claim 3.6g where the true figure is 1.9g. The embedded
    record carries the same values unrounded (1.929g once scaled, exactly USDA's figure),
    for a stated gram weight the normalizer rebases from.

    The page also embeds records for similar foods; the food's own is found by the ID in
    its canonical URL. Values are passed on as numbers, never text, so no digit grouping
    rule can misread 1.234mg of iron as 1234.
    """
    match = _CANONICAL_ID_RE.search(html)
    if match is None:
        return []
    block = re.search(
        rf'data-url="/api/v1/food/{match.group("id")}/[^"]*"[^>]*>(?P<json>.*?)</script>',
        html,
        re.DOTALL,
    )
    if block is None:
        return []
    try:
        record = json.loads(json.loads(block.group("json"))["body"])["data"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return []
    if record.get("deleted"):
        return []

    grams = next(
        (w.get("amount") for w in record.get("weights") or [] if w.get("description") == "grams"),
        None,
    )
    if not grams or grams <= 0:
        return []  # no weight to scale from; its values cannot be put on a per-100g basis

    nutrition = record.get("nutrition") or {}
    food = {
        "name": _eatthismuch_name(record),
        "basis": PER_SERVING,
        "serving_grams": grams,
        "calories": record.get("calories"),
        "protein": record.get("proteins"),
        "fat": record.get("fats"),
        "carbs": record.get("carbs"),
        "fiber": nutrition.get("fiber", record.get("fiber")),
        "sugar": nutrition.get("sugar", record.get("sugar")),
        "saturated_fat": nutrition.get("saturated_fats", record.get("saturated_fats")),
        "sodium": nutrition.get("sodium", record.get("sodium")),
    }
    for source_key, key in _EATTHISMUCH_KEYS.items():
        if nutrition.get(source_key) is not None:
            food[key] = nutrition[source_key]
    return [food] if food["name"] else []


def _eatthismuch_name(record: dict) -> str:
    """Brand, name and description: "Long John Silver's Salmon", "Milk, low-sodium".

    The bare name is not enough — the site has several foods called just "Salmon".
    """
    name = str(record.get("food_name") or "").strip()
    brand = str(record.get("manufactured_by") or "").strip()
    if brand and brand.lower() not in name.lower():
        name = f"{brand} {name}"
    description = str(record.get("description") or "").strip()
    if description and description.lower() not in name.lower():
        name = f"{name}, {description}"
    return name


def read_oneden(html: str) -> list[dict]:
    """calorii.oneden.com: three columns per food — 100, 200 and 300 grame.

    The 100 grame column is selected by its header. Choosing by any other rule is unsafe:
    the 200g column can be the *shorter* text (1.5 doubles to 3), and reading it would store
    every value twice over while passing every consistency check.
    """
    soup = BeautifulSoup(html, "html.parser")
    column = next(
        (
            col
            for col in soup.select("div.aliment-detail-column")
            if re.fullmatch(r"\s*100\s*grame\s*", _text(col.select_one(".aliment-column-header")))
        ),
        None,
    )
    if column is None:
        return []

    title = _text(soup.title)
    name = re.sub(r"^\s*Calorii\s+", "", title, flags=re.IGNORECASE).strip()
    food = _empty_food(name)
    for row in column.select(".nutrition-row"):
        field = field_for_label(_text(row.select_one(".nutrition-label")))
        value = _text(row.select_one(".nutrition-value"))
        if field is not None and re.search(r"\d", value) and food.get(field) is None:
            food[field] = value  # bare numbers: kcal for energy, grams for the rest
    return [food] if name else []


def read_kaufland(html: str) -> list[dict]:
    """kaufland.ro food encyclopedia: "Valoare nutritivă" as label/value paragraphs.

    Values are per 100g though the page never says so. The name is the page heading up to
    its colon ("Kiwi: fructul tropical pufos" -> "Kiwi"), copied rather than retyped — the
    model used to mangle Romanian letters, turning "Gălbenuș" into "Gôbenuș".
    """
    panel = nutrition_panel(html)
    if panel is None:
        return []  # a category page: a list of foods, no table
    soup = BeautifulSoup(html, "html.parser")
    name = _text(soup.find("h1")).split(":")[0].strip()
    if not name:
        return []
    return fill_from_labels([_empty_food(name)], panel)


def _empty_food(name: str) -> dict:
    return {
        "name": name,
        "basis": PER_100G,
        "serving_grams": None,
        **{
            field: None
            for field in (
                "calories", "protein", "fat", "saturated_fat", "carbs", "fiber", "sugar", "sodium"
            )
        },
    }


def _text(element) -> str:
    return element.get_text(" ", strip=True) if element is not None else ""


READERS: dict[str, Callable[[str], list[dict]]] = {
    "eatthismuch": read_eatthismuch,
    "freshful": read_freshful,
    "kaufland": read_kaufland,
    "oneden": read_oneden,
}
