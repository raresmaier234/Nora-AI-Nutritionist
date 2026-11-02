"""Tests for the nutrition plan algorithm (app/services/nutrition_plan/algorithm.py).

Pure functions: no database, and `today` is fixed. Numbers are the spec's
(docs/plans/ai-nutrition-plan.md, "The algorithm").
"""

import dataclasses
import itertools
from datetime import date, timedelta

import pytest

from app.services.nutrition_plan import algorithm as alg
from app.services.nutrition_plan.person import Person, age_on

TODAY = date(2026, 10, 30)


def person(**changes) -> Person:
    """The spec's worked example: male, 35, 180 cm, 80 kg, some walking, 3 strength days."""
    base = Person(
        age=35,
        sex="male",
        height_cm=180,
        weight_kg=80,
        health=frozenset({"none"}),
        diabetes_hypo_risk=None,
        diabetes_team_ack=False,
        ed_status=None,
        targets_wanted=None,
        activity="some_walking",
        strength_days=3,
        cardio_days=0,
        lifting_experience="1_3y",
        will_train=None,
    )
    if "health" in changes:
        changes["health"] = frozenset(changes["health"])
    return dataclasses.replace(base, **changes)


def weight_for_bmi(bmi: float, height_cm: float = 180) -> float:
    return round(bmi * (height_cm / 100) ** 2, 1)


# --- The worked example ----------------------------------------------------------------------


def test_the_specs_worked_example() -> None:
    """80 kg man wanting −10 kg in 12 weeks: clamped to his max, then the deficit cap; the date
    comes from the effective rate. Protein is 2.2 g/kg, held to 35% of the calories."""
    plan = alg.build_plan(person(), "lose_fat", "custom", 70, TODAY + timedelta(weeks=12), TODAY)

    assert plan.bmr == 1755
    assert plan.tdee == pytest.approx(2545, abs=1)
    assert plan.requested_rate_kg_week == pytest.approx(0.83, abs=0.01)  # 1.04% a week
    assert plan.max_rate_kg_week == pytest.approx(0.6)  # BMI < 25: 0.75%
    assert plan.tdee - plan.kcal == pytest.approx(0.25 * plan.tdee)  # 660 kcal capped at 25%
    assert plan.targets == {
        "kcal": 1910, "protein_g": 165, "carbs_g": 190, "fat_g": 55, "fiber_g": 25
    }
    assert plan.macros.protein_g_per_kg == 2.2  # training, BMI < 25
    assert plan.macros.protein_g == pytest.approx(0.35 * plan.kcal / 4)  # 176 g, held to 167
    assert plan.macros.fat_min_g == pytest.approx(48)
    assert plan.effective_rate_kg_week == pytest.approx(0.58, abs=0.005)
    assert plan.weeks == 18
    assert plan.goal_date == TODAY + timedelta(weeks=18)
    assert plan.clamped
    assert set(plan.rules) >= {"max_rate", "deficit_cap", "protein_share_cap"}
    [notice] = plan.notices
    assert notice["code"] == "pace_clamped"
    assert notice["params"] == {
        "rate_kg_week": 0.6,
        "goal_date": (TODAY + timedelta(weeks=18)).isoformat(),
        "weeks": 18,
        "target_weight_kg": 70,
        "requested_weeks": 12,
    }


# --- Age -------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("born", "today", "age"),
    [
        ((2010, 5), date(2026, 5, 30), 15),  # might have turned 16 on the 1st: assume not yet
        ((2010, 5), date(2026, 5, 31), 16),
        ((2010, 5), date(2026, 6, 1), 16),
        ((2010, 6), date(2026, 5, 31), 15),
        ((2008, 2), date(2026, 2, 28), 17),  # born by 29 February 2008 at the latest
        ((2008, 2), date(2026, 3, 1), 18),
        ((1991, 12), date(2026, 10, 30), 34),
    ],
)
def test_age_is_the_youngest_possible(born, today, age) -> None:
    assert age_on(*born, today) == age


# --- Energy ----------------------------------------------------------------------------------


@pytest.mark.parametrize(("sex", "bmr"), [("male", 1755), ("female", 1589), ("unspecified", 1672)])
def test_bmr_is_mifflin_st_jeor(sex, bmr) -> None:
    assert alg.bmr(80, 180, 35, sex) == bmr


