"""Safety gates: who gets a plan, for which goals, with which notes; and target validation.

Normative table: "Safety gates" in docs/plans/ai-nutrition-plan.md (reasons in review §2).
The gates only decide *whether* and *which goal*; the caps they imply (a 0.5% a week loss
limit, no Faster, carbs ≥ 130 g, the breastfeeding allowance) are applied by `algorithm.py`
from the same `Person`. Lose fat and build muscle (`recomp`) is a deficit like Lose fat, so
every Lose fat rule applies to it too.

The result is codes only. Their texts (reasons, stop screens) are in the pattern library.
Answers that are still missing never trigger a rule, except the two health follow-ups, which
count as their most cautious answer until given (an eating disorder as current, diabetes as
with hypo risk).
"""

import math
from dataclasses import dataclass

from app.services.nutrition_plan.person import TRAINING_DAYS, Person, weight_at_bmi

GOALS = ("lose_fat", "recomp", "build_muscle", "maintain")
# The goals with a calorie deficit.
LOSS_GOALS = ("lose_fat", "recomp")
# The goals that build muscle, so need strength training.
MUSCLE_GOALS = ("recomp", "build_muscle")

# A stop when any of these holds, in this order of priority: one stop screen is shown.
# `targets_declined` is the user's own choice (an eating disorder in the past), not a risk.
STOP_CODES = (
    "under_16", "pregnancy", "ed_current", "kidney", "bariatric", "bmi_low", "targets_declined"
)

MIN_AGE = 16
ADULT_AGE = 18
BMI_STOP = 17.5
BMI_NO_DEFICIT = 18.5  # below it, no weight loss at all
# The lowest target BMI for a loss goal: a margin above 18.5 for day-to-day swings (review
# of the implementation, S2); from 65, 23, as lower BMIs carry more risk at that age (M1).
BMI_MIN_TARGET = 20.0
BMI_MIN_TARGET_OLDER = 23.0
BMI_LOSS_OLDER = 25.0  # from 65, weight loss is only planned from this BMI
BMI_NO_BULK = 30.0
BMI_DOCTOR_SUPPORT = 40.0
BULK_TARGET_BMI_WARNING = 27.0
# A target must be at least this far from the current weight.
MIN_TARGET_CHANGE_KG = 1.0


@dataclass(frozen=True)
class Gate:
    result: str  # ok | maintain_only | stop
    allowed_goals: tuple[str, ...]
    reasons: tuple[str, ...]  # reason codes, in the order of the spec's table
    stop: str | None  # one of STOP_CODES when result is stop


def stop_code(person: Person) -> str | None:
    """The stop that applies to this person, if any."""
    bmi = person.bmi
    checks = {
        "under_16": person.age is not None and person.age < MIN_AGE,
        "pregnancy": person.has("pregnant"),
        "ed_current": person.ed_stop,
        "kidney": person.has("kidney"),
        "bariatric": person.has("bariatric"),
        "bmi_low": bmi is not None and bmi < BMI_STOP,
        "targets_declined": person.targets_declined,
    }
    return next((code for code in STOP_CODES if checks[code]), None)


def lowest_lose_target_kg(person: Person) -> float:
    """The lowest target weight a loss goal accepts: BMI 20 (23 from 65), rounded up to
    0.1 kg."""
    floor = BMI_MIN_TARGET_OLDER if person.older else BMI_MIN_TARGET
    return math.ceil(weight_at_bmi(floor, person.height_cm) * 10 - 1e-9) / 10


def highest_lose_target_kg(weight_kg: float) -> float:
    return round(weight_kg - MIN_TARGET_CHANGE_KG, 1)


def lowest_bulk_target_kg(weight_kg: float) -> float:
    return round(weight_kg + MIN_TARGET_CHANGE_KG, 1)


