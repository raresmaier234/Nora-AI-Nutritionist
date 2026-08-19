"""Canonical name folding, shared by the ORM and the ingestion pipeline."""

import re
import unicodedata


def normalize_name(name: str) -> str:
    """Fold a display name into a dedup key.

    Case, accents, punctuation and spacing all vary between sites for the same food, and
    none of them distinguish one food from another: "Crème Fraîche", "Creme fraiche" and
    "CREME  FRAICHE" are one ingredient.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    collapsed = re.sub(r"[^a-z0-9]+", " ", stripped.casefold())
    return collapsed.strip()
