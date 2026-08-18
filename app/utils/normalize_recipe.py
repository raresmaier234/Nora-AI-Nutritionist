from app.schemas.food import Recipe, Nutrition


def normalize_recipe(data) -> Recipe:
    nutrition_data = data.get("nutrition")

    nutrition = None

    if nutrition_data:
        nutrition = Nutrition(
            calories=nutrition_data.get("calories"),
            carbohydrateContent=nutrition_data.get("carbohydrateContent"),
            proteinContent=nutrition_data.get("proteinContent"),
            fatContent=nutrition_data.get("fatContent"),
            saturatedFatContent=nutrition_data.get("saturatedFatContent"),
            cholesterolContent=nutrition_data.get("cholesterolContent"),
            sodiumContent=nutrition_data.get("sodiumContent"),
            fiberContent=nutrition_data.get("fiberContent"),
            sugarContent=nutrition_data.get("sugarContent"),
            unsaturatedFatContent=nutrition_data.get("unsaturatedFatContent"),
            servingSize=nutrition_data.get("servingSize"),
        )

    return Recipe(
        name=data.get("name"),
        ingredients=data.get("recipeIngredient", []),
        nutrition=nutrition,
    )