@pytest.mark.parametrize(
    ("activity", "strength", "cardio", "multiplier"),
    [
        ("mostly_sitting", 0, 0, 1.2),
        ("some_walking", 0, 0, 1.375),
        ("on_feet", 0, 0, 1.5),
        ("physical_work", 0, 0, 1.7),
        ("some_walking", 3, 0, 1.45),
        ("mostly_sitting", 2, 3, 1.2 + 0.05 + 0.105),
        ("physical_work", 7, 7, 2.0),  # 2.12, capped
        ("on_feet", 7, 7, 1.92),
    ],
)
def test_activity_multiplier(activity, strength, cardio, multiplier) -> None:
    assert alg.activity_multiplier(activity, strength, cardio) == pytest.approx(multiplier)


def test_tdee_and_the_breastfeeding_allowance() -> None:
    mum = person(sex="female", health={"breastfeeding"})
    assert alg.tdee(person()) == pytest.approx(1755 * 1.45)
    assert alg.tdee(mum) == pytest.approx(1589 * 1.45 + 400)


@pytest.mark.parametrize(("weight", "pw"), [(70, 70), (81, 81), (120, 81)])
def test_protein_weight_is_capped_at_bmi_25(weight, pw) -> None:
    assert person(weight_kg=weight).protein_weight_kg == pytest.approx(pw)


# --- Paces and their limits ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "fraction"),
    [
        ({"weight_kg": weight_for_bmi(24)}, 0.0075),
        ({"weight_kg": weight_for_bmi(25)}, 0.01),
        ({"weight_kg": weight_for_bmi(35)}, 0.01),
        ({"weight_kg": weight_for_bmi(35), "age": 65}, 0.005),
        ({"health": {"diabetes"}, "diabetes_hypo_risk": "yes"}, 0.005),
        ({"health": {"diabetes"}, "diabetes_hypo_risk": "not_sure"}, 0.005),
        ({"health": {"diabetes"}, "diabetes_hypo_risk": "no"}, 0.0075),
        ({"health": {"prefer_not"}}, 0.005),
    ],
)
def test_personal_max_loss_rate(changes, fraction) -> None:
    assert alg.max_loss_fraction(person(**changes)) == fraction


def test_loss_paces() -> None:
    p = alg.loss_paces(person(), "lose_fat")  # BMI 24.7: max 0.75%
    assert p.fractions == {"gentle": 0.003, "steady": 0.005, "faster": 0.0075}
    assert p.faster_available

    p = alg.loss_paces(person(weight_kg=weight_for_bmi(32)), "lose_fat")
    assert p.fractions == {"gentle": 0.003, "steady": 0.0075, "faster": 0.01}
    assert p.faster_available


def test_lose_fat_and_build_muscle_has_no_faster() -> None:
    """A bigger deficit makes building muscle much harder: Gentle and Steady only."""
    p = alg.loss_paces(person(), "recomp")
    assert p.fractions == {"gentle": 0.003, "steady": 0.005, "faster": 0.005}
    assert not p.faster_available
    options = alg.pace_options(person(), "recomp", None, TODAY)
    assert [o.available for o in options] == [True, True, False]


@pytest.mark.parametrize(
    "changes",
    [
        {"age": 70},  # max 0.5% = Steady: Faster isn't faster
        {"health": {"glp1"}},
        {"health": {"other_diet_condition"}},
        {"health": {"prefer_not"}},
        {"health": {"diabetes"}, "diabetes_hypo_risk": "yes", "diabetes_team_ack": True},
    ],
)
def test_faster_is_hidden_when_it_isnt_above_steady_or_is_ruled_out(changes) -> None:
    p = alg.loss_paces(person(**changes), "lose_fat")

    assert not p.faster_available
    assert p.max_fraction <= p.fractions["steady"]
    assert p.fractions["faster"] == p.max_fraction


def test_no_faster_also_caps_custom_dates_at_steady() -> None:
    glp1 = person(health={"glp1"})
    plan = alg.build_plan(glp1, "lose_fat", "custom", 70, TODAY + timedelta(weeks=8), TODAY)

    assert plan.max_rate_kg_week == pytest.approx(0.005 * 80)
    assert plan.clamped


