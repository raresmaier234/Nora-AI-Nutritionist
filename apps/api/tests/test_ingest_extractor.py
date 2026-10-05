"""Tests for page-text reduction and the Ollama extraction client.

No network and no model: Ollama is faked with a MockTransport, so these run anywhere.
"""

import json
import re

import httpx
import pytest

from app.services.ingest.extractor import (
    EXTRACTION_SCHEMA,
    SYSTEM_PROMPT,
    ExtractionError,
    OllamaExtractor,
    html_to_text,
)

NUTRITION_PAGE = """
<html><head><title>Nutella</title></head>
<body>
  <nav>Shop  Account  Basket</nav>
  <h1>Nutella</h1>
  <div class="promo">Every month we serve 8 million visitors. Become a patron!</div>
  <table>
    <tr><td>Energy</td><td>2252 kJ (539 kcal)</td></tr>
    <tr><td>Fat</td><td>30.9 g</td></tr>
    <tr><td>Carbohydrates</td><td>57.5 g</td></tr>
    <tr><td>Proteins</td><td>6.3 g</td></tr>
  </table>
  <footer>Terms and conditions</footer>
</body></html>
"""


def fake_ollama(payload: dict) -> httpx.Client:
    """An Ollama that always answers with `payload`."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"message": {"content": json.dumps(payload)}}
        )

    return httpx.Client(transport=httpx.MockTransport(handler))


# --- the prompt itself -------------------------------------------------------------


def test_the_prompt_contains_no_example_values() -> None:
    """Concrete numbers in the prompt get copied into the output.

    llama3.2 reported the same calorie figure for chocolate spread, cola and pasta —
    it was echoing the sample values the prompt used to illustrate the format, not
    reading the page. Any digit here is a latent repeat of that bug.
    """
    # "per 100g" / "100 ml" define the basis; they are not nutrient values to copy.
    sanitized = re.sub(r"per_100g|100 ?g|100 ?ml", "", SYSTEM_PROMPT, flags=re.IGNORECASE)

    assert not re.search(r"\d", sanitized), (
        "SYSTEM_PROMPT contains an example value; a small model will copy it as an answer"
    )


def test_every_nutrient_field_is_typed_as_a_string() -> None:
    """Numeric fields invite the model to convert units, which it does badly."""
    properties = EXTRACTION_SCHEMA["properties"]["foods"]["items"]["properties"]

    for field, spec in properties.items():
        if field == "basis":
            continue
        assert "string" in spec["type"], f"{field} must be captured verbatim as a string"
        assert "number" not in spec["type"], f"{field} must not be a number"


# --- page text reduction -----------------------------------------------------------


def test_prefers_the_nutrition_panel_over_page_furniture() -> None:
    text = html_to_text(NUTRITION_PAGE)

    assert "2252 kJ" in text
    assert "Proteins" in text
    assert "Become a patron" not in text
    assert "Terms and conditions" not in text


def test_keeps_the_product_name_with_the_panel() -> None:
    assert "Nutella" in html_to_text(NUTRITION_PAGE)


SERVING_PAGE = """
<html><head><title>Butter</title></head><body>
  <h1>Butter</h1>
  <div class="product">
    <div class="picker">
      <span>Amount</span><span>Unit</span>
      <span>grams</span><span>cup</span><span>tbsp</span>
      <span>50 grams</span><span>100 grams</span><span>200 grams</span>
      <span>0.5 tbsp</span><span>1 tbsp</span><span>2 tbsp</span>
    </div>
    <div class="facts">
      <h2>Nutrition Facts</h2>
      <p>For 1 tbsp of butter (14g)</p>
      <table>
        <tr><td>Calories</td><td>102</td></tr>
        <tr><td>Fats</td><td>12g</td></tr>
        <tr><td>Carbs</td><td>0g</td></tr>
        <tr><td>Protein</td><td>0.1g</td></tr>
      </table>
    </div>
  </div>
