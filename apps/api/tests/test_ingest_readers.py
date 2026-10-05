"""Tests for the structured readers. Fixtures are trimmed from the live pages."""

import json
from decimal import Decimal

import pytest

from app.services.ingest.normalizer import normalize_food
from app.services.ingest.sources.readers import (
    read_eatthismuch,
    read_freshful,
    read_kaufland,
    read_oneden,
)

ONEDEN_PAGE = """<html><head><title>Calorii abonett paine extrudata cu quinoa</title></head>
<body><h1>Calorii</h1><h2>Calorii abonett paine extrudata cu quinoa</h2>
<div class="aliment-detail">
  <div class="aliment-detail-column">
    <div class="aliment-column-header"><a href="/AddToMenu/34003/100"></a> 100 grame</div>
    <div class="aliment-nutrition-list">
      <div class="nutrition-row"><span class="nutrition-label">Calorii</span>
        <span class="nutrition-value"><strong>362</strong></span></div>
      <div class="nutrition-row"><span class="nutrition-label">Proteine</span>
        <span class="nutrition-value"><strong>1.5</strong></span></div>
      <div class="nutrition-row"><span class="nutrition-label">Lipide</span>
        <span class="nutrition-value"><strong>3.2</strong></span></div>
      <div class="nutrition-row"><span class="nutrition-label">Carbohidrati</span>
        <span class="nutrition-value"><strong>80</strong></span></div>
      <div class="nutrition-row"><span class="nutrition-label">Fibre</span>
        <span class="nutrition-value"><strong>9.1</strong></span></div>
    </div>
  </div>
  <div class="aliment-detail-column">
    <div class="aliment-column-header"><a href="/AddToMenu/34003/200"></a> 200 grame</div>
    <div class="aliment-nutrition-list">
      <div class="nutrition-row"><span class="nutrition-label">Calorii</span>
        <span class="nutrition-value"><strong>724</strong></span></div>
      <div class="nutrition-row"><span class="nutrition-label">Proteine</span>
        <span class="nutrition-value"><strong>3</strong></span></div>
    </div>
  </div>
</div></body></html>"""


def test_oneden_reads_the_100g_column_by_its_header() -> None:
    """The 200g column is the shorter text here (1.5 doubles to 3); it must not be chosen."""
    [food] = read_oneden(ONEDEN_PAGE)

    assert food["name"] == "abonett paine extrudata cu quinoa"
    assert food["basis"] == "per_100g"
    assert (food["calories"], food["protein"], food["fat"], food["carbs"], food["fiber"]) == (
        "362",
        "1.5",
        "3.2",
        "80",
        "9.1",
    )


def test_oneden_output_normalizes_with_fibre() -> None:
    food = normalize_food(read_oneden(ONEDEN_PAGE)[0])

    assert food.calories_per_100g == 362
    assert food.fiber_per_100g == Decimal("9.1")


def test_oneden_page_without_a_100g_column_yields_nothing() -> None:
    assert read_oneden(ONEDEN_PAGE.replace("100 grame", "150 grame")) == []


def freshful_page(rows: list[dict]) -> str:
    data = {
        "props": {
            "pageProps": {
                "sections": [
                    {"title": "Ingrediente", "attributeTypes": [
                        {"type": "text", "attributes": [{"name": "Ingrediente", "value": "x"}]},
                        {"type": "nestedTable", "title": None, "attributes": rows},
                    ]}
                ]
            }
        }
    }
    return (
        "<html><head><title>Seminte | Freshful</title></head><body>"
        "<h1>Semințe floarea-soarelui decojite crude 200g</h1>"
        f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script>'
        "</body></html>"
    )


FRESHFUL_ROWS = [
    {"name": "Energie (kcal)", "value": "592", "children": []},
    {"name": "Energie (kj)", "value": "2478", "children": []},
    {"name": "Grasimi (grame)", "value": "51", "children": [
        {"name": " din care saturate/ acizi grasi saturati", "value": "5.4", "children": []}
    ]},
    {"name": "Carbohidrati/ Glucide (grame)", "value": "3.1", "children": [
        {"name": " din care zaharuri", "value": "2.6", "children": []}
    ]},
    {"name": "Proteine", "value": "20", "children": []},
    {"name": "Sare / Sodium", "value": "0.02", "children": []},
    {"name": "Fibre", "value": "10.6", "children": []},
]


def test_freshful_reads_the_nutrition_table_from_page_data() -> None:
    [food] = read_freshful(freshful_page(FRESHFUL_ROWS))

    assert food["name"] == "Semințe floarea-soarelui decojite crude 200g"
    assert food["calories"] == "592 kcal"
    assert food["fat"] == "51 g"
    assert food["saturated_fat"] == "5.4 g"
    assert food["carbs"] == "3.1 g"
    assert food["sugar"] == "2.6 g"
    assert food["protein"] == "20 g"
    assert food["fiber"] == "10.6 g"


def test_freshful_converts_salt_to_sodium() -> None:
    """EU labels declare salt; sodium is salt / 2.5. 0.02g of salt is 8mg of sodium."""
    [food] = read_freshful(freshful_page(FRESHFUL_ROWS))

    assert food["sodium"] == 8.0
    assert normalize_food(food).sodium_mg_per_100g == Decimal("8")


def test_freshful_prefers_kcal_even_when_kj_comes_first() -> None:
    rows = [FRESHFUL_ROWS[1], FRESHFUL_ROWS[0], *FRESHFUL_ROWS[2:]]

    assert read_freshful(freshful_page(rows))[0]["calories"] == "592 kcal"


