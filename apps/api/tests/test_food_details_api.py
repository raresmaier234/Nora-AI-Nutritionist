"""Tests for one food's full nutrition (GET /api/v1/foods/{id})."""

from decimal import Decimal

from app.db.models.food import Food


def add_food(db, name: str, **values) -> Food:
    defaults = {
        "calories_per_100g": Decimal("89"),
        "protein_per_100g": Decimal("1.09"),
        "carbs_per_100g": Decimal("22.8"),
        "fat_per_100g": Decimal("0.33"),
    }
    food = Food(name=name, **{**defaults, **values})
    db.add(food)
    db.flush()
    return food


def test_returns_macros_and_every_nutrient_with_its_unit(client, db_session) -> None:
    food = add_food(
        db_session,
        "Qzvwx Banana",
        fiber_per_100g=Decimal("2.6"),
        sugar_per_100g=Decimal("12.2"),
        sodium_mg_per_100g=Decimal("1"),
        fructose_per_100g=Decimal("4.85"),
        vitamin_c_mg_per_100g=Decimal("8.7"),
        folate_ug_per_100g=Decimal("20"),
        potassium_mg_per_100g=Decimal("358"),
    )

    response = client.get(f"/api/v1/foods/{food.id}")

    assert response.status_code == 200
    assert response.json() == {
        "id": food.id,
        "name": "Qzvwx Banana",
        "per_100g": {"kcal": 89.0, "protein": 1.09, "carbs": 22.8, "fat": 0.33},
        # Label nutrients first, then the full profile in its group order.
        "nutrients": [
            {"key": "fiber", "unit": "g", "amount": 2.6},
            {"key": "sugar", "unit": "g", "amount": 12.2},
            {"key": "sodium", "unit": "mg", "amount": 1.0},
            {"key": "fructose", "unit": "g", "amount": 4.85},
            {"key": "folate", "unit": "ug", "amount": 20.0},
            {"key": "vitamin_c", "unit": "mg", "amount": 8.7},
            {"key": "potassium", "unit": "mg", "amount": 358.0},
        ],
    }


def test_keeps_a_zero_but_leaves_out_nutrients_without_data(client, db_session) -> None:
    food = add_food(db_session, "Qzvwx Plain Rice Cake", fiber_per_100g=Decimal("0"))

    nutrients = client.get(f"/api/v1/foods/{food.id}").json()["nutrients"]

    assert nutrients == [{"key": "fiber", "unit": "g", "amount": 0.0}]


def test_a_food_without_complete_macros_has_no_per_100g(client, db_session) -> None:
    food = add_food(db_session, "Qzvwx Mystery Spice", fat_per_100g=None, iron_mg_per_100g=Decimal("3"))

    body = client.get(f"/api/v1/foods/{food.id}").json()

    assert body["per_100g"] is None
    assert body["nutrients"] == [{"key": "iron", "unit": "mg", "amount": 3.0}]


def test_an_unknown_food_is_a_404(client, db_session) -> None:
    food = add_food(db_session, "Qzvwx Deleted Food")
    missing_id = food.id
    db_session.delete(food)
    db_session.flush()

    response = client.get(f"/api/v1/foods/{missing_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": f"food {missing_id} does not exist"}
