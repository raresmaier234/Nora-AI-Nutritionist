"""Tests for the pattern library and its renderer (app/services/nutrition_plan/texts.py)."""

import itertools
import json
import re
import string
from datetime import date

import pytest

from app.schemas.nutrition_plan import GoalAnswers
from app.services.nutrition_plan import gates, texts
from app.services.nutrition_plan.person import from_answers

LIBRARY = texts.library("en")
TODAY = date(2026, 10, 30)

# Placeholders a plan's why/guidance/cautions (and add-ons) may use: always known.
CORE_VALUES = {
    "kcal": 1910,
    "protein_g": 175,
    "carbs_g": 180,
    "fat_g": 55,
    "fiber_g": 25,
    "maintenance_kcal": 2550,
    "meals_per_day": 3,
    "protein_per_meal_g": 60,
    "allergies": ["milk", "tree_nuts", "sesame"],
}
# Only summaries use these, and not every plan has them.
PACE_VALUES = {
    "rate_kg_week": 0.6,
    "goal_date": date(2027, 3, 5),
    "weeks": 18,
    "target_weight_kg": 70,
    "start_weight_kg": 80,
}
KNOWN_PLACEHOLDERS = set(CORE_VALUES) | set(PACE_VALUES) | {
    "requested_weeks", "min_kg", "max_kg", "min_date", "max_date",
}
REASON_CODES = {
    "age_16_17", "age_65", "age_65_loss", "breastfeeding", "bmi_17_5_18_5", "no_room_to_lose",
    "bmi_40", "ed_past", "diabetes_team_check", "diabetes_hypo_risk", "diabetes", "glp1",
    "other_diet_condition", "prefer_not", "no_strength_training", "bmi_30_build",
}
ADDON_CODES = {
    "vegan", "vegetarian", "pescatarian", "religious_fasting", "allergies", "low_kcal",
    "maintain_only_minor", "age_65", "breastfeeding", "ed_past", "bmi_40", "diabetes_hypo_risk",
    "religious_fasting_hypo", "diabetes", "glp1", "other_diet_condition", "prefer_not",
}
NOTICE_TEMPLATES = {
    "pace_clamped", "pace_clamped_custom", "pace_clamped_no_target", "pace_clamped_block",
    "calorie_floor", "tiny_deficit", "gain_block", "recomp_block", "gain_target_high",
}


def plan_keys() -> list[str]:
    """Every pattern key the algorithm can produce for phase `start`."""
    keys = [
        f"lose_fat.{pace}.{training}.start"
        for pace, training in itertools.product(
            ("gentle", "steady", "faster"), ("none", "beginner", "trained")
        )
    ]
    keys += [
        f"recomp.{pace}.{training}.start"
        for pace, training in itertools.product(("gentle", "steady"), ("beginner", "trained"))
    ]
    keys += [
        f"build_muscle.{pace}.{training}.start"
        for pace, training in itertools.product(
            ("gentle", "steady", "faster"), ("beginner", "trained")
        )
    ]
    keys += [f"maintain.steady.{training}.start" for training in ("none", "beginner", "trained")]
    return keys


def all_texts(node) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, list):
        return [text for item in node for text in all_texts(item)]
    if isinstance(node, dict):
        return [text for value in node.values() for text in all_texts(value)]
    return []


def user_facing_texts() -> list[str]:
    sections = ("plans", "summary_without_date", "common", "addons", "notices", "reasons",
                "stops", "errors", "disclaimer")
    return [text for section in sections for text in all_texts(LIBRARY[section])]


def test_every_plan_key_is_in_the_library() -> None:
    assert sorted(LIBRARY["plans"]) == sorted(plan_keys())


@pytest.mark.parametrize("key", plan_keys())
def test_every_plan_renders_completely(key) -> None:
    goal = key.split(".")[0]
    values = dict(CORE_VALUES)
    if goal != "maintain":
        values |= PACE_VALUES
    if goal in ("build_muscle", "recomp"):
        values["target_weight_kg"] = None  # optional: a block with no target

    rendered = texts.plan_texts("en", key, values, sorted(ADDON_CODES))

    every = [rendered["summary"], *rendered["why"], *rendered["guidance"], *rendered["cautions"]]
    assert all("{" not in text and "}" not in text for text in every)
    assert rendered["why"] and rendered["guidance"]
    assert rendered["cautions"][-1] == "General guidance, not medical advice."
    assert "~1,910 kcal" in rendered["summary"]
    if goal == "lose_fat":
        assert "5 March 2027" in rendered["summary"]


