"""Parsing of nutrition measurements written as free text.

Real nutrition labels write the same quantity a dozen ways — `"372kcal"`, `" 502 Calories"`,
`"3 grams protein"`, `"1560 kJ"`, `"0.01g"`, or a bare `"272.8"`. This module turns any of
those into a value plus a canonical unit.

Everything here is pure and deterministic. Unit conversion lives on this side of the system
rather than in the extraction model, which is measurably unreliable at arithmetic.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

# Canonical units this module emits.
KCAL = "kcal"
KJ = "kj"
GRAM = "g"
MILLIGRAM = "mg"
MICROGRAM = "ug"

_UNIT_ALIASES = {
    "kcal": KCAL,
    "cal": KCAL,
    "cals": KCAL,
    "calorie": KCAL,
    "calories": KCAL,
    "kj": KJ,
    "kilojoule": KJ,
    "kilojoules": KJ,
    "g": GRAM,
    "gm": GRAM,
    "gms": GRAM,
    "gr": GRAM,
    "gram": GRAM,
    "grams": GRAM,
    "gramme": GRAM,
    "grammes": GRAM,
    "mg": MILLIGRAM,
    "milligram": MILLIGRAM,
    "milligrams": MILLIGRAM,
    "mcg": MICROGRAM,
    "ug": MICROGRAM,
    "microgram": MICROGRAM,
    "micrograms": MICROGRAM,
}

# A number, then optionally a unit word. The unit may be glued to the number ("334kcal"),
# separated ("334 kcal"), or absent entirely ("272.8").
_MEASUREMENT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*([a-zA-Zµ]+)?")

_KJ_PER_KCAL = Decimal("4.184")


@dataclass(frozen=True)
class Measurement:
    """A parsed quantity. `unit` is None when the source stated no unit."""

    value: Decimal
    unit: str | None


def parse_measurement(raw: object) -> Measurement | None:
    """Parse the first quantity in `raw`, or None if there isn't one.

    Numbers arrive as JSON numbers about as often as strings, so both are accepted.
    Only the first quantity is read: labels like `"13g fat (1g saturated fat)"` carry a
    second nutrient in parentheses, and that belongs to a different field.
    """
    if raw is None:
        return None

    if isinstance(raw, bool):  # bool is an int subclass; never a measurement
        return None

    if isinstance(raw, (int, float, Decimal)):
        return Measurement(value=Decimal(str(raw)), unit=None)

    if not isinstance(raw, str):
        return None

    match = _MEASUREMENT_RE.search(raw.replace("µ", "u"))
    if match is None:
        return None

    try:
        value = Decimal(match.group(1).replace(",", "."))
    except InvalidOperation:
        return None

    unit_word = (match.group(2) or "").lower()
    return Measurement(value=value, unit=_UNIT_ALIASES.get(unit_word))


def to_kcal(measurement: Measurement | None, *, assume: str = KCAL) -> Decimal | None:
    """Convert an energy measurement to kilocalories.

    `assume` supplies the unit when the source stated none — labels frequently print a
    bare number in a column already headed "kcal".
    """
    if measurement is None:
        return None

    unit = measurement.unit or assume
    if unit == KCAL:
        return measurement.value
    if unit == KJ:
        return measurement.value / _KJ_PER_KCAL
    return None


def to_grams(measurement: Measurement | None, *, assume: str = GRAM) -> Decimal | None:
    """Convert a mass measurement to grams."""
    if measurement is None:
        return None

    unit = measurement.unit or assume
    if unit == GRAM:
        return measurement.value
    if unit == MILLIGRAM:
        return measurement.value / Decimal(1000)
    if unit == MICROGRAM:
        return measurement.value / Decimal(1_000_000)
    return None


def to_milligrams(measurement: Measurement | None, *, assume: str = MILLIGRAM) -> Decimal | None:
    """Convert a mass measurement to milligrams."""
    grams = to_grams(measurement, assume=assume)
    return None if grams is None else grams * Decimal(1000)
