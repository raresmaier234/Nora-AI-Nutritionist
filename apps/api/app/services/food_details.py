"""A food's full nutrient profile, for the app's food details screen. See docs/api.md."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.schemas.food import FoodDetail, FoodServing, NutrientAmount, PackageServing, Per100g
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
    return food_detail(food) if food is not None else None


def barcode_variants(code: str) -> list[str]:
    """The ways one product's barcode gets written: a 12-digit UPC-A is the same product as the
    13-digit EAN with a leading 0, and scanners report either depending on the phone."""
    code = code.strip()
    variants = [code]
    if len(code) == 12:
        variants.append(f"0{code}")
    elif len(code) == 13 and code.startswith("0"):
        variants.append(code[1:])
    return variants


def find_by_barcode(db: Session, code: str) -> FoodDetail | None:
    """The food with this barcode, if it can be logged (has calories and the three macros)."""
    food = db.execute(select(Food).where(Food.barcode.in_(barcode_variants(code)))).scalars().first()
    if food is None:
        return None
    detail = food_detail(food)
    return detail if detail.per_100g is not None else None


def food_detail(food: Food) -> FoodDetail:
    """A stored food as the details screen shows it."""

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
    return FoodDetail(
        id=food.id,
        name=food.name,
        brand=food.brand,
        store=food.store,
        per_100g=per_100g,
        package_serving=(
            PackageServing(label=food.package_serving_label, grams=float(food.package_serving_grams))
            if food.package_serving_label and food.package_serving_grams
            else None
        ),
        servings=[FoodServing(**serving) for serving in food.servings or []],
        nutrients=nutrients,
    )