def test_the_cautious_max_also_caps_steady() -> None:
    """Age 70 with BMI 32: Steady would be 0.75%, but nothing goes past 0.5%."""
    p = alg.loss_paces(person(age=70, weight_kg=weight_for_bmi(32)), "lose_fat")
    assert p.fractions == {"gentle": 0.003, "steady": 0.005, "faster": 0.005}


@pytest.mark.parametrize(
    ("experience", "strength", "band"),
    [
        ("none", 2, (0.0025, 0.00375, 0.005)),
        ("lt_1y", 2, (0.0025, 0.00375, 0.005)),
        ("1_3y", 3, (0.0015, 0.002, 0.0025)),
        ("gt_3y", 4, (0.001, 0.00125, 0.0015)),
        ("gt_3y", 0, (0.0025, 0.00375, 0.005)),  # 0 days, will train: beginner
    ],
)
def test_build_muscle_bands(experience, strength, band) -> None:
    p = alg.gain_paces(person(lifting_experience=experience, strength_days=strength))
    assert tuple(p.fractions[pace] for pace in ("gentle", "steady", "faster")) == band


def test_women_get_the_lower_half_of_the_band() -> None:
    p = alg.gain_paces(person(sex="female", lifting_experience="lt_1y"))
    assert p.fractions == pytest.approx({"gentle": 0.0025, "steady": 0.003125, "faster": 0.00375})


def test_slower_requests_are_accepted() -> None:
    """10 kg over 100 weeks is slower than Gentle: planned exactly, on the date asked."""
    target_date = TODAY + timedelta(weeks=100)
    plan = alg.build_plan(person(weight_kg=90), "lose_fat", "custom", 80, target_date, TODAY)

    assert plan.requested_rate_kg_week == pytest.approx(0.1)
    assert plan.effective_rate_kg_week == pytest.approx(0.1)
    assert not plan.clamped
    assert plan.goal_date == target_date
    assert plan.weeks == 100
    assert plan.pace_band == "gentle"  # custom dates map to the nearest pace
    assert [n["code"] for n in plan.notices] == ["tiny_deficit"]  # 110 kcal a day


def test_faster_requests_are_clamped_to_the_max() -> None:
    soon = TODAY + timedelta(weeks=5)
    plan = alg.build_plan(person(weight_kg=100), "lose_fat", "custom", 90, soon, TODAY)

    assert plan.requested_rate_kg_week == pytest.approx(2.0)
    assert plan.max_rate_kg_week == pytest.approx(1.0)  # BMI 30.9: 1%
    assert "max_rate" in plan.rules
    assert plan.clamped
    assert plan.goal_date > TODAY + timedelta(weeks=5)


def test_custom_date_range() -> None:
    assert alg.custom_date_range("lose_fat", TODAY) == (
        TODAY + timedelta(weeks=4), TODAY + timedelta(weeks=104)
    )
    assert alg.custom_date_range("recomp", TODAY) == (
        TODAY + timedelta(weeks=8), TODAY + timedelta(weeks=104)
    )
    assert alg.custom_date_range("build_muscle", TODAY) == (
        TODAY + timedelta(weeks=8), TODAY + timedelta(weeks=52)
    )
    assert alg.custom_date_range("maintain", TODAY) is None


# --- Calories --------------------------------------------------------------------------------


def test_the_deficit_is_capped_at_25_percent() -> None:
    result = alg.energy("lose_fat", 2000, 1.0, person())
    assert result.kcal == 1500
    assert result.limits == ("deficit_cap",)
    assert result.effective_rate_kg_week == pytest.approx(500 * 7 / 7700)


def test_the_deficit_cap_is_30_percent_from_bmi_30() -> None:
    result = alg.energy("lose_fat", 3000, 2.0, person(weight_kg=weight_for_bmi(31)))
    assert result.kcal == 2100


@pytest.mark.parametrize(
    ("changes", "floor"),
    [
        ({"sex": "female"}, 1200),
        ({"sex": "male"}, 1500),
        ({"sex": "unspecified"}, 1350),
        ({"sex": "female", "health": {"breastfeeding"}}, 1800),
    ],
)
def test_calorie_floors(changes, floor) -> None:
    result = alg.energy("lose_fat", floor + 300, 0.6, person(**changes))
    assert result.kcal == floor
    assert "calorie_floor" in result.limits