</body></html>
"""


def test_the_serving_weight_survives_panel_selection() -> None:
    """The caption states what the numbers are per; losing it makes the model guess.

    The innermost nutritional element is often the bare nutrient grid. Picking it purely
    for being smallest drops "For 1 tbsp (14g)", and the model then labels a 14g panel as
    per-100g — which is how butter came to be stored at 134 kcal instead of 717.
    """
    text = html_to_text(SERVING_PAGE)

    assert "14g" in text
    assert "Nutrition Facts" in text


def test_the_amount_picker_is_not_shown_to_the_model() -> None:
    """Its numbers sit inches from the real table and get mistaken for the serving."""
    text = html_to_text(SERVING_PAGE)

    assert "50 grams" not in text
    assert "200 grams" not in text
    assert "102" in text  # the actual value is still there


def test_american_style_labels_are_recognised_as_a_panel() -> None:
    """Sites split between energy/kJ/carbohydrate and calories/carbs/fats vocabularies."""
    text = html_to_text(SERVING_PAGE)

    assert "Calories" in text
    assert "Protein" in text


# Markup as served by kaufland.ro's food encyclopedia (trimmed): a per-100g panel as
# paragraphs, not a table, with no "per 100g" anywhere and a long article around it.
KAUFLAND_PAGE = """
<html><head><title>Gălbenuș de ou | Kaufland</title></head><body>
  <h1>Gălbenuș de ou: partea galbenă a oului</h1>
  <div class="article">
    <p>Gălbenușul de ou înseamnă literalmente „partea galbenă a oului”. Conține proteine,
    grăsimi și vitamine, iar culoarea vine din carotinoidele din furaj.</p>
  </div>
  <div class="g-col">
    <div class="m-text-media">
      <div class="o-richtext--level-3">Valoare nutritivă</div>
      <div class="m-text-media__text">
        <p><strong>kcal:</strong> 137 kcal</p>
        <p><strong>Carbohidrați:</strong> 1,53 g</p>
        <p><strong>Proteine: </strong>11,85 g</p>
        <p><strong>Grăsimi:</strong> 9,32 g</p>
      </div>
    </div>
  </div>
  <div class="related"><p>Rețete cu ou: omletă, maioneză, paste carbonara.</p></div>
</body></html>
"""


def test_isolates_a_romanian_panel() -> None:
    """Regression: English-only markers matched 2 of 3 here, so the model got the page."""
    text = html_to_text(KAUFLAND_PAGE)

    assert "Valoare nutritivă" in text
    assert "11,85 g" in text
    assert "carotinoidele" not in text  # the article around the panel
    assert "carbonara" not in text


GERMAN_PAGE = """
<html><body><h1>Vollmilch</h1>
  <p>Frische Vollmilch aus der Region.</p>
  <table>
    <tr><th>Nährwerte</th><th>pro 100 ml</th></tr>
    <tr><td>Brennwert</td><td>272 kJ / 65 kcal</td></tr>
    <tr><td>Fett</td><td>3,5 g</td></tr>
    <tr><td>Kohlenhydrate</td><td>4,8 g</td></tr>
    <tr><td>Eiweiß</td><td>3,4 g</td></tr>
  </table>
