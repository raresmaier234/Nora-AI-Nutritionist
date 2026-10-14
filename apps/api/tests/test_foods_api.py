"""Tests for food search (GET /api/v1/foods).

The database is shared with farming, so every food here has a made-up name that no real
food resembles, and every search is for text only these foods contain.
"""

from decimal import Decimal

from app.db.models.food import Food


def add_food(db, name: str, **values) -> Food:
    defaults = {
        "calories_per_100g": Decimal("61"),
        "protein_per_100g": Decimal("3.2"),
        "carbs_per_100g": Decimal("4.8"),
        "fat_per_100g": Decimal("3.3"),
    }
    food = Food(name=name, **{**defaults, **values})
    db.add(food)
    db.flush()
    return food


def test_finds_a_food_by_part_of_its_name(client, db_session) -> None:
    food = add_food(db_session, "Qzvwx Whole Milk")

    response = client.get("/api/v1/foods", params={"q": "qzvwx"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": food.id,
            "name": "Qzvwx Whole Milk",
            "per_100g": {"kcal": 61.0, "protein": 3.2, "carbs": 4.8, "fat": 3.3},
        }
    ]


def test_ignores_case_accents_and_punctuation(client, db_session) -> None:
    add_food(db_session, "Qzvwx Crème Fraîche")

    response = client.get("/api/v1/foods", params={"q": "QZVWX creme-fraiche"})
    names = [f["name"] for f in response.json()]

    assert names == ["Qzvwx Crème Fraîche"]


def test_ranks_the_exact_name_first(client, db_session) -> None:
    add_food(db_session, "Qzvwx Milk Chocolate Bar")
    add_food(db_session, "Qzvwx Milk Powder")
    add_food(db_session, "Qzvwx Milk")

    names = [f["name"] for f in client.get("/api/v1/foods", params={"q": "qzvwx milk"}).json()]

    # Exact first, then names starting with the query. Merely similar real foods ("1% milk")
    # may follow, which is the fuzzy match working, but never ahead of a real match.
    assert names[0] == "Qzvwx Milk"
    assert set(names[:3]) == {"Qzvwx Milk", "Qzvwx Milk Powder", "Qzvwx Milk Chocolate Bar"}


def test_leaves_out_foods_missing_a_macro(client, db_session) -> None:
    """They cannot be logged meaningfully, so they are not offered."""
    add_food(db_session, "Qzvwx Complete")
    add_food(db_session, "Qzvwx Incomplete", protein_per_100g=None)

    names = [f["name"] for f in client.get("/api/v1/foods", params={"q": "qzvwx"}).json()]

    assert names == ["Qzvwx Complete"]


def test_limit_caps_the_results(client, db_session) -> None:
    for n in range(5):
        add_food(db_session, f"Qzvwx Item {n}")

    response = client.get("/api/v1/foods", params={"q": "qzvwx item", "limit": 2})

    assert len(response.json()) == 2


def test_a_query_of_only_punctuation_finds_nothing(client) -> None:
    assert client.get("/api/v1/foods", params={"q": "!!!"}).json() == []


def test_the_query_is_required(client) -> None:
    assert client.get("/api/v1/foods").status_code == 422
    assert client.get("/api/v1/foods", params={"q": ""}).status_code == 422