def test_a_floor_at_or_above_tdee_means_no_deficit_never_a_surplus() -> None:
    small = person(sex="female", age=75, height_cm=150, weight_kg=47, activity="mostly_sitting",
                   strength_days=0)
    plan = alg.build_plan(small, "lose_fat", "steady", 44, None, TODAY)

    assert plan.tdee < 1200
    assert plan.kcal == pytest.approx(plan.tdee)
    assert plan.effective_rate_kg_week == 0
    assert (plan.weeks, plan.goal_date) == (None, None)
    assert {n["code"] for n in plan.notices} == {"calorie_floor", "tiny_deficit"}


def test_there_is_no_bmr_floor() -> None:
    """A sitting man's 25% deficit lands below his BMR, and that's allowed (review issue 11)."""
    sitting = person(activity="mostly_sitting", strength_days=0, weight_kg=95)
    plan = alg.build_plan(sitting, "lose_fat", "faster", 85, None, TODAY)

    assert plan.kcal < plan.bmr
    assert plan.kcal == pytest.approx(0.75 * plan.tdee)


@pytest.mark.parametrize(
    ("rate", "kcal", "limit"),
    [
        (0.05, 2100, "surplus_min"),  # 55 kcal: raised to 5%
        (0.2, 2220, None),  # 220 kcal = 11%
        (0.5, 2300, "surplus_max"),  # 550 kcal: cut to 15%
    ],
)
def test_the_surplus_stays_within_5_to_15_percent(rate, kcal, limit) -> None:
    result = alg.energy("build_muscle", 2000, rate, person())
    assert result.kcal == pytest.approx(kcal)
    assert result.limits == ((limit,) if limit else ())


def test_maintain_is_tdee_and_breastfeeding_at_least_1800() -> None:
    assert alg.energy("maintain", 2400, 0, person()).kcal == 2400
    small_mum = person(sex="female", health={"breastfeeding"})
    assert alg.energy("maintain", 1700, 0, small_mum).kcal == 1800


def test_the_goal_date_comes_from_the_effective_rate() -> None:
    plan = alg.build_plan(person(weight_kg=100), "lose_fat", "faster", 85, None, TODAY)

    expected_rate = (plan.tdee - plan.kcal) * 7 / 7700
    assert plan.effective_rate_kg_week == pytest.approx(expected_rate)
    assert plan.weeks == -(-15 // expected_rate)  # rounded up
    assert plan.goal_date == TODAY + timedelta(weeks=plan.weeks)


def test_tiny_deficit_notice() -> None:
    """A small woman who mostly sits: the 1,200 kcal floor leaves a deficit under 150 kcal."""
    small = person(weight_kg=55, height_cm=155, age=60, activity="mostly_sitting", strength_days=0,
                   sex="female")
    plan = alg.build_plan(small, "lose_fat", "gentle", 53, None, TODAY)

    assert plan.tdee - plan.kcal < 150
    assert "tiny_deficit" in [n["code"] for n in plan.notices]
    assert "tiny_deficit" not in [
        n["code"] for n in alg.build_plan(person(), "lose_fat", "gentle", 75, None, TODAY).notices
    ]


@pytest.mark.parametrize(
    ("goal", "notice"), [("build_muscle", "gain_block"), ("recomp", "recomp_block")]
)
def test_a_muscle_goal_without_a_target_is_a_16_week_block(goal, notice) -> None:
    plan = alg.build_plan(person(), goal, "steady", None, None, TODAY)

    assert plan.weeks == 16
    assert plan.goal_date == TODAY + timedelta(weeks=16)
    assert plan.target_weight_kg is None
    assert [n["code"] for n in plan.notices] == [notice]


def test_lose_fat_and_build_muscle_is_a_deficit_with_high_protein() -> None:
    plan = alg.build_plan(person(weight_kg=90), "recomp", "steady", 85, None, TODAY)

    assert plan.kcal < plan.tdee
    assert plan.effective_rate_kg_week == pytest.approx(0.005 * 90)
    assert plan.macros.protein_g_per_kg == 2.2
    assert plan.weeks == 12  # 5 kg at 0.45 kg a week
    assert plan.pattern_key == "recomp.steady.trained.start"


def test_a_high_build_muscle_target_gets_a_warning() -> None:
    plan = alg.build_plan(person(), "build_muscle", "steady", 90, None, TODAY)  # BMI 27.8
    assert "gain_target_high" in [n["code"] for n in plan.notices]
    plan = alg.build_plan(person(), "build_muscle", "steady", 85, None, TODAY)  # BMI 26.2
    assert plan.notices == ()


# --- Macros ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("goal", "changes", "deficit", "grams"),
    [
        ("lose_fat", {"strength_days": 0}, 0.10, 1.6),
        ("lose_fat", {"strength_days": 0}, 0.20, 1.6),  # not 1.8: 1.6 is enough without training
        ("lose_fat", {"strength_days": 1}, 0.10, 1.6),  # training counts from 2 days
        ("recomp", {}, 0.10, 2.2),
        ("lose_fat", {"weight_kg": weight_for_bmi(28)}, 0.10, 2.0),
        ("lose_fat", {"weight_kg": weight_for_bmi(28)}, 0.20, 2.2),
        ("lose_fat", {"weight_kg": weight_for_bmi(24)}, 0.10, 2.2),
        ("build_muscle", {}, 0, 1.8),
        ("maintain", {}, 0, 1.6),
        ("maintain", {"strength_days": 0}, 0, 1.2),
        ("maintain", {"age": 17}, 0, 1.6),
        ("maintain", {"age": 17, "strength_days": 0}, 0, 1.2),
        ("maintain", {"age": 70, "strength_days": 0}, 0, 1.2),
        ("maintain", {"sex": "female", "health": {"breastfeeding"}, "strength_days": 0}, 0, 1.3),
    ],
)
def test_protein_table(goal, changes, deficit, grams) -> None:
    assert alg.protein_per_kg(goal, person(**changes), deficit) == grams


