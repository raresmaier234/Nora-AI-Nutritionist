"""Tests for the safety gates and target validation (app/services/nutrition_plan/gates.py).

One test (or case) per row of the spec's safety table (docs/plans/ai-nutrition-plan.md).
"""

import dataclasses

import pytest

from app.services.nutrition_plan import gates
from app.services.nutrition_plan.person import Person

ALL = ("lose_fat", "recomp", "build_muscle", "maintain")


def person(**changes) -> Person:
    """A 35-year-old woman, 165 cm, 65 kg (BMI 23.9), who strength trains twice a week."""
    base = Person(
        age=35,
        sex="female",
        height_cm=165,
        weight_kg=65,
        health=frozenset({"none"}),
        diabetes_hypo_risk=None,
        diabetes_team_ack=False,
        ed_status=None,
        targets_wanted=None,
        activity="some_walking",
        strength_days=2,
        cardio_days=1,
        lifting_experience="lt_1y",
        will_train=None,
    )
    if "health" in changes and changes["health"] is not None:
        changes["health"] = frozenset(changes["health"])
    return dataclasses.replace(base, **changes)


def at_bmi(bmi: float) -> float:
    return round(bmi * 1.65**2, 1)


def test_nothing_special_allows_every_goal() -> None:
    gate = gates.evaluate(person(), "lose_fat")
    assert gate == gates.Gate(result="ok", allowed_goals=ALL, reasons=(), stop=None)


def test_unknown_answers_trigger_nothing() -> None:
    unknown = Person(
        age=None, sex=None, height_cm=None, weight_kg=None, health=None,
        diabetes_hypo_risk=None, diabetes_team_ack=False, ed_status=None, targets_wanted=None,
        activity=None,
        strength_days=None, cardio_days=None, lifting_experience=None, will_train=None,
    )
    assert gates.evaluate(unknown, None).allowed_goals == ALL


# --- Stops -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"age": 15}, "under_16"),
        ({"health": {"pregnant"}}, "pregnancy"),
        ({"health": {"eating_disorder"}, "ed_status": "current"}, "ed_current"),
        ({"health": {"eating_disorder"}, "ed_status": "prefer_not"}, "ed_current"),
        ({"health": {"eating_disorder"}, "ed_status": None}, "ed_current"),  # not answered yet
        ({"health": {"kidney"}}, "kidney"),
        ({"health": {"bariatric"}}, "bariatric"),
        ({"weight_kg": at_bmi(17.4)}, "bmi_low"),
        # An eating disorder in the past: log without targets unless they ask for a plan.
        ({"health": {"eating_disorder"}, "ed_status": "past"}, "targets_declined"),
        ({"health": {"eating_disorder"}, "ed_status": "past", "targets_wanted": False},
         "targets_declined"),
    ],
)
def test_stops(changes, code) -> None:
    gate = gates.evaluate(person(**changes), "maintain")
    assert gate == gates.Gate(result="stop", allowed_goals=(), reasons=(), stop=code)


def test_one_stop_screen_in_priority_order() -> None:
    gate = gates.evaluate(person(age=15, health={"pregnant", "kidney"}), "maintain")
    assert gate.stop == "under_16"
    assert gates.evaluate(person(health={"kidney", "pregnant"}), "maintain").stop == "pregnancy"


def test_sixteen_is_old_enough() -> None:
    assert gates.evaluate(person(age=16), "maintain").stop is None


# --- Maintain only ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"age": 16}, "age_16_17"),
        ({"age": 17}, "age_16_17"),
        ({"health": {"breastfeeding"}}, "breastfeeding"),
        ({"health": {"eating_disorder"}, "ed_status": "past", "targets_wanted": True}, "ed_past"),
    ],
)
def test_maintain_only(changes, code) -> None:
    gate = gates.evaluate(person(**changes), "lose_fat")
    assert gate.result == "maintain_only"
    assert gate.allowed_goals == ("maintain",)
    assert code in gate.reasons


def test_eighteen_is_an_adult() -> None:
    assert gates.evaluate(person(age=18), "lose_fat").allowed_goals == ALL


# --- BMI -------------------------------------------------------------------------------------


def test_bmi_17_5_to_18_5_maintain_or_build_muscle() -> None:
    gate = gates.evaluate(person(weight_kg=at_bmi(18)), "lose_fat")
    assert gate.result == "ok"
    assert gate.allowed_goals == ("build_muscle", "maintain")
    assert gate.reasons == ("bmi_17_5_18_5",)
    # Not mentioned to someone who picked one of the allowed goals.
    assert gates.evaluate(person(weight_kg=at_bmi(18)), "build_muscle").reasons == ()


@pytest.mark.parametrize("bmi", [18.7, 19.5, 20.2])
def test_below_bmi_20_and_a_kilo_there_is_no_room_to_lose(bmi) -> None:
    """The lowest target is BMI 20, at least 1 kg lower: none exists here."""
    for goal in ("lose_fat", "recomp"):
        gate = gates.evaluate(person(weight_kg=at_bmi(bmi)), goal)
        assert gate.allowed_goals == ("build_muscle", "maintain")
        assert gate.reasons == ("no_room_to_lose",)


def test_from_bmi_20_and_a_kilo_lose_fat_is_allowed() -> None:
    assert gates.evaluate(person(weight_kg=at_bmi(21)), "lose_fat").allowed_goals == ALL


