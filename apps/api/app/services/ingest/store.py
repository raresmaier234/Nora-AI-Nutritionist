"""Persistence and deduplication for ingested foods.

Uniqueness is enforced in two layers. `foods.name_normalized` carries a unique constraint,
so an exact duplicate cannot be written whatever the caller does. Above that, trigram
similarity catches near-duplicates — "plain flour" against "plain white flour" — which no
constraint can express.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.services.ingest.normalizer import NormalizedFood

logger = logging.getLogger(__name__)

# Trigram similarity above which two names become *candidates* for being the same food.
#
# Deliberately low, because similarity cannot decide this question on its own. Measured on
# real product names: "nutella" vs "nutella ferrero" — the same product — scores 0.50, while
# "coca cola" vs "coca cola zero" — different products — scores 0.615. Any threshold that
# catches the first also catches the second. So this gate is tuned for recall and the
# decision is deferred to review; raising it only loses true duplicates.
SIMILARITY_THRESHOLD = 0.45

_NUTRIENT_COLUMNS = (
    "calories_per_100g",
    "protein_per_100g",
    "fat_per_100g",
    "carbs_per_100g",
    "fiber_per_100g",
    "sugar_per_100g",
    "saturated_fat_per_100g",
    "sodium_mg_per_100g",
)


@dataclass(frozen=True)
class SimilarFood:
    id: int
    name: str
    similarity: float


@dataclass(frozen=True)
class UpsertResult:
    food: Food
    created: bool
    # Near-duplicates found at insert time. Non-empty means a human (or a stronger model)
    # should decide whether these are really the same food.
    similar: list[SimilarFood]
    # A different page already stored a food under this exact name; this one was not
    # merged into it.
    name_taken: bool = False


def find_similar(
    db: Session, name_normalized: str, *, threshold: float = SIMILARITY_THRESHOLD, limit: int = 5
) -> list[SimilarFood]:
    """Return existing foods whose names are close to `name_normalized`.

    Uses pg_trgm; the GIN index on `name_normalized` keeps this off a sequential scan as
    the table grows past 100k rows.
    """
    rows = db.execute(
        text(
            """
            SELECT id, name, similarity(name_normalized, :name) AS score
            FROM foods
            WHERE name_normalized % :name
              AND name_normalized <> :name
            ORDER BY score DESC
            LIMIT :limit
            """
        ),
        {"name": name_normalized, "limit": limit},
    ).all()

    return [
        SimilarFood(id=row.id, name=row.name, similarity=float(row.score))
        for row in rows
        if float(row.score) >= threshold
    ]


def _is_richer(candidate: Decimal | None, existing: Decimal | None) -> bool:
    """Whether `candidate` adds information the stored row lacks."""
    return existing is None and candidate is not None


def upsert_food(
    db: Session,
    normalized: NormalizedFood,
    *,
    source_url: str | None = None,
    raw_extraction: dict[str, Any] | None = None,
    check_similar: bool = True,
) -> UpsertResult:
    """Insert `normalized`, or enrich the existing row with the same normalized name.

    Re-ingesting a food never duplicates it and never discards known values: an existing
    row keeps what it has and only gains fields it was missing. Does not commit — the
    caller controls the transaction boundary.
    """
    existing = db.execute(
        select(Food).where(Food.name_normalized == normalized.name_normalized)
    ).scalar_one_or_none()

    if existing is not None:
        # Only the same page may fill in a stored food. Sites reuse plain names for
        # different foods — EatThisMuch has several "Milk" and "Salmon" — and filling one
        # food's empty columns from another would build a row that matches neither.
        if existing.source_url and source_url and existing.source_url != source_url:
            logger.info(
                "%r from %s: name already stored from %s; not merged",
                normalized.name,
                source_url,
                existing.source_url,
            )
            return UpsertResult(food=existing, created=False, similar=[], name_taken=True)

        gained = False
        candidates = {column: getattr(normalized, column) for column in _NUTRIENT_COLUMNS}
        candidates.update(normalized.extra)
        for column, candidate in candidates.items():
            if _is_richer(candidate, getattr(existing, column)):
                setattr(existing, column, candidate)
                gained = True

        if existing.source_url is None and source_url is not None:
            existing.source_url = source_url
        if existing.raw_extraction is None and raw_extraction is not None:
            existing.raw_extraction = raw_extraction

        if gained:
            logger.debug("enriched existing food %s", existing.name_normalized)

        return UpsertResult(food=existing, created=False, similar=[])

    similar = find_similar(db, normalized.name_normalized) if check_similar else []

    food = Food(
        name=normalized.name,
        name_normalized=normalized.name_normalized,
        calories_per_100g=normalized.calories_per_100g,
        protein_per_100g=normalized.protein_per_100g,
        fat_per_100g=normalized.fat_per_100g,
        carbs_per_100g=normalized.carbs_per_100g,
        fiber_per_100g=normalized.fiber_per_100g,
        sugar_per_100g=normalized.sugar_per_100g,
        saturated_fat_per_100g=normalized.saturated_fat_per_100g,
        sodium_mg_per_100g=normalized.sodium_mg_per_100g,
        **normalized.extra,
        source_url=source_url,
        raw_extraction=raw_extraction,
        # Flagged rather than dropped: a near-duplicate is usually a real food with a name
        # worth reconciling, and deciding that automatically is how databases get polluted.
        needs_review=bool(similar),
    )
    db.add(food)
    db.flush()

    return UpsertResult(food=food, created=True, similar=similar)