def test_protein_stays_between_its_limits_everywhere() -> None:
    for goal, strength, bmi, deficit, age in itertools.product(
        ("lose_fat", "build_muscle", "maintain"), (0, 3), (19, 24, 27, 35), (0, 0.1, 0.3), (30, 70)
    ):
        someone = person(strength_days=strength, weight_kg=weight_for_bmi(bmi), age=age)
        grams = alg.protein_per_kg(goal, someone, deficit)
        assert grams <= 2.4
        if age >= 65:
            assert grams >= 1.2


def test_protein_is_at_most_35_percent_of_the_calories() -> None:
    """2.2 g/kg for a trained 70 kg woman at 1,320 kcal would be 47% of them."""
    woman = person(sex="female", weight_kg=70, height_cm=170)
    m = alg.macros("lose_fat", 1320, 1760, woman)
    assert m.protein_g == pytest.approx(0.35 * 1320 / 4)
    assert "protein_share_cap" in m.rules


def test_the_protein_share_cap_never_goes_below_1_2_g_per_kg() -> None:
    m = alg.macros("lose_fat", 1000, 1500, person(weight_kg=80))
    assert m.protein_g == pytest.approx(1.2 * 80)


def test_protein_is_per_kg_of_protein_weight() -> None:
    heavy = person(weight_kg=120)  # PW 81
    m = alg.macros("build_muscle", 3000, 2700, heavy)
    assert m.protein_g == pytest.approx(1.8 * 81)


@pytest.mark.parametrize(
    ("goal", "share"), [("lose_fat", 0.25), ("build_muscle", 0.25), ("maintain", 0.30)]
)
def test_fat_share_of_calories(goal, share) -> None:
    m = alg.macros(goal, 2600, 2600, person())
    assert m.fat_g == pytest.approx(share * 2600 / 9)
    assert m.fat_min_g == pytest.approx(max(0.6 * 80, 0.2 * 2600 / 9))


def test_fat_never_goes_below_its_minimum() -> None:
    """max(0.6 g/kg PW, 20% of kcal): at 1,500 kcal and PW 81, 0.6 g/kg is the larger."""
    m = alg.macros("lose_fat", 1500, 2000, person(weight_kg=110))
    assert m.fat_min_g == pytest.approx(0.6 * 81)
    assert m.fat_g == pytest.approx(0.6 * 81)