def test_bmi_40_note() -> None:
    gate = gates.evaluate(person(weight_kg=at_bmi(41)), "lose_fat")
    assert "lose_fat" in gate.allowed_goals
    assert "bmi_40" in gate.reasons


def test_bmi_40_note_is_only_for_losing_weight() -> None:
    assert gates.evaluate(person(weight_kg=at_bmi(41)), "maintain").reasons == ()


def test_build_muscle_from_bmi_30_is_steered_elsewhere() -> None:
    gate = gates.evaluate(person(weight_kg=at_bmi(30)), "build_muscle")
    assert gate.allowed_goals == ("lose_fat", "recomp", "maintain")
    assert gate.reasons == ("bmi_30_build",)


# --- Health ----------------------------------------------------------------------------------


@pytest.mark.parametrize("hypo", ["yes", "not_sure", None])
def test_diabetes_with_hypo_risk_needs_the_team_check_for_lose_fat(hypo) -> None:
    diabetic = person(health={"diabetes"}, diabetes_hypo_risk=hypo)

    gate = gates.evaluate(diabetic, "lose_fat")
    assert gate.allowed_goals == ("build_muscle", "maintain")
    assert gate.reasons == ("diabetes_team_check", "diabetes_hypo_risk")
    assert gates.evaluate(diabetic, "recomp").allowed_goals == ("build_muscle", "maintain")

    gate = gates.evaluate(dataclasses.replace(diabetic, diabetes_team_ack=True), "lose_fat")
    assert gate.allowed_goals == ALL
    assert gate.reasons == ("diabetes_hypo_risk",)


def test_diabetes_without_hypo_risk_gets_a_doctor_note() -> None:
    gate = gates.evaluate(person(health={"diabetes"}, diabetes_hypo_risk="no"), "lose_fat")
    assert gate.allowed_goals == ALL
    assert gate.reasons == ("diabetes",)


@pytest.mark.parametrize("item", ["glp1", "other_diet_condition", "prefer_not"])
def test_allowed_with_a_note(item) -> None:
    gate = gates.evaluate(person(health={item}), "lose_fat")
    assert gate.allowed_goals == ALL
    assert gate.reasons == (item,)


def test_age_65_note() -> None:
    gate = gates.evaluate(person(age=70, weight_kg=at_bmi(27)), "lose_fat")
    assert gate.allowed_goals == ALL
    assert gate.reasons == ("age_65",)


@pytest.mark.parametrize("bmi", [20, 23.9, 24.9])
def test_from_65_weight_loss_needs_bmi_25(bmi) -> None:
    """Keeping muscle and weight matters more from 65 (GLIM, ESPEN): no loss below BMI 25."""
    for goal in ("lose_fat", "recomp"):
        gate = gates.evaluate(person(age=70, weight_kg=at_bmi(bmi)), goal)
        assert gate.allowed_goals == ("build_muscle", "maintain")
        assert gate.reasons == ("age_65", "age_65_loss")


# --- Build muscle without training ---------------------------------------------------------


@pytest.mark.parametrize("goal", ["build_muscle", "recomp"])
@pytest.mark.parametrize("days", [0, 1])
@pytest.mark.parametrize(("will_train", "allowed"), [(None, False), (False, False), (True, True)])
def test_a_muscle_goal_under_2_strength_days_needs_the_intent_to_train(
    goal, days, will_train, allowed
) -> None:
    gate = gates.evaluate(person(strength_days=days, will_train=will_train), goal)
    assert (goal in gate.allowed_goals) is allowed
    assert ("no_strength_training" in gate.reasons) is not allowed


def test_reasons_that_rule_out_another_goal_are_left_out() -> None:
    gate = gates.evaluate(person(strength_days=0), "lose_fat")
    assert gate.allowed_goals == ("lose_fat", "maintain")
    assert gate.reasons == ()


# --- Target validation -----------------------------------------------------------------------


def test_lose_fat_target_must_be_a_kilo_lower() -> None:
    problem = gates.check_target(person(), "lose_fat", 64.1)
    assert problem.code == "target_not_below"
    assert problem.max_kg == 64.0
    assert gates.check_target(person(), "lose_fat", 64.0) is None


def test_lose_fat_target_must_be_at_least_bmi_20() -> None:
    lowest = gates.lowest_lose_target_kg(person())  # 20 × 1.65² = 54.45 → 54.5
    assert lowest == 54.5
    for goal in ("lose_fat", "recomp"):
        problem = gates.check_target(person(), goal, 54.4)
        assert (problem.code, problem.min_kg) == ("target_too_low", 54.5)
        assert gates.check_target(person(), goal, 54.5) is None


def test_from_65_the_lowest_target_is_bmi_23() -> None:
    older = person(age=70, weight_kg=at_bmi(28))
    assert gates.lowest_lose_target_kg(older) == 62.7  # 23 × 1.65² = 62.62 → 62.7


def test_build_muscle_target_must_be_a_kilo_higher() -> None:
    problem = gates.check_target(person(), "build_muscle", 65.9)
    assert (problem.code, problem.min_kg) == ("target_not_above", 66.0)
    assert gates.check_target(person(), "build_muscle", 66) is None


def test_build_muscle_target_above_bmi_27_is_only_a_warning() -> None:
    assert gates.check_target(person(), "build_muscle", 75) is None  # BMI 27.5
    assert gates.bulk_target_is_high(person(), 75)
    assert not gates.bulk_target_is_high(person(), 73)