</body></html>
"""


def test_isolates_a_german_panel_and_keeps_its_basis() -> None:
    text = html_to_text(GERMAN_PAGE)

    assert "pro 100 ml" in text
    assert "Eiweiß" in text
    assert "Frische Vollmilch" not in text


@pytest.mark.parametrize(
    "caption",
    ["Nährwerte pro 100 g", "Valoare nutritivă la 100 g", "Valeurs nutritionnelles pour 100 g"],
)
def test_recognises_a_basis_stated_in_other_languages(caption) -> None:
    from app.services.ingest.extractor import _states_a_basis

    assert _states_a_basis(caption)


def test_keeps_each_label_on_the_same_line_as_its_value() -> None:
    """<strong>Proteine: </strong>11,85 g split across lines made the model miss protein."""
    text = html_to_text(KAUFLAND_PAGE.replace("11,85 g", "\u00a011,85 g"))

    assert "Proteine: 11,85 g" in text
    assert "kcal: 137 kcal" in text


def test_nutrition_panel_is_none_when_the_page_has_none() -> None:
    from app.services.ingest.extractor import nutrition_panel

    assert nutrition_panel("<html><body><p>Just an article about food.</p></body></html>") is None
    assert "Valoare nutritivă" in nutrition_panel(KAUFLAND_PAGE)


def test_falls_back_to_page_text_when_there_is_no_panel() -> None:
    text = html_to_text("<html><body><p>Just an article about food.</p></body></html>")

    assert "Just an article about food." in text


def test_caps_the_text_it_returns() -> None:
    huge = "<html><body>" + ("filler " * 50_000) + "</body></html>"

    assert len(html_to_text(huge, max_chars=500)) <= 500


# --- the client --------------------------------------------------------------------


def test_returns_the_foods_the_model_reported() -> None:
    payload = {"foods": [{"name": "Nutella", "basis": "per_100g", "calories": "2252 kJ"}]}

    with fake_ollama(payload) as client:
        result = OllamaExtractor(client=client).extract("Nutella energy 2252 kJ")

    assert [food["name"] for food in result.foods] == ["Nutella"]


def test_raises_when_ollama_is_unreachable() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with httpx.Client(transport=httpx.MockTransport(refuse)) as client:
        with pytest.raises(ExtractionError, match="could not reach Ollama"):
            OllamaExtractor(client=client).extract("some text")


def test_raises_when_the_model_returns_invalid_json() -> None:
    def bad_json(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": {"content": "not json at all"}})

    with httpx.Client(transport=httpx.MockTransport(bad_json)) as client:
        with pytest.raises(ExtractionError, match="valid JSON"):
            OllamaExtractor(client=client).extract("some text")


def test_raises_when_the_payload_has_no_foods_list() -> None:
    with fake_ollama({"result": "oops"}) as client:
        with pytest.raises(ExtractionError, match="no 'foods' list"):
            OllamaExtractor(client=client).extract("some text")


QUINCE_PANEL = (
    "Gutui: aurii și aromate\nValoare nutritivă\nkcal: 38 kcal\nCarbohidrați: 7,3 g\n"
    "Proteine: 0,4 g\nGrăsimi: 0,5 g"
)


def test_fills_a_row_the_model_skipped() -> None:
    """Regression: llama3.2 returned protein as null for this exact panel, every time."""
    food = {
        "name": "Gutui",
        "basis": "per_100g",
        "calories": "38 kcal",
        "protein": None,
        "fat": "0,5 g",
        "carbs": "7,3 g",
    }

    with fake_ollama({"foods": [food]}) as client:
        result = OllamaExtractor(client=client).extract(QUINCE_PANEL)

    assert result.foods[0]["protein"] == "0,4 g"


def test_fills_labels_written_on_their_own_line() -> None:
    from app.services.ingest.extractor import fill_from_labels

    text = "Milk\nNutrition facts\nProtein\n3,4 g\nFett\n3,5 g"
    filled = fill_from_labels([{"name": "Milk", "protein": None, "fat": None}], text)

    assert filled[0]["protein"] == "3,4 g"
    assert filled[0]["fat"] == "3,5 g"


def test_leaves_a_row_with_two_columns_alone() -> None:
    """Per serving next to per 100g: taking either could pair a value with the wrong basis."""
    from app.services.ingest.extractor import fill_from_labels

    text = "Milk\nper serving\nper 100g\nProtein\n7.7 g\n3.2 g"
    filled = fill_from_labels([{"name": "Milk", "protein": None}], text)

    assert filled[0]["protein"] is None


def test_does_not_fill_when_the_page_has_several_foods() -> None:
    from app.services.ingest.extractor import fill_from_labels

    foods = [{"name": "A", "protein": None}, {"name": "B", "protein": None}]

    assert fill_from_labels(foods, "Protein: 3 g") == foods


def test_does_not_mistake_saturated_fat_for_fat() -> None:
    from app.services.ingest.extractor import fill_from_labels

    filled = fill_from_labels([{"name": "Cheese", "fat": None}], "Cheese\nSaturated fat: 20 g")

    assert filled[0]["fat"] is None


def test_drops_values_the_page_does_not_print() -> None:
    """A small model fills gaps with plausible numbers; each must be found on the page."""
    food = {
        "name": "Nuca de cocos",
        "basis": "per_100g",
        "calories": "45 kcal",  # invented: the page says 363
        "fat": "36,5 g",
        "protein": "3.9g",  # same number, written differently: kept
    }

    with fake_ollama({"foods": [food]}) as client:
        result = OllamaExtractor(client=client).extract(
            "Nuca de cocos\nkcal: 363 kcal\nProteine: 3,9 g\nGrăsimi: 36,5 g"
        )

    kept = result.foods[0]
    # The invented figure is gone; the page's own labelled row takes its place.
    assert kept["calories"] == "363 kcal"
    assert kept["fat"] == "36,5 g"
    assert kept["protein"] == "3.9g"


def test_a_grouped_number_on_the_page_matches_the_models_plain_one() -> None:
    food = {"name": "Oil", "basis": "per_100g", "calories": "3700 kJ"}

    with fake_ollama({"foods": [food]}) as client:
        result = OllamaExtractor(client=client).extract("Oil\nEnergy 3 700 kJ / 884 kcal")

    assert result.foods[0]["calories"] == "3700 kJ"


def test_drops_a_serving_weight_the_page_does_not_print() -> None:
    """Seen live: "kcal: 50 kcal" became a 50g serving, doubling every stored value."""
    food = {"name": "Kiwi", "basis": "per_serving", "serving_grams": "50g", "calories": "50 kcal"}

    with fake_ollama({"foods": [food]}) as client:
        result = OllamaExtractor(client=client).extract("Kiwi\nkcal: 50 kcal\nProteine: 0,9 g")

    assert result.foods[0]["serving_grams"] is None


def test_a_nutrient_row_does_not_count_as_a_serving_weight() -> None:
    """An invented 50g serving must not pass just because some nutrient weighs 50g."""
    food = {"name": "Oats", "basis": "per_serving", "serving_grams": "50"}

    with fake_ollama({"foods": [food]}) as client:
        result = OllamaExtractor(client=client).extract("Oats\nCarbohydrate: 50 g\nFat: 7 g")

    assert result.foods[0]["serving_grams"] is None


@pytest.mark.parametrize(
    ("page", "serving"),
    [
        ("For 1 tbsp of butter (14g)", "14g"),
        ("Per slice (28 g)", "28"),
        ("Portion 14,5 g", "14.5 g"),
    ],
)
def test_keeps_a_serving_weight_the_page_prints(page, serving) -> None:
    food = {"name": "X", "basis": "per_serving", "serving_grams": serving}

    with fake_ollama({"foods": [food]}) as client:
        result = OllamaExtractor(client=client).extract(page)

    assert result.foods[0]["serving_grams"] == serving


def test_sends_the_schema_so_output_shape_is_guaranteed() -> None:
    seen: dict = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"message": {"content": json.dumps({"foods": []})}})

    with httpx.Client(transport=httpx.MockTransport(capture)) as client:
        OllamaExtractor(client=client, model="llama3.2:latest").extract("text")

    assert seen["format"] == EXTRACTION_SCHEMA
    assert seen["options"]["temperature"] == 0  # extraction must be reproducible
    assert seen["model"] == "llama3.2:latest"
