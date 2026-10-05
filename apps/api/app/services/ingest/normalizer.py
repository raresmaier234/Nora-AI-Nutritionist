"""Turns a raw extraction into a validated per-100g food, or rejects it.

The extraction model reports what a page *says*, verbatim. Everything numeric happens here:
unit conversion, rebasing per-serving figures onto 100g, and a plausibility check.

That split is deliberate and load-bearing. Benchmarked on llama3.2, the model extracts
already-per-100g labels accurately but fails at arithmetic — and fails silently, returning
`calories: 0` for a label stating 2000 kJ. A zero looks like data; it is not. The Atwater
check below is what catches that class of error.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from app.utils.naming import normalize_name
from app.services.ingest.measures import (
    GRAM,
    KCAL,
    MICROGRAM,
    MILLIGRAM,
    Measurement,
    parse_measurement,
    to_grams,
    to_kcal,
    to_milligrams,
)
from app.services.ingest.nutrients import EXTRA_NUTRIENTS

logger = logging.getLogger(__name__)

# Energy per gram of macronutrient. The basis of the cross-check below.
_KCAL_PER_G_PROTEIN = Decimal(4)
_KCAL_PER_G_CARB = Decimal(4)
_KCAL_PER_G_FAT = Decimal(9)
_KCAL_PER_G_ALCOHOL = Decimal(7)

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
    # The rest of the profile, keyed by `foods` column: {"leucine_per_100g": Decimal(...)}.
    extra: dict[str, Decimal] = field(default_factory=dict)


def atwater_kcal(
    protein_g: Decimal | None,
    carbs_g: Decimal | None,
    fat_g: Decimal | None,
    alcohol_g: Decimal | None = None,
) -> Decimal | None:
    """Energy implied by the macronutrients, or None if none were reported."""
    if protein_g is None and carbs_g is None and fat_g is None:
        return None

    return (
        _KCAL_PER_G_PROTEIN * (protein_g or Decimal(0))
        + _KCAL_PER_G_CARB * (carbs_g or Decimal(0))
        + _KCAL_PER_G_FAT * (fat_g or Decimal(0))
        # Beer's energy is mostly alcohol. Left out, every alcoholic drink fails the check.
        + _KCAL_PER_G_ALCOHOL * (alcohol_g or Decimal(0))
    )


def check_atwater(
    calories: Decimal | None,
    protein_g: Decimal | None,
    carbs_g: Decimal | None,
    fat_g: Decimal | None,
    alcohol_g: Decimal | None = None,
) -> None:
    """Raise NormalizationError when declared energy contradicts the macronutrients.

    Skipped when either side is unknown, or when the food is genuinely near-zero energy.
    """
    implied = atwater_kcal(protein_g, carbs_g, fat_g, alcohol_g)
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


# Physical ceilings for 100g of anything. Pure fat is ~900 kcal, and 100g of food cannot
# hold more than 100g of any one nutrient. The Atwater ratio cannot see a row where every
# value is off by the same factor (a misread serving weight, a thousands separator read as
# a decimal point), but that error almost always pushes a value past one of these limits.
_MAX_KCAL_PER_100G = Decimal(950)
_MAX_GRAMS_PER_100G = Decimal(101)  # 1g of slack for rounded labels
_MAX_MACROS_PER_100G = Decimal(105)
# Table salt is ~39g sodium per 100g; nothing edible holds more.
_MAX_SODIUM_MG_PER_100G = Decimal(40_000)


def check_bounds(
    calories: Decimal | None, grams: dict[str, Decimal | None], sodium_mg: Decimal | None
) -> None:
    """Raise NormalizationError when a per-100g value is physically impossible."""
    if calories is not None and calories > _MAX_KCAL_PER_100G:
        raise NormalizationError(f"{calories} kcal per 100g is not physically possible")

    for field, value in grams.items():
        if value is not None and value > _MAX_GRAMS_PER_100G:
            raise NormalizationError(f"{value}g of {field} per 100g is not physically possible")

    macros = sum(grams.get(key) or Decimal(0) for key in ("protein", "fat", "carbs"))
    if macros > _MAX_MACROS_PER_100G:
        raise NormalizationError(f"macronutrients add up to {macros}g per 100g")

    if sodium_mg is not None and sodium_mg > _MAX_SODIUM_MG_PER_100G:
        raise NormalizationError(f"{sodium_mg}mg of sodium per 100g is not physically possible")


# Rebasing divides by a serving weight, which produces repeating decimals: a 43g serving
# turns 3.6g of protein into 8.37209302325581g. Three places is already finer than any
# label prints, and keeps the stored value honest about how precise the source was.
_QUANTUM = Decimal("0.001")


def _rebase(value: Decimal | None, factor: Decimal | None) -> Decimal | None:
    if value is None or factor is None:
        return None
    try:
        return (value * factor).quantize(_QUANTUM).normalize()
    except InvalidOperation:
        # A value too long to quantize (the model copied a product code, say). Raised as
        # a NormalizationError so it rejects the food instead of crashing the run.
        raise NormalizationError(f"value {value} is not a plausible measurement") from None


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

    check_bounds(
        calories,
        {
            "protein": protein,
            "fat": fat,
            "carbs": carbs,
            "fiber": fiber,
            "sugar": sugar,
            "saturated_fat": saturated_fat,
        },
        sodium_mg,
    )
    # A food is only worth storing with its full macro profile: the app computes meals from
    # these four, and a row missing one silently counts as zero. Fibre, sugar, saturated fat
    # and sodium stay optional — many sites never print them.
    missing = [
        field
        for field, value in (
            ("calories", calories),
            ("protein", protein),
            ("fat", fat),
            ("carbs", carbs),
        )
        if value is None
    ]
    if missing:
        raise NormalizationError(f"missing required values: {', '.join(missing)}")

    extra = _extra_nutrients(raw, factor)
    check_atwater(calories, protein, carbs, fat, extra.get("alcohol_per_100g"))

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
        extra=extra,
    )


# Grams in one of each unit, to express a converted value in its column's unit.
_PER_GRAM = {GRAM: Decimal(1), MILLIGRAM: Decimal(1000), MICROGRAM: Decimal(1_000_000)}


def _extra_nutrients(raw: dict, factor: Decimal) -> dict[str, Decimal]:
    """Convert every full-profile nutrient present in `raw` to its column's unit, per 100g.

    A bare number is read in the column's own unit. An impossible value — more than 100g
    of anything in 100g of food — is dropped rather than rejecting the whole food: one bad
    micronutrient should not cost a food whose label is otherwise sound.
    """
    extra: dict[str, Decimal] = {}
    for nutrient in EXTRA_NUTRIENTS:
        grams = to_grams(parse_measurement(raw.get(nutrient.key)), assume=nutrient.unit)
        if grams is None:
            continue
        try:
            value = _rebase(grams * _PER_GRAM[nutrient.unit], factor)
        except NormalizationError:
            value = None
        if value is None or value / _PER_GRAM[nutrient.unit] > _MAX_GRAMS_PER_100G:
            logger.info("dropping implausible %s for %r", nutrient.key, raw.get("name"))
            continue
        extra[nutrient.column] = value
    return extra
