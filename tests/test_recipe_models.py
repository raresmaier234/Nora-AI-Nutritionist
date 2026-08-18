"""Tests for the Recipe / Food / RecipeIngredient models and their relationships."""

from app.db.models.food import Food
from app.db.models.recipe import Recipe
from app.db.models.recipe_ingredient import RecipeIngredient


def test_create_recipe_with_ingredients(db_session) -> None:
    food = Food(name="Flour", calories_per_100g=364, protein_per_100g=10, carbs_per_100g=76)
    recipe = Recipe(
        name="Pancakes",
        source_url="https://example.com/pancakes",
        description="Fluffy pancakes",
        source_nutrition={"calories": "350 kcal"},
        raw_data={"@type": "Recipe", "name": "Pancakes"},
    )
    recipe.ingredients = [
        RecipeIngredient(original_text="2 cups flour", quantity=2, unit="cup", grams=240, food=food),
        RecipeIngredient(original_text="a pinch of salt"),
    ]

    db_session.add(recipe)
    db_session.flush()

    assert recipe.id is not None
    assert len(recipe.ingredients) == 2
    assert recipe.created_at is not None

    matched, unmatched = recipe.ingredients
    assert matched.food is food
    assert matched.recipe is recipe
    assert unmatched.food_id is None

    assert food.recipe_ingredients == [matched]


def test_ingredient_food_id_is_nullable(db_session) -> None:
    recipe = Recipe(name="Water", source_url="https://example.com/water")
    ingredient = RecipeIngredient(recipe=recipe, original_text="1 glass of water")

    db_session.add(ingredient)
    db_session.flush()

    assert ingredient.food_id is None
    assert ingredient.food is None


def test_deleting_recipe_cascades_to_ingredients(db_session) -> None:
    recipe = Recipe(name="Toast", source_url="https://example.com/toast")
    recipe.ingredients = [RecipeIngredient(original_text="1 slice of bread")]

    db_session.add(recipe)
    db_session.flush()
    ingredient_id = recipe.ingredients[0].id

    db_session.delete(recipe)
    db_session.flush()

    assert db_session.get(RecipeIngredient, ingredient_id) is None


def test_deleting_food_preserves_ingredient(db_session) -> None:
    food = Food(name="Sugar")
    recipe = Recipe(name="Tea", source_url="https://example.com/tea")
    ingredient = RecipeIngredient(recipe=recipe, original_text="1 tsp sugar", food=food)

    db_session.add(recipe)
    db_session.add(ingredient)
    db_session.flush()
    ingredient_id = ingredient.id

    db_session.delete(food)
    db_session.flush()
    db_session.expire_all()

    persisted = db_session.get(RecipeIngredient, ingredient_id)
    assert persisted is not None
    assert persisted.food_id is None
