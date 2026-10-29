from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Nutrition(BaseModel):
    calories: str | None = None
    carbohydrateContent: str | None = None
    proteinContent: str | None = None
    fatContent: str | None = None
    saturatedFatContent: str | None = None
    cholesterolContent: str | None = None
    sodiumContent: str | None = None
    fiberContent: str | None = None
    sugarContent: str | None = None
    unsaturatedFatContent: str | None = None
    servingSize: str | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _stringify_numbers(cls, v):
        # Sites publish these as numbers as often as strings ("calories": 350).
        return str(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v


class Recipe(BaseModel):
    name: str
    ingredients: list[str]
    nutrition: Nutrition | None = None

    @field_validator("ingredients", mode="before")
    @classmethod
    def _wrap_single(cls, v):
        # A single-ingredient recipe is sometimes emitted as a bare string.
        return [v] if isinstance(v, str) else v


class RecipeResponse(BaseModel):
    """Every recipe found at a URL. A page with none yields an empty list, not an error."""

    source_url: str
    recipes: list[Recipe]


class AddFood(BaseModel):
    """Manual entry of a canonical per-100g food. Only the name is required."""

    name: str
    calories_per_100g: Decimal | None = None
    protein_per_100g: Decimal | None = None
    fat_per_100g: Decimal | None = None
    carbs_per_100g: Decimal | None = None
    fiber_per_100g: Decimal | None = None


class FoodRead(BaseModel):
    """A stored food, as returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    calories_per_100g: Decimal | None = None
    protein_per_100g: Decimal | None = None
    fat_per_100g: Decimal | None = None
    carbs_per_100g: Decimal | None = None
    fiber_per_100g: Decimal | None = None
    created_at: datetime


class FoodResponse(BaseModel):
    food: FoodRead


class Per100g(BaseModel):
    """Energy and macros per 100g. Floats, not Decimal: Pydantic serializes Decimal as a JSON
    string, and clients do arithmetic with these."""

    kcal: float = Field(ge=0, le=950)
    protein: float = Field(ge=0, le=101)
    carbs: float = Field(ge=0, le=101)
    fat: float = Field(ge=0, le=101)


class FoodSearchResult(BaseModel):
    """A food from the database, as listed by search."""

    id: int
    name: str
    per_100g: Per100g


class NutrientAmount(BaseModel):
    """How much of one nutrient 100g of a food contains."""

    key: str = Field(description="The nutrient, e.g. 'fiber', 'vitamin_c', 'omega_3'.")
    unit: Literal["g", "mg", "ug"]
    amount: float = Field(ge=0)


class FoodDetail(BaseModel):
    """A food with its full nutrient profile, per 100g. Nutrients without data are left out."""

    id: int
    name: str
    per_100g: Per100g | None = Field(
        description="Null when the food lacks calories, protein, carbs or fat."
    )
    nutrients: list[NutrientAmount]
