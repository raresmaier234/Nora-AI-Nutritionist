"""Tests for the food log (/api/v1/meals/entries).

The database is shared with the real log, so every test logs to a date nobody uses.
"""

from datetime import datetime
from decimal import Decimal

from app.db.models.food import Food

DAY = "1999-01-02"
NEXT_DAY = "1999-01-03"
ENTRIES = "/api/v1/meals/entries"


def add_food(db) -> Food:
    food = Food(
        name="Qzvwx Brie",
        calories_per_100g=Decimal("334"),
        protein_per_100g=Decimal("20.75"),
        carbs_per_100g=Decimal("0.45"),
        fat_per_100g=Decimal("27.68"),
    )
    db.add(food)
    db.flush()
    return food


def custom_entry(**overrides) -> dict:
    return {
        "date": DAY,
        "meal": "breakfast",
        "source": "custom",
        "name": "Grandma's pancakes",
        "per_100g": {"kcal": 227, "protein": 6.4, "carbs": 28.3, "fat": 9.7},
        "amount": 2,
        "unit": "piece",
        "grams": 100,
        **overrides,
    }


def test_log_list_change_and_remove(client) -> None:
    created = client.post(ENTRIES, json=custom_entry())
    assert created.status_code == 201
    entry = created.json()
    assert entry["name"] == "Grandma's pancakes"
    assert entry["date"] == DAY
    assert entry["per_100g"] == {"kcal": 227.0, "protein": 6.4, "carbs": 28.3, "fat": 9.7}

    listed = client.get(ENTRIES, params={"date": DAY}).json()
    assert [e["id"] for e in listed] == [entry["id"]]

    changed = client.patch(
        f"{ENTRIES}/{entry['id']}", json={"amount": 3, "grams": 150, "meal": "lunch"}
    )
    assert changed.status_code == 200
    assert (changed.json()["amount"], changed.json()["grams"], changed.json()["meal"]) == (
        3.0,
        150.0,
        "lunch",
    )
    assert changed.json()["unit"] == "piece"  # omitted fields are kept

    assert client.delete(f"{ENTRIES}/{entry['id']}").status_code == 204
    assert client.get(ENTRIES, params={"date": DAY}).json() == []


def test_a_database_food_is_logged_with_the_databases_values(client, db_session) -> None:
    """Whatever name or values a client sends, a food_id entry uses the stored food."""
    food = add_food(db_session)

    response = client.post(
        ENTRIES,
        json={
            "date": DAY,
            "meal": "snacks",
            "food_id": food.id,
            "name": "Something else",
            "per_100g": {"kcal": 1, "protein": 1, "carbs": 1, "fat": 1},
            "amount": 30,
            "unit": "g",
            "grams": 30,
        },
    )

    entry = response.json()
    assert response.status_code == 201
    assert entry["food_id"] == food.id
    assert entry["name"] == "Qzvwx Brie"
    assert entry["per_100g"] == {"kcal": 334.0, "protein": 20.75, "carbs": 0.45, "fat": 27.68}


def test_the_logged_values_do_not_change_when_the_food_does(client, db_session) -> None:
    food = add_food(db_session)
    client.post(
        ENTRIES,
        json={
            "date": DAY, "meal": "lunch", "food_id": food.id, "amount": 1, "unit": "g", "grams": 1
        },
    )

    food.calories_per_100g = Decimal("999")
    db_session.flush()

    assert client.get(ENTRIES, params={"date": DAY}).json()[0]["per_100g"]["kcal"] == 334.0


def test_an_entry_without_food_id_needs_a_name_and_values(client) -> None:
    body = custom_entry()
    del body["per_100g"]

    assert client.post(ENTRIES, json=body).status_code == 422


def test_an_unknown_food_is_404(client) -> None:
    body = {
        "date": DAY, "meal": "lunch", "food_id": 2_000_000_000, "amount": 1, "unit": "g", "grams": 1
    }

    assert client.post(ENTRIES, json=body).status_code == 404


def test_a_food_missing_a_macro_cannot_be_logged(client, db_session) -> None:
    food = add_food(db_session)
    food.protein_per_100g = None
    db_session.flush()
    body = {
        "date": DAY, "meal": "lunch", "food_id": food.id, "amount": 1, "unit": "g", "grams": 1
    }

    assert client.post(ENTRIES, json=body).status_code == 422


def test_an_unknown_entry_is_404(client) -> None:
    assert client.patch(f"{ENTRIES}/2000000000", json={"grams": 5}).status_code == 404
    assert client.delete(f"{ENTRIES}/2000000000").status_code == 404