def test_carbs_are_the_rest() -> None:
    m = alg.macros("maintain", 2500, 2500, person())
    assert 4 * m.protein_g + 4 * m.carbs_g + 9 * m.fat_g == pytest.approx(2500)
    assert m.rules == ()


def test_carb_floor_lowers_fat_first() -> None:
    """Hypo-risk diabetes: carbs ≥ 130 g. Lowering fat toward its minimum is enough here."""
    hypo = person(weight_kg=60, height_cm=170, health={"diabetes"}, diabetes_hypo_risk="yes")
    m = alg.macros("maintain", 1250, 1250, hypo)

    assert m.carb_floor_g == 130
    assert m.carbs_g == pytest.approx(130)
    assert m.fat_min_g < m.fat_g < 0.30 * 1250 / 9
    assert m.protein_g == pytest.approx(1.6 * 60)  # untouched
    assert m.rules == ("carb_floor_fat_lowered",)


def test_carb_floor_then_lowers_protein_toward_1_6() -> None:
    hypo = person(weight_kg=50, height_cm=160, health={"diabetes"}, diabetes_hypo_risk="yes")
    m = alg.macros("lose_fat", 1200, 1700, hypo)

    assert m.fat_g == pytest.approx(m.fat_min_g)  # fat first, all the way
    assert 1.6 * 50 < m.protein_g < 0.35 * 1200 / 4  # then protein, part of the way
    assert m.carbs_g == pytest.approx(130)
    assert m.rules == ("protein_share_cap", "carb_floor_fat_lowered", "carb_floor_protein_lowered")


def test_without_training_the_carb_floor_takes_protein_to_1_2() -> None:
    hypo = person(weight_kg=60, height_cm=165, strength_days=0, health={"diabetes"},
                  diabetes_hypo_risk="yes")
    m = alg.macros("lose_fat", 1150, 1700, hypo)

    assert 1.2 * 60 <= m.protein_g < 1.6 * 60
    assert m.carbs_g == pytest.approx(130)


def test_carb_floor_then_accepts_what_is_left() -> None:
    """Without a hypo risk: fat at its minimum, protein below 1.6 g/kg already, and carbs still
    under 100 g at these calories (which no plan reaches: the calorie floors keep it above)."""
    m = alg.macros("lose_fat", 1000, 1700, person(weight_kg=70, height_cm=170))

    assert m.fat_g == pytest.approx(m.fat_min_g)
    assert m.carbs_g < 100
    assert m.rules == ("protein_share_cap", "carb_floor_not_met")
    assert 4 * m.protein_g + 4 * m.carbs_g + 9 * m.fat_g == pytest.approx(1000)


@pytest.mark.parametrize("goal", ["lose_fat", "recomp", "build_muscle", "maintain"])
def test_with_a_hypo_risk_carbs_are_always_at_least_130_g(goal) -> None:
    """The calories rise to fit 130 g once fat and protein are at their lowest (M2)."""
    for sex, height, bmi, age, activity, strength in itertools.product(
        ("female", "male", "unspecified"), (150, 160, 175), (21, 25, 32), (30, 55, 75),
        ("mostly_sitting", "some_walking"), (0, 3),
    ):
        weight = weight_for_bmi(bmi, height)
        hypo = person(sex=sex, height_cm=height, weight_kg=weight, age=age, activity=activity,
                      strength_days=strength, health={"diabetes"}, diabetes_hypo_risk="yes",
                      diabetes_team_ack=True, will_train=True)
        target = round(weight - 3, 1) if goal == "lose_fat" else None
        for pace in ("gentle", "steady"):
            plan = alg.build_plan(hypo, goal, pace, target, None, TODAY)
            assert plan.macros.carbs_g >= 130 - 1e-6, (goal, sex, height, bmi, age)
            assert plan.targets["carbs_g"] >= 130
            assert "carb_floor_not_met" not in plan.rules


def test_the_carb_floor_lowers_protein_before_raising_calories() -> None:
    """160 cm, 62 kg, 45, sitting, hypo risk: at 1,200 kcal protein drops toward 1.2 g/kg
    (no strength training) and carbs reach 130 g, so the calories stay at the floor."""
    hypo = person(sex="female", age=45, height_cm=160, weight_kg=62, activity="mostly_sitting",
                  strength_days=0, health={"diabetes"}, diabetes_hypo_risk="yes",
                  diabetes_team_ack=True)
    plan = alg.build_plan(hypo, "lose_fat", "steady", 58, None, TODAY)

    assert plan.kcal == 1200
    assert "carb_floor_protein_lowered" in plan.rules
    assert plan.macros.protein_g < 1.6 * 62
    assert plan.targets["carbs_g"] >= 130