def evaluate(person: Person, goal: str | None) -> Gate:
    """Which goals this person may have, and why. `goal` is the one they picked, if any:
    reasons that only rule out other goals are left out."""
    stop = stop_code(person)
    if stop is not None:
        return Gate(result="stop", allowed_goals=(), reasons=(), stop=stop)

    bmi = person.bmi
    allowed = set(GOALS)
    reasons: list[str] = []

    def only(code: str, condition: bool, keep: set[str]) -> None:
        """A rule that leaves only `keep`. Always explained: it shapes the whole plan."""
        nonlocal allowed
        if condition:
            allowed &= keep
            reasons.append(code)

    def remove(code: str, condition: bool, goals_removed: tuple[str, ...]) -> None:
        """A rule that rules out some goals. Explained when one of them is the one picked."""
        if condition:
            allowed.difference_update(goals_removed)
            if goal is None or goal in goals_removed:
                reasons.append(code)

    def note(code: str, condition: bool, for_goals: tuple[str, ...] | None = None) -> None:
        """A safety note; with `for_goals`, only when one of them is picked (or none yet)."""
        if condition and (for_goals is None or goal is None or goal in for_goals):
            reasons.append(code)

    only("age_16_17", person.minor, {"maintain"})
    note("age_65", person.older)
    only("breastfeeding", person.has("breastfeeding"), {"maintain"})
    # One reason at most for why weight loss isn't offered, the most basic first.
    no_deficit = bmi is not None and bmi < BMI_NO_DEFICIT
    remove("bmi_17_5_18_5", no_deficit, LOSS_GOALS)
    older_lean = not no_deficit and person.older and bmi is not None and bmi < BMI_LOSS_OLDER
    remove("age_65_loss", older_lean, LOSS_GOALS)
    # A loss goal needs a target at least 1 kg lower and at BMI 20 (23 from 65) or more. Just
    # above that there is no such target, so say so now rather than refuse every target later.
    no_room = (
        bmi is not None
        and not no_deficit
        and not older_lean
        and lowest_lose_target_kg(person) > highest_lose_target_kg(person.weight_kg)
    )
    remove("no_room_to_lose", no_room, LOSS_GOALS)
    note("bmi_40", bmi is not None and bmi >= BMI_DOCTOR_SUPPORT, for_goals=LOSS_GOALS)
    only("ed_past", person.ed_past, {"maintain"})
    remove(
        "diabetes_team_check", person.hypo_risk and not person.diabetes_team_ack, LOSS_GOALS
    )
    note("diabetes_hypo_risk", person.hypo_risk)
    note("diabetes", person.has("diabetes") and not person.hypo_risk)
    note("glp1", person.has("glp1"))
    note("other_diet_condition", person.has("other_diet_condition"))
    note("prefer_not", person.has("prefer_not"))
    # Muscle is built by training: no muscle goal without the intent to train 2+ days a week.
    remove(
        "no_strength_training",
        person.strength_days is not None
        and person.strength_days < TRAINING_DAYS
        and person.will_train is not True,
        MUSCLE_GOALS,
    )
    remove("bmi_30_build", bmi is not None and bmi >= BMI_NO_BULK, ("build_muscle",))

    allowed_goals = tuple(g for g in GOALS if g in allowed)
    result = "maintain_only" if allowed_goals == ("maintain",) else "ok"
    return Gate(result=result, allowed_goals=allowed_goals, reasons=tuple(reasons), stop=None)


@dataclass(frozen=True)
class TargetProblem:
    code: str  # target_not_below | target_too_low | target_not_above
    min_kg: float | None
    max_kg: float | None


def check_target(person: Person, goal: str, target_kg: float) -> TargetProblem | None:
    """A loss goal: at least 1 kg below the current weight, and BMI 20 (23 from 65) or more.
    Build muscle: at least 1 kg above. Needs the person's weight and height."""
    if goal in LOSS_GOALS:
        lowest = lowest_lose_target_kg(person)
        highest = highest_lose_target_kg(person.weight_kg)
        if target_kg > highest:
            return TargetProblem("target_not_below", lowest, highest)
        if target_kg < lowest:
            return TargetProblem("target_too_low", lowest, highest)
    elif goal == "build_muscle":
        lowest = lowest_bulk_target_kg(person.weight_kg)
        if target_kg < lowest:
            return TargetProblem("target_not_above", lowest, None)
    return None


def bulk_target_is_high(person: Person, target_kg: float) -> bool:
    """A Build muscle target above BMI 27 gets a warning, not a block."""
    return target_kg / (person.height_cm / 100) ** 2 > BULK_TARGET_BMI_WARNING
