"""The person behind a set of answers, with what the gates and formulas need.

Any answer may still be missing (a preview while the questionnaire is being filled in), so
every derived value is None until its inputs are known.
"""

import calendar
from dataclasses import dataclass
from datetime import date

from app.schemas.nutrition_plan import GoalAnswers

# Protein is computed on min(weight, this BMI × height²) (review issue 16).
PROTEIN_WEIGHT_BMI = 25.0
# Strength training counts from this many days a week (protein, and the muscle goals).
TRAINING_DAYS = 2


def age_on(birth_year: int, birth_month: int, today: date) -> int:
    """Age in whole years, the youngest possible: as if born on the last day of the month.

    With only month and year known, this never makes someone older than they are, so an age
    gate (under 16, 16–17) never lets through someone it should stop.
    """
    last_day = calendar.monthrange(birth_year, birth_month)[1]
    had_birthday = (today.month, today.day) >= (birth_month, last_day)
    return today.year - birth_year - (0 if had_birthday else 1)


def bmi(weight_kg: float, height_cm: float) -> float:
    return weight_kg / (height_cm / 100) ** 2


def weight_at_bmi(value: float, height_cm: float) -> float:
    """The weight, kg, at which someone this tall has this BMI."""
    return value * (height_cm / 100) ** 2


@dataclass(frozen=True)
class Person:
    age: int | None
    sex: str | None
    height_cm: float | None
    weight_kg: float | None
    # None until the health question is answered.
    health: frozenset[str] | None
    diabetes_hypo_risk: str | None
    diabetes_team_ack: bool
    ed_status: str | None
    targets_wanted: bool | None
    activity: str | None
    strength_days: int | None
    cardio_days: int | None
    lifting_experience: str | None
    will_train: bool | None

    def has(self, condition: str) -> bool:
        return self.health is not None and condition in self.health

    @property
    def bmi(self) -> float | None:
        if self.weight_kg is None or self.height_cm is None:
            return None
        return bmi(self.weight_kg, self.height_cm)

    @property
    def protein_weight_kg(self) -> float | None:
        """PW = min(weight, 25 × height_m²): protein for the weight muscle needs, not fat."""
        if self.weight_kg is None or self.height_cm is None:
            return None
        return min(self.weight_kg, weight_at_bmi(PROTEIN_WEIGHT_BMI, self.height_cm))

    @property
    def hypo_risk(self) -> bool:
        """Diabetes treated with something that can cause hypos. "Not sure", or not answered
        yet, counts as yes."""
        return self.has("diabetes") and self.diabetes_hypo_risk != "no"

    @property
    def ed_stop(self) -> bool:
        """An eating disorder now, recovering, or unsaid (and not yet answered) is a stop."""
        return self.has("eating_disorder") and self.ed_status != "past"

    @property
    def ed_past(self) -> bool:
        return self.has("eating_disorder") and self.ed_status == "past"

    @property
    def targets_declined(self) -> bool:
        """An eating disorder in the past, and no "show me a plan with targets" (yet): log
        without targets."""
        return self.ed_past and self.targets_wanted is not True

    @property
    def trains(self) -> bool:
        """Strength trains at least two days a week: the "training" column of the protein
        table."""
        return (self.strength_days or 0) >= TRAINING_DAYS

    @property
    def minor(self) -> bool:
        return self.age is not None and 16 <= self.age <= 17

    @property
    def older(self) -> bool:
        return self.age is not None and self.age >= 65

    @property
    def complete(self) -> bool:
        """Everything the energy formulas need is known."""
        return None not in (
            self.age,
            self.sex,
            self.height_cm,
            self.weight_kg,
            self.health,
            self.activity,
            self.strength_days,
            self.cardio_days,
        )


def from_answers(answers: GoalAnswers, today: date) -> Person:
    age = None
    if answers.birth_year is not None and answers.birth_month is not None:
        age = age_on(answers.birth_year, answers.birth_month, today)
    return Person(
        age=age,
        sex=answers.sex,
        height_cm=answers.height_cm,
        weight_kg=answers.weight_kg,
        health=None if answers.health is None else frozenset(answers.health),
        diabetes_hypo_risk=answers.diabetes_hypo_risk,
        diabetes_team_ack=answers.diabetes_team_ack,
        ed_status=answers.ed_status,
        targets_wanted=answers.targets_wanted,
        activity=answers.activity,
        strength_days=answers.strength_days,
        cardio_days=answers.cardio_days,
        lifting_experience=answers.lifting_experience,
        will_train=answers.will_train,
    )
