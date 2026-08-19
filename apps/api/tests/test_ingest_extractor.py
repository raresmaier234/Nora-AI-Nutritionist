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
        result = OllamaExtractor(client=client).extract("some text")

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
