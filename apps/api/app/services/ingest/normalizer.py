"""Turns a raw extraction into a validated per-100g food, or rejects it.

The extraction model reports what a page *says*, verbatim. Everything numeric happens here:
unit conversion, rebasing per-serving figures onto 100g, and a plausibility check.

That split is deliberate and load-bearing. Benchmarked on llama3.2, the model extracts
already-per-100g labels accurately but fails at arithmetic — and fails silently, returning
`calories: 0` for a label stating 2000 kJ. A zero looks like data; it is not. The Atwater
check below is what catches that class of error.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.utils.naming import normalize_name
from app.services.ingest.measures import (
    GRAM,
    KCAL,
    Measurement,
    parse_measurement,
    to_grams,
    to_kcal,
    to_milligrams,
)

# Energy per gram of macronutrient. The basis of the cross-check below.
_KCAL_PER_G_PROTEIN = Decimal(4)
_KCAL_PER_G_CARB = Decimal(4)
_KCAL_PER_G_FAT = Decimal(9)

# How far declared energy may drift from the macros before the row is disbelieved.
# Wide enough for rounded labels, sugar alcohols, and fibre accounting; narrow enough to
# catch a fabricated or dropped value.
ATWATER_MIN_RATIO = Decimal("0.7")
ATWATER_MAX_RATIO = Decimal("1.3")

# Below this, a row carries too little energy for the ratio to mean anything (celery,
# black coffee, diet drinks) — the check is skipped rather than failed.
_ATWATER_FLOOR_KCAL = Decimal(20)

PER_100G = "per_100g"
PER_SERVING = "per_serving"


class NormalizationError(ValueError):
    """The extraction could not be turned into a trustworthy per-100g food."""


@dataclass(frozen=True)
class NormalizedFood:
    """A food expressed per 100g, having passed validation."""

    name: str
    name_normalized: str
    calories_per_100g: Decimal | None
    protein_per_100g: Decimal | None
    fat_per_100g: Decimal | None
    carbs_per_100g: Decimal | None
    fiber_per_100g: Decimal | None
    sugar_per_100g: Decimal | None
    saturated_fat_per_100g: Decimal | None
    sodium_mg_per_100g: Decimal | None


def atwater_kcal(
    protein_g: Decimal | None, carbs_g: Decimal | None, fat_g: Decimal | None
) -> Decimal | None:
    """Energy implied by the macronutrients, or None if none were reported."""
    if protein_g is None and carbs_g is None and fat_g is None:
        return None

    return (
        _KCAL_PER_G_PROTEIN * (protein_g or Decimal(0))
        + _KCAL_PER_G_CARB * (carbs_g or Decimal(0))
        + _KCAL_PER_G_FAT * (fat_g or Decimal(0))
    )


def check_atwater(
    calories: Decimal | None,
    protein_g: Decimal | None,
    carbs_g: Decimal | None,
    fat_g: Decimal | None,
) -> None:
    """Raise NormalizationError when declared energy contradicts the macronutrients.

    Skipped when either side is unknown, or when the food is genuinely near-zero energy.
    """
    implied = atwater_kcal(protein_g, carbs_g, fat_g)
    if calories is None or implied is None:
        return

    if implied < _ATWATER_FLOOR_KCAL and calories < _ATWATER_FLOOR_KCAL:
        return

    if implied <= 0:
        if calories > _ATWATER_FLOOR_KCAL:
            raise NormalizationError(
                f"declared {calories} kcal but macronutrients imply none"
            )
        return

    ratio = calories / implied
    if not (ATWATER_MIN_RATIO <= ratio <= ATWATER_MAX_RATIO):
        raise NormalizationError(
            f"declared {calories} kcal contradicts macronutrients "
            f"(implied {implied:.1f} kcal, ratio {ratio:.2f})"
        )


# Rebasing divides by a serving weight, which produces repeating decimals: a 43g serving
# turns 3.6g of protein into 8.37209302325581g. Three places is already finer than any
# label prints, and keeps the stored value honest about how precise the source was.
_QUANTUM = Decimal("0.001")


def _rebase(value: Decimal | None, factor: Decimal | None) -> Decimal | None:
    if value is None or factor is None:
        return None
    return (value * factor).quantize(_QUANTUM).normalize()


def normalize_food(raw: dict) -> NormalizedFood:
    """Build a validated per-100g food from one raw extraction.

    `raw` is the model's verbatim output: a name, a `basis` of per_100g or per_serving, an
    optional `serving_grams`, and nutrient values as the page wrote them.

    Raises NormalizationError when the food cannot be trusted — no name, a per-serving
    basis with no serving weight to rebase from, or energy that contradicts the macros.
    """
    name = (raw.get("name") or "").strip()
    if not name:
        raise NormalizationError("extraction has no food name")

    basis = raw.get("basis") or PER_100G
    if basis not in (PER_100G, PER_SERVING):
        raise NormalizationError(f"unknown nutrition basis {basis!r}")

    serving = to_grams(parse_measurement(raw.get("serving_grams")), assume=GRAM)

    # A stated serving weight contradicts a per-100g claim unless it *is* 100g. When both
    # appear, the weight is the more reliable signal: extractors reach for "per_100g" as a
    # default, but they only report a serving weight when the page actually printed one.
    #
    # This matters more than it looks. Serving-sized values mislabelled as per-100g are
    # scaled consistently across every nutrient, so the Atwater check passes at a perfect
    # 1.00 — it verifies internal consistency, not absolute scale. Without this guard a
    # 1oz cheese panel stores as 100 kcal/100g instead of 353, and nothing downstream
    # notices.
    if basis == PER_100G and serving is not None and not (95 <= serving <= 105):
        basis = PER_SERVING

    # Rebasing per-serving values onto 100g requires the serving's weight. Without it the
    # numbers are unusable — storing them as if per-100g would silently corrupt the table.
    factor = Decimal(1)
    if basis == PER_SERVING:
        if serving is None or serving <= 0:
            raise NormalizationError("per-serving values with no usable serving weight")
        factor = Decimal(100) / serving

    def mass(key: str) -> Decimal | None:
        return _rebase(to_grams(parse_measurement(raw.get(key)), assume=GRAM), factor)

    calories = _rebase(
        to_kcal(parse_measurement(raw.get("calories")), assume=KCAL), factor
    )
    protein = mass("protein")
    fat = mass("fat")
    carbs = mass("carbs")
    fiber = mass("fiber")
    sugar = mass("sugar")
    saturated_fat = mass("saturated_fat")
    sodium_mg = _rebase(
        to_milligrams(parse_measurement(raw.get("sodium"))), factor
    )

    if calories is None and protein is None and fat is None and carbs is None:
        raise NormalizationError("extraction carries no usable nutrition values")

    check_atwater(calories, protein, carbs, fat)

    return NormalizedFood(
        name=name,
        name_normalized=normalize_name(name),
        calories_per_100g=calories,
        protein_per_100g=protein,
        fat_per_100g=fat,
        carbs_per_100g=carbs,
        fiber_per_100g=fiber,
        sugar_per_100g=sugar,
        saturated_fat_per_100g=saturated_fat,
        sodium_mg_per_100g=sodium_mg,
    )