def test_the_carb_floor_raises_the_calories_when_protein_cant_give_way() -> None:
    """165 cm, 68 kg, 60, sitting, strength training (protein kept at 1.6 g/kg), hypo risk:
    Steady's ~1,250 kcal can't fit 130 g of carbs, so the calories rise to what does."""
    hypo = person(sex="female", age=60, height_cm=165, weight_kg=68, activity="mostly_sitting",
                  strength_days=3, health={"diabetes"}, diabetes_hypo_risk="yes",
                  diabetes_team_ack=True)
    plan = alg.build_plan(hypo, "lose_fat", "steady", 64, None, TODAY)

    assert plan.kcal == pytest.approx(alg.carb_floor_kcal(hypo, "lose_fat"))
    assert plan.kcal > plan.tdee - 0.005 * 68 * 7700 / 7
    assert {"calorie_floor", "carb_floor_calories"} <= set(plan.rules)
    assert plan.macros.carbs_g == pytest.approx(130)
    assert plan.targets["carbs_g"] >= 130
    assert "calorie_floor" in [n["code"] for n in plan.notices]


@pytest.mark.parametrize(("kcal", "fiber"), [(1200, 25), (2000, 28), (2500, 35), (4000, 45)])
def test_fibre_is_14_g_per_1000_kcal_within_25_to_45(kcal, fiber) -> None:
    assert alg.macros("maintain", kcal, kcal, person()).fiber_g == pytest.approx(fiber)


# --- Rounding and the energy check -----------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "step", "rounded"),
    [(1908.56, 10, 1910), (1905, 10, 1910), (1904.9, 10, 1900), (176, 5, 175), (53.02, 5, 55),
     (52.5, 5, 55), (0.578, 0.05, 0.6), (0.825, 0.05, 0.85), (0.24, 0.05, 0.25)],
)
def test_display_rounding(value, step, rounded) -> None:
    assert alg.round_to(value, step) == pytest.approx(rounded)


def test_display_targets_are_rounded_and_still_add_up() -> None:
    """kcal to 10, grams to 5, and the energy check holds on the rounded numbers, for many
    people, goals and paces."""
    checked = 0
    for goal, pace, sex, bmi, age, activity, strength, cardio, hypo in itertools.product(
        ("lose_fat", "recomp", "build_muscle", "maintain"),
        ("gentle", "steady", "faster"),
        ("female", "male", "unspecified"),
        (18.6, 21, 24, 27, 31, 38),
        (17, 30, 50, 70),
        ("mostly_sitting", "physical_work"),
        (0, 4),
        (0, 5),
        (False, True),
    ):
        health = {"diabetes"} if hypo else {"none"}
        someone = person(
            sex=sex, weight_kg=weight_for_bmi(bmi, 165), height_cm=165, age=age,
            activity=activity, strength_days=strength, cardio_days=cardio, health=health,
            diabetes_hypo_risk="yes" if hypo else None,
        )
        target = {"lose_fat": someone.weight_kg - 5, "build_muscle": None}.get(goal)
        plan = alg.build_plan(someone, goal, pace, target, None, TODAY)
        t = plan.targets
        assert t["kcal"] % 10 == 0
        assert all(t[key] % 5 == 0 for key in ("protein_g", "carbs_g", "fat_g", "fiber_g"))
        assert alg.energy_matches(t["kcal"], t["protein_g"], t["carbs_g"], t["fat_g"])
        assert 25 <= t["fiber_g"] <= 45
        if plan.macros.carbs_g >= plan.macros.carb_floor_g:
            assert t["carbs_g"] >= plan.macros.carb_floor_g
        assert t["fat_g"] >= plan.macros.fat_min_g - 1e-6
        assert t["protein_g"] * 4 <= 0.35 * t["kcal"] + 4 * 5 or (
            plan.macros.protein_g == pytest.approx(1.2 * someone.protein_weight_kg)
        )
        if goal in ("lose_fat", "recomp"):
            assert plan.kcal <= max(plan.tdee, alg.carb_floor_kcal(someone, goal)) + 1e-6
            assert plan.kcal >= min(alg.kcal_floor(someone), plan.tdee)
            assert plan.tdee - plan.kcal <= 0.30 * plan.tdee + 1e-6
        if goal == "build_muscle":
            assert 0.05 * plan.tdee - 1e-6 <= plan.kcal - plan.tdee <= 0.15 * plan.tdee + 1e-6
        checked += 1
    assert checked > 10_000


