"""Tests for JSON-LD extraction and recipe normalisation.

The shapes below are the ones real sites actually publish; each was a crash or a silent
miss before extraction handled them uniformly.
"""

import pytest

from app.services.scraping import ParseError, extract_json_ld, find_by_type
from app.utils.normalize_recipe import normalize_recipe


def _page(script_body: str, mime: str = "application/ld+json") -> str:
    return f'<html><head><script type="{mime}">{script_body}</script></head><body></body></html>'


# --- document shapes --------------------------------------------------------------


def test_extracts_bare_top_level_object() -> None:
    html = _page('{"@type": "Recipe", "name": "Soup"}')

    assert find_by_type(extract_json_ld(html), "Recipe") == [
        {"@type": "Recipe", "name": "Soup"}
    ]


def test_extracts_from_top_level_array() -> None:
    html = _page('[{"@type": "WebPage"}, {"@type": "Recipe", "name": "Soup"}]')

    recipes = find_by_type(extract_json_ld(html), "Recipe")

    assert [r["name"] for r in recipes] == ["Soup"]


def test_extracts_from_graph_wrapper() -> None:
    html = _page('{"@graph": [{"@type": "Recipe", "name": "Soup"}]}')

    recipes = find_by_type(extract_json_ld(html), "Recipe")

    assert [r["name"] for r in recipes] == ["Soup"]


def test_matches_when_type_is_a_list() -> None:
    html = _page('{"@type": ["Recipe", "Thing"], "name": "Soup"}')

    assert len(find_by_type(extract_json_ld(html), "Recipe")) == 1


def test_returns_every_match_on_the_page() -> None:
    html = _page('[{"@type": "Recipe", "name": "A"}, {"@type": "Recipe", "name": "B"}]')

    recipes = find_by_type(extract_json_ld(html), "Recipe")

    assert [r["name"] for r in recipes] == ["A", "B"]


def test_tolerates_charset_suffix_on_mime_type() -> None:
    html = _page('{"@type": "Recipe", "name": "Soup"}', mime="application/ld+json;charset=utf-8")

    assert len(find_by_type(extract_json_ld(html), "Recipe")) == 1


def test_malformed_block_does_not_discard_valid_ones() -> None:
    html = (
        "<html><head>"
        '<script type="application/ld+json">{ not json }</script>'
        '<script type="application/ld+json">{"@type": "Recipe", "name": "Soup"}</script>'
        "</head></html>"
    )

    assert len(find_by_type(extract_json_ld(html), "Recipe")) == 1


def test_page_without_json_ld_yields_nothing() -> None:
    assert extract_json_ld("<html><body><p>no structured data</p></body></html>") == []


# --- normalisation ----------------------------------------------------------------


def test_normalises_numeric_nutrition_values() -> None:
    recipe = normalize_recipe(
        {
            "name": "Pancakes",
            "recipeIngredient": ["flour"],
            "nutrition": {"calories": 350, "proteinContent": "12 g"},
        }
    )

    assert recipe.nutrition is not None
    assert recipe.nutrition.calories == "350"
    assert recipe.nutrition.proteinContent == "12 g"


def test_normalises_single_ingredient_given_as_a_string() -> None:
    recipe = normalize_recipe({"name": "Toast", "recipeIngredient": "1 slice of bread"})

    assert recipe.ingredients == ["1 slice of bread"]


def test_missing_name_raises_parse_error_not_a_crash() -> None:
    with pytest.raises(ParseError):
        normalize_recipe({"recipeIngredient": ["water"]})


def test_ignores_nutrition_that_is_not_an_object() -> None:
    recipe = normalize_recipe(
        {"name": "Water", "recipeIngredient": ["water"], "nutrition": "unknown"}
    )

    assert recipe.nutrition is None
