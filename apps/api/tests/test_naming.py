"""Tests for display-name repair."""

import pytest

from app.utils.naming import clean_display_name


@pytest.mark.parametrize(
    ("mangled", "expected"),
    [
        ("babuÈ™cÄƒ", "Babușcă"),
        ("ÃŽngheÈ›atÄƒ Eli", "Înghețată Eli"),
        ("arpacas de grÃ¢u roÈ™u Beatrice", "Arpacas de grâu roșu Beatrice"),
        ("arahide Ã®n coajÄƒ Alesto Lidl", "Arahide în coajă Alesto Lidl"),
        ("Ã˜go Pizza Salami", "Øgo Pizza Salami"),
    ],
)
def test_repairs_double_encoded_utf8(mangled: str, expected: str) -> None:
    assert clean_display_name(mangled) == expected


@pytest.mark.parametrize("name", ["Țâășî Înghețată", "Crème Fraîche", "Øgo", "Plain oats"])
def test_leaves_correct_text_alone(name: str) -> None:
    assert clean_display_name(name) == name


def test_look_alike_a_becomes_romanian_a_breve() -> None:
    assert clean_display_name("Brânzā de burduf, lapte bǎtut") == "Brânză de burduf, lapte bătut"


def test_cedilla_letters_become_comma_below() -> None:
    assert clean_display_name("Brânză şi ţelină") == "Brânză și țelină"


@pytest.mark.parametrize(
    ("name", "expected"),
    [("babușcă", "Babușcă"), ("înghețată", "Înghețată"), ("ţelină", "Țelină"), ("lapte UHT", "Lapte UHT")],
)
def test_first_letter_is_capitalized_and_the_rest_kept(name: str, expected: str) -> None:
    assert clean_display_name(name) == expected
