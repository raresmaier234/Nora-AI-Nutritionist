"""Tests for barcode lookup (GET /api/v1/barcodes/{code}). Barcodes are made up."""

from decimal import Decimal

from app.db.models.food import Food

BARCODES = "/api/v1/barcodes"


def add_product(db, barcode: str, **values) -> Food:
    defaults = {
        "calories_per_100g": Decimal("64"),
        "protein_per_100g": Decimal("3.4"),
        "carbs_per_100g": Decimal("4.7"),
        "fat_per_100g": Decimal("3.5"),
    }
    food = Food(
        name="Qzvwx Lapte",
        brand="Qzvwx",
        barcode=barcode,
        package_serving_label="1 glass (250 ml)",
        package_serving_grams=Decimal("250"),
        **{**defaults, **values},
    )
    db.add(food)
    db.flush()
    return food


def test_a_barcode_finds_its_food_with_the_package_serving(client, db_session) -> None:
    food = add_product(db_session, "9990000000017")

    response = client.get(f"{BARCODES}/9990000000017")

    assert response.status_code == 200
    body = response.json()
    assert (body["id"], body["name"], body["brand"]) == (food.id, "Qzvwx Lapte", "Qzvwx")
    assert body["package_serving"] == {"label": "1 glass (250 ml)", "grams": 250.0}


def test_upc_and_ean_with_a_leading_zero_are_the_same_product(client, db_session) -> None:
    food = add_product(db_session, "099900000001")  # stored as a 12-digit UPC

    assert client.get(f"{BARCODES}/0099900000001").json()["id"] == food.id


def test_an_unknown_or_unloggable_barcode_is_404(client, db_session) -> None:
    add_product(db_session, "9990000000024", fat_per_100g=None)

    assert client.get(f"{BARCODES}/9990000000031").status_code == 404
    assert client.get(f"{BARCODES}/9990000000024").status_code == 404


def test_a_code_that_is_not_a_barcode_is_rejected(client) -> None:
    assert client.get(f"{BARCODES}/abc").status_code == 422