def test_rates_display_to_005_kg() -> None:
    assert alg.display_rate(0.5783) == 0.6
    assert alg.display_rate(0.2125) == 0.2
    assert alg.display_rate(0.024) == 0


# --- Pace options and pattern keys -----------------------------------------------------------


def test_pace_options_show_real_rates_and_dates() -> None:
    options = {o.pace: o for o in alg.pace_options(person(), "lose_fat", 70, TODAY)}

    assert options["gentle"].rate_kg_week == pytest.approx(0.24)
    assert options["steady"].rate_kg_week == pytest.approx(0.4)
    assert options["faster"].rate_kg_week == pytest.approx(0.6)
    # Faster is held back by the 25% deficit cap: its real rate and date say so.
    assert options["faster"].effective_rate_kg_week == pytest.approx(0.578, abs=0.001)
    assert options["faster"].weeks == 18
    assert options["gentle"].weeks == 42
    assert all(o.available for o in options.values())
    assert options["gentle"].kcal > options["steady"].kcal > options["faster"].kcal


def test_pace_options_mark_faster_unavailable() -> None:
    options = alg.pace_options(person(age=66), "lose_fat", 70, TODAY)
    assert [o.available for o in options] == [True, True, False]


def test_faster_is_unavailable_when_the_limits_make_it_steady() -> None:
    """120 kg at 175 cm, sitting: Steady (0.75%) and Faster (1%) both hit the 30% deficit cap,
    so Faster would be Steady under another name."""
    big = person(age=45, height_cm=175, weight_kg=120, activity="mostly_sitting", strength_days=0)
    options = {o.pace: o for o in alg.pace_options(big, "lose_fat", 95, TODAY)}

    assert alg.loss_paces(big, "lose_fat").faster_available
    assert options["faster"].effective_rate_kg_week == pytest.approx(
        options["steady"].effective_rate_kg_week
    )
    assert not options["faster"].available


def test_no_clamped_notice_when_the_shown_rate_is_the_same() -> None:
    """Faster for the worked example: 0.6 asked, 0.58 given; both show as ~0.6 kg a week."""
    plan = alg.build_plan(person(), "lose_fat", "faster", 70, None, TODAY)
    assert alg.display_rate(plan.effective_rate_kg_week) == 0.6
    assert not plan.clamped
    assert "pace_clamped" not in [n["code"] for n in plan.notices]


def test_fat_never_shows_below_its_minimum() -> None:
    m = alg.Macros(protein_g=100, fat_g=37.4, carbs_g=150, fiber_g=25, protein_g_per_kg=1.6,
                   fat_min_g=37.4, carb_floor_g=100, rules=())
    assert alg.display_targets(1340, m)["fat_g"] == 40


@pytest.mark.parametrize(
    ("goal", "changes", "key"),
    [
        ("lose_fat", {}, "lose_fat.steady.trained.start"),
        ("lose_fat", {"strength_days": 0}, "lose_fat.steady.none.start"),
        ("lose_fat", {"strength_days": 1}, "lose_fat.steady.none.start"),
        ("recomp", {}, "recomp.steady.trained.start"),
        ("recomp", {"strength_days": 0, "will_train": True}, "recomp.steady.beginner.start"),
        ("lose_fat", {"lifting_experience": "lt_1y"}, "lose_fat.steady.beginner.start"),
        (
            "build_muscle",
            {"strength_days": 0, "will_train": True},
            "build_muscle.steady.beginner.start",
        ),
        ("maintain", {}, "maintain.steady.trained.start"),
    ],
)
def test_pattern_key(goal, changes, key) -> None:
    target = {"lose_fat": 75}.get(goal)
    assert alg.build_plan(person(**changes), goal, "steady", target, None, TODAY).pattern_key == key