def test_entries_belong_to_their_day(client) -> None:
    client.post(ENTRIES, json=custom_entry(date=DAY, name="Day one"))
    client.post(ENTRIES, json=custom_entry(date=NEXT_DAY, name="Day two"))

    assert [e["name"] for e in client.get(ENTRIES, params={"date": DAY}).json()] == ["Day one"]
    assert [e["name"] for e in client.get(ENTRIES, params={"date": NEXT_DAY}).json()] == [
        "Day two"
    ]


def test_copy_a_day_keeps_the_source_and_the_time_of_day(client) -> None:
    original = client.post(ENTRIES, json=custom_entry(date=DAY, meal="breakfast")).json()

    response = client.post(f"{ENTRIES}/copy", json={"from_date": DAY, "to_date": NEXT_DAY})

    assert response.status_code == 201
    [copy] = response.json()
    assert copy["id"] != original["id"]
    assert copy["date"] == NEXT_DAY
    assert copy["meal"] == "breakfast"
    assert (copy["name"], copy["grams"]) == ("Grandma's pancakes", 100.0)
    assert copy["logged_at"][11:16] == original["logged_at"][11:16]  # same HH:MM
    assert len(client.get(ENTRIES, params={"date": DAY}).json()) == 1  # source untouched


def test_invalid_input_is_rejected(client) -> None:
    assert client.post(ENTRIES, json=custom_entry(meal="brunch")).status_code == 422
    assert client.post(ENTRIES, json=custom_entry(grams=0)).status_code == 422
    assert client.post(ENTRIES, json=custom_entry(grams=6000)).status_code == 422
    over = {"kcal": 2000, "protein": 1, "carbs": 1, "fat": 1}
    assert client.post(ENTRIES, json=custom_entry(per_100g=over)).status_code == 422


def test_an_entry_is_logged_at_the_time_it_was_eaten(client) -> None:
    """The timeline sends when the food was eaten; the day and meal follow from it."""
    response = client.post(
        ENTRIES, json=custom_entry(date=None, meal=None, logged_at=f"{DAY}T13:05:00+03:00")
    )

    assert response.status_code == 201
    entry = response.json()
    assert entry["date"] == DAY
    assert entry["meal"] == "lunch"
    assert datetime.fromisoformat(entry["logged_at"]) == datetime.fromisoformat(
        f"{DAY}T13:05:00+03:00"
    )


def test_entries_are_listed_in_the_order_they_were_eaten(client) -> None:
    for name, hhmm in [("Dinner", "19:20"), ("Breakfast", "08:10"), ("Snack", "10:45")]:
        client.post(
            ENTRIES,
            json=custom_entry(date=None, meal=None, name=name, logged_at=f"{DAY}T{hhmm}:00+00:00"),
        )

    listed = client.get(ENTRIES, params={"date": DAY}).json()
    assert [(e["name"], e["meal"]) for e in listed] == [
        ("Breakfast", "breakfast"),
        ("Snack", "breakfast"),
        ("Dinner", "dinner"),
    ]


def test_the_meal_is_read_in_the_eaters_timezone(client) -> None:
    """08:10 in Bucharest is breakfast, even though it is 05:10 UTC."""
    entry = client.post(
        ENTRIES, json=custom_entry(date=None, meal=None, logged_at=f"{DAY}T08:10:00+03:00")
    ).json()
    assert entry["meal"] == "breakfast"


def test_an_explicit_meal_wins_over_the_time(client) -> None:
    entry = client.post(
        ENTRIES, json=custom_entry(date=None, meal="snacks", logged_at=f"{DAY}T13:05:00+00:00")
    ).json()
    assert entry["meal"] == "snacks"


def test_changing_the_time_moves_the_entry(client) -> None:
    entry = client.post(
        ENTRIES, json=custom_entry(date=None, meal=None, logged_at=f"{DAY}T08:10:00+00:00")
    ).json()

    changed = client.patch(
        f"{ENTRIES}/{entry['id']}", json={"logged_at": f"{NEXT_DAY}T19:20:00+00:00"}
    ).json()

    assert (changed["date"], changed["meal"]) == (NEXT_DAY, "dinner")
    assert client.get(ENTRIES, params={"date": DAY}).json() == []
    assert [e["id"] for e in client.get(ENTRIES, params={"date": NEXT_DAY}).json()] == [
        entry["id"]
    ]


def test_logged_at_must_carry_a_timezone_and_match_date(client) -> None:
    naive = custom_entry(meal=None, logged_at=f"{DAY}T08:10:00")
    assert client.post(ENTRIES, json=naive).status_code == 422
    other_day = custom_entry(date=NEXT_DAY, logged_at=f"{DAY}T08:10:00+00:00")
    assert client.post(ENTRIES, json=other_day).status_code == 422
