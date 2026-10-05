"""The full nutrient profile a food can carry, beyond the core label.

One list drives the `foods` columns, the normalizer and the readers, so a nutrient is
added in one place. Every value is stored per 100g, in the unit its column name states:
`leucine_per_100g` is grams, `vitamin_c_mg_per_100g` milligrams, `folate_ug_per_100g`
micrograms. Units follow USDA FoodData Central, which is where most published full
profiles (EatThisMuch's included) come from.

The core label — calories, protein, fat, carbs, fibre, sugar, saturated fat, sodium — is
handled separately by the normalizer, because four of those are required and all of them
feed the plausibility checks.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.ingest.measures import GRAM, MICROGRAM, MILLIGRAM


@dataclass(frozen=True)
class Nutrient:
    key: str  # the key in a raw food record, e.g. "vitamin_c"
    unit: str  # GRAM, MILLIGRAM or MICROGRAM
    group: str

    @property
    def column(self) -> str:
        """The `foods` column, e.g. "vitamin_c_mg_per_100g" or "leucine_per_100g"."""
        if self.unit == GRAM:
            return f"{self.key}_per_100g"
        return f"{self.key}_{self.unit}_per_100g"


def _group(group: str, unit: str, *keys: str) -> tuple[Nutrient, ...]:
    return tuple(Nutrient(key=key, unit=unit, group=group) for key in keys)


EXTRA_NUTRIENTS: tuple[Nutrient, ...] = (
    # Carbohydrate breakdown. Total sugar and fibre are core columns.
    *_group(
        "carbs", GRAM, "starch", "sucrose", "glucose", "fructose", "lactose", "maltose", "galactose"
    ),
    # Fat breakdown. Saturated fat is a core column.
    *_group(
        "fats",
        GRAM,
        "monounsaturated_fat",
        "polyunsaturated_fat",
        "trans_fat",
        "omega_3",
        "omega_6",
        "ala",
        "epa",
        "dha",
        "dpa",
    ),
    *_group("fats", MILLIGRAM, "cholesterol"),
    # Protein breakdown: amino acids.
    *_group(
        "protein",
        GRAM,
        "tryptophan",
        "threonine",
        "isoleucine",
        "leucine",
        "lysine",
        "methionine",
        "cystine",
        "phenylalanine",
        "tyrosine",
        "valine",
        "arginine",
        "histidine",
        "alanine",
        "aspartic_acid",
        "glutamic_acid",
        "glycine",
        "proline",
        "serine",
        "hydroxyproline",
    ),
    # Vitamins. Vitamin A is retinol activity equivalents (RAE); folate is total folate.
    *_group(
        "vitamins",
        MICROGRAM,
        "vitamin_a",
        "retinol",
        "beta_carotene",
        "alpha_carotene",
        "lycopene",
        "vitamin_d",
        "vitamin_d2",
        "vitamin_d3",
        "vitamin_k",
        "folate",
        "vitamin_b12",
    ),
    *_group(
        "vitamins",
        MILLIGRAM,
        "vitamin_c",
        "vitamin_e",
        "thiamin",
        "riboflavin",
        "niacin",
        "pantothenic_acid",
        "vitamin_b6",
        "choline",
        "betaine",
    ),
    # Minerals. Sodium is a core column.
    *_group(
        "minerals",
        MILLIGRAM,
        "calcium",
        "iron",
        "magnesium",
        "phosphorus",
        "potassium",
        "zinc",
        "copper",
        "manganese",
    ),
    *_group("minerals", MICROGRAM, "selenium", "fluoride"),
    # Everything else.
    *_group("other", GRAM, "water", "alcohol"),
    *_group("other", MILLIGRAM, "caffeine", "theobromine"),
)

EXTRA_NUTRIENTS_BY_KEY: dict[str, Nutrient] = {n.key: n for n in EXTRA_NUTRIENTS}
