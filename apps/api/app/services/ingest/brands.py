"""Brands, stores and pack sizes in product names, for imports that carry them as text."""

from __future__ import annotations

import re

from app.utils.naming import normalize_name

# Store names as written on Romanian products, and how to display them.
STORES = {
    "lidl": "Lidl",
    "kaufland": "Kaufland",
    "carrefour": "Carrefour",
    "auchan": "Auchan",
    "mega image": "Mega Image",
    "delhaize": "Mega Image",
    "profi": "Profi",
    "penny": "Penny",
    "cora": "Cora",
    "selgros": "Selgros",
    "metro": "Metro",
    "billa": "Billa",
}

# A pack size at the end of a name: "180g", "1,5 L", "6x330ml", "10 buc".
_PACK_SIZE_RE = re.compile(
    r"\s+(?:\d+\s*x\s*)?\d+(?:[.,]\d+)?\s*(?:g|gr|kg|mg|ml|cl|l|buc|bucati|bucăți)\.?$",
    re.IGNORECASE,
)


def without_pack_size(name: str) -> str:
    """"Snack cu sare 180g" -> "Snack cu sare".

    Values are per 100g, so every pack size of a product is the same food; with the size in
    the name, each would be stored and listed again.
    """
    return _PACK_SIZE_RE.sub("", name).strip() or name


def store_from_list(stores: str) -> str | None:
    """The first known store in a comma-separated list: "Carrefour, Mega Image" -> "Carrefour"."""
    for store in stores.split(","):
        if (known := STORES.get(store.strip().lower())) is not None:
            return known
    return None


def without_brand(name: str, brand: str | None) -> str:
    """The name without `brand` at its start or end: "Lapte Olympus" -> "Lapte".

    Sites often put the brand in the product name as well as in its own field, so the app
    would show it twice. Matching ignores case, accents and punctuation ("PRÉSIDENT" is
    "president"). A brand in the middle is left alone — cutting it out would garble the name
    ("Unt president 200 grame") — and so is a name that is only the brand ("Raffaello").
    """
    target = normalize_name(brand or "").split()
    words = name.split()
    if not target or len(words) < 2:
        return name
    for size in range(1, len(words)):
        if normalize_name(" ".join(words[:size])).split() == target:
            rest = words[size:]
            break
        if normalize_name(" ".join(words[-size:])).split() == target:
            rest = words[:-size]
            break
    else:
        return name
    return " ".join(rest).strip(" -–,:/") or name
