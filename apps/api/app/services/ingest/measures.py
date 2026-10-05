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

# A number with digit grouping: "2,000", "1.050", "1 530", "1,182.07". A separator counts
# as grouping only when exactly three digits follow it and the number does not start with
# 0, so "1,53" and "0.333" still read as decimals. The same separator must repeat between
# groups; a different one after the last group is the decimal point.
_GROUPED = (
    r"(?P<int>[1-9]\d{0,2}(?P<sep>[,.   ])\d{3}(?!\d)(?:(?P=sep)\d{3}(?!\d))*)"
    r"(?P<frac>[.,]\d+)?"
)
_PLAIN = r"(?P<plain>\d+(?:[.,]\d+)?)"

# A number, then optionally a unit word. The unit may be glued to the number ("334kcal"),
# separated ("334 kcal"), or absent entirely ("272.8").
_MEASUREMENT_RE = re.compile(rf"(?:{_GROUPED}|{_PLAIN})\s*(?P<unit>[a-zA-Zµ]+)?")

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

    unit = _UNIT_ALIASES.get((match.group("unit") or "").lower())

    if match.group("int") and not _is_ambiguous_decimal(match, unit):
        # Grouping separators carry no value; reading them as a decimal point stores
        # "2,000 mg" of sodium as 2 mg.
        digits = match.group("int").replace(match.group("sep"), "")
        digits += (match.group("frac") or "").replace(",", ".")
    else:
        digits = (match.group("int") or match.group("plain")).replace(",", ".")

    try:
        value = Decimal(digits)
    except InvalidOperation:
        return None

    return Measurement(value=value, unit=unit)


# Units whose values labels print as whole numbers. For these, "1,050 kJ" can only mean
# a thousand and fifty; for grams it could as well be 1.05 written with three decimals.
_WHOLE_NUMBER_UNITS = frozenset({KCAL, KJ, MILLIGRAM, MICROGRAM})


def _is_ambiguous_decimal(match: re.Match, unit: str | None) -> bool:
    """Whether a single ",ddd" / ".ddd" group should be read as a decimal after all.

    "1,125 g" is a thousand grams in the US and 1.125 g in Europe. A gram value over 100
    per 100g is impossible, so the decimal reading is the only plausible one; the same
    string in kcal or mg is a grouped whole number. A space, a repeated group ("1,000,000")
    or a fraction after the group ("1,182.07") is always grouping.
    """
    return (
        match.group("sep") in ",."
        and match.group("int").count(match.group("sep")) == 1
        and not match.group("frac")
        and unit not in _WHOLE_NUMBER_UNITS
    )


_NUMBER_RE = re.compile(rf"{_GROUPED}|{_PLAIN}")


def numbers_in(text: str) -> set[Decimal]:
    """Every number printed in `text`, under each reading it could have.

    "1.050" contributes both 1050 and 1.05, since without a unit either is possible. Used
    to check that a value the model reports actually appears on the page.
    """
    found: set[Decimal] = set()
    for match in _NUMBER_RE.finditer(text):
        readings = [(match.group("int") or match.group("plain")).replace(",", ".")]
        if match.group("int"):
            grouped = match.group("int").replace(match.group("sep"), "")
            readings.append(grouped + (match.group("frac") or "").replace(",", "."))
        for reading in readings:
            try:
                found.add(Decimal(reading))
            except InvalidOperation:
                continue
    return found


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
