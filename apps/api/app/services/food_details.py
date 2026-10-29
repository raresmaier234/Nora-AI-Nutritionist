"""A food's full nutrient profile, for the app's food details screen. See docs/api.md."""

from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.schemas.food import FoodDetail, NutrientAmount, Per100g
from app.services.ingest.measures import GRAM, MILLIGRAM
from app.services.ingest.nutrients import EXTRA_NUTRIENTS, Nutrient

# The label's nutrients beyond calories and the three macros, which go in `per_100g`.
# Everything after them is EXTRA_NUTRIENTS, in its order.
LABEL_NUTRIENTS: tuple[Nutrient, ...] = (
    Nutrient(key="fiber", unit=GRAM, group="carbs"),
    Nutrient(key="sugar", unit=GRAM, group="carbs"),
    Nutrient(key="saturated_fat", unit=GRAM, group="fats"),
    Nutrient(key="sodium", unit=MILLIGRAM, group="minerals"),
)


def get_food_detail(db: Session, food_id: int) -> FoodDetail | None:
    """The food with every nutrient it has a value for, or None if there is no such food."""
    food = db.get(Food, food_id)
    if food is None:
        return None

    macros = (food.calories_per_100g, food.protein_per_100g, food.carbs_per_100g, food.fat_per_100g)
    per_100g = None
    if all(value is not None for value in macros):
        kcal, protein, carbs, fat = macros
        per_100g = Per100g(kcal=float(kcal), protein=float(protein), carbs=float(carbs), fat=float(fat))

    nutrients = [
        NutrientAmount(key=nutrient.key, unit=nutrient.unit, amount=float(value))
        for nutrient in (*LABEL_NUTRIENTS, *EXTRA_NUTRIENTS)
        if (value := getattr(food, nutrient.column)) is not None
    ]
    return FoodDetail(id=food.id, name=food.name, per_100g=per_100g, nutrients=nutrients)
