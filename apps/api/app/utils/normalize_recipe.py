from pydantic import ValidationError

from app.schemas.food import Nutrition, Recipe
from app.services.scraping.errors import ParseError

_NUTRITION_FIELDS = tuple(Nutrition.model_fields)


def normalize_recipe(node: dict) -> Recipe:
    """Convert one Schema.org Recipe object into a Recipe.

    Raises ParseError when the object is missing what a recipe needs (a name, mainly) or
    carries values of an unusable shape — the object is technically JSON-LD, but not a
    recipe we can present.
    """
    nutrition_data = node.get("nutrition")
    nutrition = None

    if isinstance(nutrition_data, dict):
        nutrition = Nutrition(
            **{field: nutrition_data.get(field) for field in _NUTRITION_FIELDS}
        )

    try:
        return Recipe(
            name=node.get("name"),
            ingredients=node.get("recipeIngredient", []),
            nutrition=nutrition,
        )
    except ValidationError as exc:
        raise ParseError("Recipe data is missing required fields") from exc