@pytest.mark.parametrize("key", plan_keys())
def test_only_summaries_need_the_pace_date_and_target(key) -> None:
    """A plan with no date (no deficit possible) must still render its why, guidance and
    cautions, so only summaries may use the pace, date and target placeholders."""
    entry = LIBRARY["plans"][key]
    formatted = texts.format_values("en", CORE_VALUES)
    for line in entry["why"] + entry["guidance"] + entry["cautions"]:
        assert "{" not in texts.fill(line, formatted)


@pytest.mark.parametrize("key", ["lose_fat.gentle.none.start", "recomp.gentle.beginner.start"])
def test_the_dateless_summary_renders(key) -> None:
    values = CORE_VALUES | {"target_weight_kg": 70, "goal_date": None, "weeks": None}
    rendered = texts.plan_texts("en", key, values, [])
    assert "can't promise a date" in rendered["summary"]
    assert "~70 kg" in rendered["summary"]


def test_an_add_on_a_later_library_dropped_is_skipped() -> None:
    rendered = texts.plan_texts("en", "maintain.steady.none.start", CORE_VALUES, ["bmi_18_5_20"])
    assert rendered == texts.plan_texts("en", "maintain.steady.none.start", CORE_VALUES, [])


def test_add_ons_land_in_guidance_and_cautions() -> None:
    rendered = texts.plan_texts("en", "maintain.steady.none.start", CORE_VALUES, ["vegan", "glp1"])
    assert any("tofu" in line for line in rendered["guidance"])
    assert any("upper limit" in line for line in rendered["cautions"])
    assert "about 60 g at each" in " ".join(rendered["guidance"])


def test_allergies_are_listed_by_name() -> None:
    rendered = texts.plan_texts("en", "maintain.steady.none.start", CORE_VALUES, ["allergies"])
    assert "milk and lactose, tree nuts and sesame" in " ".join(rendered["guidance"])


def test_every_code_has_its_text() -> None:
    assert set(LIBRARY["reasons"]) == REASON_CODES
    assert set(LIBRARY["stops"]) == set(gates.STOP_CODES)
    assert set(LIBRARY["addons"]) == ADDON_CODES
    assert set(LIBRARY["notices"]) == NOTICE_TEMPLATES
    assert set(LIBRARY["allergy_names"]) == {
        "milk", "gluten", "eggs", "peanuts", "tree_nuts", "soy", "fish", "shellfish", "sesame"
    }


def test_the_gates_only_produce_reasons_the_library_has() -> None:
    """Every reason code in gates.py's source has a text."""
    source = open(gates.__file__, encoding="utf-8").read()
    used = set(re.findall(r'(?:only|remove|note)\(\s*"([a-z0-9_]+)"', source))
    assert used == REASON_CODES


def test_placeholders_are_all_known() -> None:
    formatter = string.Formatter()
    for text in user_facing_texts():
        names = {name for _, name, _, _ in formatter.parse(text) if name is not None}
        assert names <= KNOWN_PLACEHOLDERS, text


def test_no_hard_coded_numbers() -> None:
    """Numbers come from the algorithm, through placeholders ("B12" and "omega-3" are names)."""
    for text in user_facing_texts():
        assert not re.search(r"(?<![\w-])\d", re.sub(r"\{[a-z_]+\}", "", text)), text


def test_stop_screens_show_no_numbers_and_point_to_a_professional() -> None:
    for code in gates.STOP_CODES:
        screen = texts.stop_screen("en", code)
        assert screen["code"] == code
        assert not re.search(r"\d|\{", screen["title"] + screen["body"])
        assert re.search(r"doctor|midwife|team|specialist|nurse", screen["body"])


def test_no_labels_the_wording_rules_forbid() -> None:
    for text in user_facing_texts():
        assert not re.search(r"underweight|overweight|obese|obesity", text, re.IGNORECASE), text


