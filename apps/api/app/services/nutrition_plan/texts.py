"""The pattern library (`patterns/<language>.json`) and its renderer.

The library holds every text the plan shows: plan texts per pattern key
(`goal.pace band.training.phase`), add-ons (eating style, allergies, safety notes), notices,
gate reasons, stop screens and a few error messages. Texts have `{placeholders}` and no
hard-coded numbers; the numbers come from the algorithm and are filled in here. A language
without a file yet (Romanian, for now) falls back to English.

Plan texts are rendered when a plan is read, from what the plan stored, so a corrected
text reaches every plan.
"""

import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.schemas.nutrition_plan import GoalAnswers
from app.services.nutrition_plan import gates
from app.services.nutrition_plan.person import Person

PATTERNS_DIR = Path(__file__).parent / "patterns"
FALLBACK_LANGUAGE = "en"

# Placeholders and how each is formatted.
WHOLE_NUMBERS = ("kcal", "maintenance_kcal")
GRAMS = ("protein_g", "carbs_g", "fat_g", "fiber_g", "protein_per_meal_g")
COUNTS = ("weeks", "requested_weeks", "meals_per_day")
KILOGRAMS = ("target_weight_kg", "start_weight_kg", "min_kg", "max_kg")
DATES = ("goal_date", "min_date", "max_date")


@lru_cache
def library(language: str) -> dict[str, Any]:
    path = PATTERNS_DIR / f"{language}.json"
    if not path.exists():
        path = PATTERNS_DIR / f"{FALLBACK_LANGUAGE}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _number(value: float, decimals: int, lib: dict[str, Any]) -> str:
    """At most `decimals` decimals, without trailing zeros: 70 → "70", 0.6 → "0.6"."""
    text = f"{value:.{decimals}f}".rstrip("0").rstrip(".") if decimals else f"{value:.0f}"
    return text.replace(".", lib["number_format"]["decimal"])


def _thousands(value: int, lib: dict[str, Any]) -> str:
    return f"{value:,}".replace(",", lib["number_format"]["thousands"])


def _date(value: date | str, lib: dict[str, Any]) -> str:
    if isinstance(value, str):
        value = date.fromisoformat(value)
    return lib["date_format"].format(
        day=value.day, month=lib["months"][value.month - 1], year=value.year
    )


def _list(items: list[str], lib: dict[str, Any]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return f"{', '.join(items[:-1])} {lib['and']} {items[-1]}"


def format_values(language: str, values: dict[str, Any]) -> dict[str, str]:
    """Each value as it appears in a text. None values are left out, so a template that
    needs one fails loudly (KeyError) instead of printing "None"."""
    lib = library(language)
    out: dict[str, str] = {}
    for key, value in values.items():
        if value is None:
            continue
        if key in WHOLE_NUMBERS:
            out[key] = _thousands(int(value), lib)
        elif key in GRAMS or key in COUNTS:
            out[key] = _number(value, 0, lib)
        elif key == "rate_kg_week":
            out[key] = _number(value, 2, lib)
        elif key in KILOGRAMS:
            out[key] = _number(value, 1, lib)
        elif key in DATES:
            out[key] = _date(value, lib)
        elif key == "allergies":
            out[key] = _list([lib["allergy_names"][item] for item in value], lib)
        else:
            out[key] = str(value)
    return out


def fill(template: str, values: dict[str, str]) -> str:
    return template.format_map(values)


def reason_message(language: str, code: str) -> str:
    return library(language)["reasons"][code]


def stop_screen(language: str, code: str) -> dict[str, str]:
    screen = library(language)["stops"][code]
    return {"code": code, "title": screen["title"], "body": screen["body"]}


def notice_message(language: str, notice: dict[str, Any]) -> str:
    template = library(language)["notices"][notice.get("template", notice["code"])]
    return fill(template, format_values(language, notice.get("params", {})))


def error_message(language: str, code: str, values: dict[str, Any]) -> str:
    return fill(library(language)["errors"][code], format_values(language, values))


# At or below this many kcal a day, enough iron, calcium and the rest gets harder.
LOW_KCAL = 1400


def addon_codes(answers: GoalAnswers, person: Person, goal: str, kcal: int) -> list[str]:
    """Which add-on texts a plan gets: food first, then safety notes. `kcal` is the plan's
    daily calories, as shown."""
    codes: list[str] = []
    if answers.eating_style in ("vegan", "vegetarian", "pescatarian"):
        codes.append(answers.eating_style)
    if answers.religious_fasting:
        codes.append("religious_fasting")
    if answers.allergies:
        codes.append("allergies")
    conditions = {
        "low_kcal": kcal <= LOW_KCAL,
        "maintain_only_minor": person.minor,
        "age_65": person.older,
        "breastfeeding": person.has("breastfeeding"),
        "ed_past": person.ed_past,
        "bmi_40": goal in gates.LOSS_GOALS and person.bmi >= gates.BMI_DOCTOR_SUPPORT,
        "diabetes_hypo_risk": person.hypo_risk,
        "religious_fasting_hypo": answers.religious_fasting and person.hypo_risk,
        "diabetes": person.has("diabetes") and not person.hypo_risk,
        "glp1": person.has("glp1"),
        "other_diet_condition": person.has("other_diet_condition"),
        "prefer_not": person.has("prefer_not"),
    }
    codes.extend(code for code, applies in conditions.items() if applies)
    return codes


def plan_texts(
    language: str, pattern_key: str, values: dict[str, Any], addons: list[str]
) -> dict[str, Any]:
    """summary, why[], guidance[] and cautions[] for a plan; the last caution is always
    "General guidance, not medical advice."

    Only a plan's summary uses the pace, date and target placeholders; a Lose fat plan with
    no date (no deficit possible) gets the library's dateless summary instead.
    """
    lib = library(language)
    entry = lib["plans"][pattern_key]
    formatted = format_values(language, values)
    goal = pattern_key.split(".")[0]

    summary = entry["summary"]
    if values.get("goal_date") is None and goal in lib["summary_without_date"]:
        summary = lib["summary_without_date"][goal]
    guidance = entry["guidance"] + lib["common"]["guidance"]
    cautions = list(entry["cautions"])
    for code in addons:
        # A plan keeps the add-on codes it was built with; one a later library dropped is
        # skipped rather than breaking the plan.
        addon = lib["addons"].get(code)
        if addon is None:
            continue
        guidance = guidance + addon.get("guidance", [])
        cautions = cautions + addon.get("cautions", [])
    return {
        "summary": fill(summary, formatted),
        "why": [fill(text, formatted) for text in entry["why"]],
        "guidance": [fill(text, formatted) for text in guidance],
        "cautions": [fill(text, formatted) for text in cautions] + [lib["disclaimer"]],
    }