def test_freshful_product_without_a_table_is_not_a_food() -> None:
    """Condoms, cigarettes and detergent are in the same sitemap."""
    assert read_freshful(freshful_page([])) == []
    assert read_freshful("<html><h1>Durex</h1></html>") == []


KAUFLAND_PAGE = """<html><body><h1>Gălbenuș de ou: partea galbenă a oului</h1>
  <div class="article"><p>Conține proteine, grăsimi și vitamine.</p></div>
  <div class="m-text-media">
    <div class="o-richtext--level-3">Valoare nutritivă</div>
    <div class="m-text-media__text">
      <p><strong>kcal:</strong> 137 kcal</p>
      <p><strong>Carbohidrați:</strong> 1,53 g</p>
      <p><strong>Proteine: </strong>11,85 g</p>
      <p><strong>Grăsimi:</strong> 9,32 g</p>
    </div>
  </div></body></html>"""


def test_kaufland_copies_the_name_and_every_value() -> None:
    """The model used to drop protein and turn "Gălbenuș" into "Gôbenuș"."""
    [food] = read_kaufland(KAUFLAND_PAGE)

    assert food["name"] == "Gălbenuș de ou"
    assert food["basis"] == "per_100g"
    assert (food["calories"], food["protein"], food["fat"], food["carbs"]) == (
        "137 kcal",
        "11,85 g",
        "9,32 g",
        "1,53 g",
    )


def test_kaufland_category_page_is_not_a_food() -> None:
    page = "<html><body><h1>Fructe exotice</h1><ul><li>Kiwi</li><li>Ananas</li></ul></body></html>"

    assert read_kaufland(page) == []


def eatthismuch_page(record: dict, *, food_id: int = 6, similar: dict | None = None) -> str:
    def block(fid: int, data: dict) -> str:
        body = json.dumps({"status": 200, "body": json.dumps({"data": data})})
        return (
            f'<script type="application/json" data-sveltekit-fetched '
            f'data-url="/api/v1/food/{fid}/?HTTP_BACKEND_VERSION=16">{body}</script>'
        )

    blocks = [block(food_id, record)]
    if similar is not None:
        blocks.insert(0, block(7, similar))  # a similar food listed before the page's own
    return (
        f'<html><head><link rel="canonical" href="https://www.eatthismuch.com/calories/'
        f'brie-cheese-{food_id}"/></head><body>{"".join(blocks)}</body></html>'
    )


BRIE = {
    "id": 6,
    "food_name": "Brie cheese",
    "description": "",
    "manufactured_by": None,
    "deleted": False,
    "calories": 94.68900000000001,
    "proteins": 5.882625000000001,
    "fats": 7.8472800000000005,
    "carbs": 0.12757500000000002,
    "weights": [{"amount": 28.35, "description": "grams"}, {"amount": 1, "description": "oz"}],
    "nutrition": {
        "fiber": 0,
        "sugar": 0.12757500000000002,
        "saturated_fats": 4.935735,
        "sodium": 178.32150000000001,
        "water": 13.727070000000001,
        "leucine": 0.5468715000000001,
        "calcium": 52.16400000000001,
        "vit_b12": 0.467775,
        "total_omega_3": 0,
        "starch": None,
        "vit_a_iu": 168,
    },
}


def test_eatthismuch_reads_the_unrounded_record_and_rebases_it() -> None:
    """The visible table says "Leucine 1g" per ounce; the record gives USDA's exact 1.929g."""
    food = normalize_food(read_eatthismuch(eatthismuch_page(BRIE))[0])

    assert food.name == "Brie cheese"
    assert food.calories_per_100g == Decimal("334")
    assert food.extra["leucine_per_100g"] == Decimal("1.929")
    assert food.extra["water_per_100g"] == Decimal("48.42")
    assert food.extra["calcium_mg_per_100g"] == Decimal("184")
    assert food.extra["vitamin_b12_ug_per_100g"] == Decimal("1.65")
    assert food.extra["omega_3_per_100g"] == Decimal("0")  # a stated zero is kept
    assert "starch_per_100g" not in food.extra  # unknown stays unknown


def test_eatthismuch_picks_the_pages_own_food_not_a_similar_one() -> None:
    similar = {**BRIE, "id": 7, "food_name": "Camembert cheese"}

    [food] = read_eatthismuch(eatthismuch_page(BRIE, similar=similar))

    assert food["name"] == "Brie cheese"


@pytest.mark.parametrize(
    ("brand", "description", "expected"),
    [
        ("Long John Silver's", "Long John Silver's", "Long John Silver's Salmon"),
        (None, "low-sodium", "Salmon, low-sodium"),
        ("Starbucks", "", "Starbucks Salmon"),
    ],
)
def test_eatthismuch_names_tell_same_named_foods_apart(brand, description, expected) -> None:
    record = {**BRIE, "food_name": "Salmon", "manufactured_by": brand, "description": description}

    assert read_eatthismuch(eatthismuch_page(record))[0]["name"] == expected


def test_eatthismuch_food_without_a_gram_weight_is_skipped() -> None:
    record = {**BRIE, "weights": [{"amount": 1, "description": "oz"}]}

    assert read_eatthismuch(eatthismuch_page(record)) == []


def test_eatthismuch_deleted_food_is_skipped() -> None:
    assert read_eatthismuch(eatthismuch_page({**BRIE, "deleted": True})) == []