def test_notices_render() -> None:
    notice = {
        "code": "pace_clamped",
        "template": "pace_clamped_custom",
        "params": {"requested_weeks": 12, "target_weight_kg": 70, "goal_date": "2027-03-05",
                   "weeks": 18, "rate_kg_week": 0.6},
    }
    assert texts.notice_message("en", notice) == (
        "12 weeks is faster than we recommend. At a safe pace you'd reach ~70 kg around "
        "5 March 2027 (~18 weeks)."
    )
    assert "~1,200 kcal" in texts.notice_message(
        "en", {"code": "calorie_floor", "params": {"kcal": 1200}}
    )


def test_romanian_falls_back_to_english_for_now() -> None:
    assert texts.library("ro") == LIBRARY
    assert texts.reason_message("ro", "glp1") == texts.reason_message("en", "glp1")


def test_number_formatting() -> None:
    formatted = texts.format_values(
        "en", {"kcal": 2160, "rate_kg_week": 0.25, "target_weight_kg": 70.0, "weeks": 40,
               "goal_date": date(2027, 8, 1), "protein_g": 175, "start_weight_kg": 80.5}
    )
    assert formatted == {
        "kcal": "2,160", "rate_kg_week": "0.25", "target_weight_kg": "70", "weeks": "40",
        "goal_date": "1 August 2027", "protein_g": "175", "start_weight_kg": "80.5",
    }


def test_the_library_is_valid_json_with_the_shape_the_renderer_reads() -> None:
    raw = json.loads((texts.PATTERNS_DIR / "en.json").read_text(encoding="utf-8"))
    assert raw["language"] == "en"
    assert len(raw["months"]) == 12
    for entry in raw["plans"].values():
        assert set(entry) == {"summary", "why", "guidance", "cautions"}


@pytest.mark.parametrize(
    ("answers", "goal", "codes"),
    [
        ({}, "maintain", []),
        ({"eating_style": "vegan", "religious_fasting": True, "allergies": ["soy"]}, "maintain",
         ["vegan", "religious_fasting", "allergies"]),
        ({"eating_style": "omnivore"}, "maintain", []),
        ({"birth_year": 2009, "birth_month": 1}, "maintain", ["maintain_only_minor"]),
        ({"birth_year": 1955, "birth_month": 1}, "maintain", ["age_65"]),
        ({"health": ["breastfeeding"]}, "maintain", ["breastfeeding"]),
        ({"health": ["eating_disorder"], "ed_status": "past"}, "maintain", ["ed_past"]),
        ({"weight_kg": 110}, "lose_fat", ["bmi_40"]),
        ({"weight_kg": 110}, "recomp", ["bmi_40"]),
        ({"weight_kg": 110}, "maintain", []),
        ({"health": ["diabetes"], "diabetes_hypo_risk": "yes", "religious_fasting": True},
         "maintain", ["religious_fasting", "diabetes_hypo_risk", "religious_fasting_hypo"]),
        ({"health": ["diabetes"], "diabetes_hypo_risk": "not_sure"}, "maintain",
         ["diabetes_hypo_risk"]),
        ({"health": ["diabetes"], "diabetes_hypo_risk": "no"}, "maintain", ["diabetes"]),
        ({"health": ["glp1", "other_diet_condition"]}, "lose_fat",
         ["glp1", "other_diet_condition"]),
        ({"health": ["prefer_not"]}, "lose_fat", ["prefer_not"]),
    ],
)
def test_addon_codes(answers, goal, codes) -> None:
    base = {"birth_year": 1990, "birth_month": 1, "sex": "female", "height_cm": 165,
            "weight_kg": 65, "health": ["none"]}
    parsed = GoalAnswers(**(base | answers))
    assert texts.addon_codes(parsed, from_answers(parsed, TODAY), goal, 1800) == codes


@pytest.mark.parametrize(("kcal", "low"), [(1400, True), (1410, False)])
def test_low_calorie_plans_get_a_nutrient_caution(kcal, low) -> None:
    parsed = GoalAnswers(birth_year=1990, birth_month=1, sex="female", height_cm=165,
                         weight_kg=65, health=["none"])
    codes = texts.addon_codes(parsed, from_answers(parsed, TODAY), "lose_fat", kcal)
    assert ("low_kcal" in codes) is low
