"""Request and response shapes for the premium nutrition plan (`/api/v1/users/me/...`).

The questionnaire's answers (v2) are `GoalAnswers`. Every field may be missing, so the app can
preview the gates and paces while the questionnaire is still being filled in; which answers
a saved goal needs is checked by `app/services/nutrition_plan/plans.py`. A value that is
present is always checked here. See docs/plans/ai-nutrition-plan.md.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Goal = Literal["lose_fat", "recomp", "build_muscle", "maintain"]
Pace = Literal["gentle", "steady", "faster", "custom"]
PaceOptionName = Literal["gentle", "steady", "faster"]
Sex = Literal["female", "male", "unspecified"]
Health = Literal[
    "pregnant",
    "breastfeeding",
    "diabetes",
    "kidney",
    "eating_disorder",
    "glp1",
    "bariatric",
    "other_diet_condition",
    "none",
    "prefer_not",
]
Allergy = Literal[
    "milk", "gluten", "eggs", "peanuts", "tree_nuts", "soy", "fish", "shellfish", "sesame"
]
Activity = Literal["mostly_sitting", "some_walking", "on_feet", "physical_work"]
LiftingExperience = Literal["none", "lt_1y", "1_3y", "gt_3y"]
Language = Literal["en", "ro"]
GateResult = Literal["ok", "maintain_only", "stop"]
StopCode = Literal[
    "under_16", "pregnancy", "ed_current", "kidney", "bariatric", "bmi_low", "targets_declined"
]
PlanStatus = Literal["draft", "active", "archived"]
PlanReason = Literal["initial", "review", "change", "maintenance_transition"]

# Health answers that must be the only one picked.
EXCLUSIVE_HEALTH = ("none", "prefer_not")


def _unique(values: list) -> list:
    """The list without repeats, in order."""
    return list(dict.fromkeys(values))


class GoalAnswers(BaseModel):
    """The questionnaire's answers, version 2. Any of them may be missing in a preview."""

    # A misspelt answer is an error rather than one silently ignored.
    model_config = ConfigDict(extra="forbid")

    goal: Goal | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    birth_month: int | None = Field(default=None, ge=1, le=12)
    sex: Sex | None = None
    height_cm: float | None = Field(default=None, ge=120, le=230)
    weight_kg: float | None = Field(default=None, ge=30, le=300, description="To 0.1 kg.")
    health: list[Health] | None = Field(
        default=None,
        min_length=1,
        description="Pick `none` when nothing applies. `none` and `prefer_not` are exclusive; "
        "`pregnant` and `breastfeeding` are not allowed with sex `male`.",
    )
    diabetes_hypo_risk: Literal["yes", "no", "not_sure"] | None = Field(
        default=None, description="Only read when `health` includes `diabetes`."
    )
    diabetes_team_ack: bool = Field(
        default=False,
        description="\"I'll check with my diabetes team\": needed for Lose fat with hypo risk.",
    )
    ed_status: Literal["current", "past", "prefer_not"] | None = Field(
        default=None, description="Only read when `health` includes `eating_disorder`."
    )
    targets_wanted: bool | None = Field(
        default=None,
        description="Only read when `ed_status` is `past`: true shows a Maintain plan with "
        "targets; false or missing is log without targets (the default).",
    )
    activity: Activity | None = None
    strength_days: int | None = Field(default=None, ge=0, le=7)
    cardio_days: int | None = Field(default=None, ge=0, le=7)
    lifting_experience: LiftingExperience | None = None
    will_train: bool | None = Field(
        default=None,
        description="Build muscle, or Lose fat and build muscle, with fewer than 2 strength days: "
        "will they train at least 2 days a week?",
    )
    target_weight_kg: float | None = Field(default=None, ge=30, le=300)
    pace: Pace | None = None
    target_date: date | None = Field(default=None, description="Needed when `pace` is `custom`.")
    eating_style: Literal["omnivore", "pescatarian", "vegetarian", "vegan"] | None = None
    religious_fasting: bool = False
    allergies: list[Allergy] = Field(default_factory=list)
    meals_per_day: int = Field(default=3, ge=2, le=6)
    units: Literal["metric", "imperial"] = "metric"

    @field_validator("weight_kg", "target_weight_kg")
    @classmethod
    def _to_a_tenth(cls, value: float | None) -> float | None:
        return None if value is None else round(value, 1)

    @field_validator("health", "allergies")
    @classmethod
    def _without_repeats(cls, value: list | None) -> list | None:
        return None if value is None else _unique(value)

    @model_validator(mode="after")
    def _consistent(self) -> "GoalAnswers":
        if self.health is not None and len(self.health) > 1:
            exclusive = [item for item in self.health if item in EXCLUSIVE_HEALTH]
            if exclusive:
                raise ValueError(f"health: {exclusive[0]!r} can't be combined with other answers")
        if self.sex == "male" and self.health is not None:
            if {"pregnant", "breastfeeding"} & set(self.health):
                raise ValueError("health: pregnant and breastfeeding can't be chosen with sex male")
        return self


class Reason(BaseModel):
    """Why the gate changed something, or a safety note, in the user's language."""

    code: str
    message: str


class StopScreen(BaseModel):
    """A kind screen pointing to a professional, with no numbers."""

    code: StopCode
    title: str
    body: str


class GateRead(BaseModel):
    """What the safety gates allow for this person."""

    result: GateResult = Field(
        description="`stop`: no plan, log without targets. `maintain_only`: only Maintain is "
        "allowed. `ok`: anything else; `allowed_goals` says which goals."
    )
    allowed_goals: list[Goal]
    reasons: list[Reason]
    stop: StopScreen | None = Field(description="Set only when `result` is `stop`.")


class Notice(BaseModel):
    """Something the user should know about their numbers (a clamped pace, a tiny deficit)."""

    code: str
    message: str


class PaceOption(BaseModel):
    """One pace choice, with the weekly rate and date the calorie limits really allow."""

    pace: PaceOptionName
    rate_kg_week: float = Field(description="The pace's own rate, to 0.05 kg.")
    effective_rate_kg_week: float = Field(
        description="The rate the calories allow once the safety limits apply, to 0.05 kg."
    )
    weeks: int | None = Field(description="Null when no change is possible at this pace.")
    goal_date: date | None
    kcal: int
    available: bool = Field(
        description="Faster is unavailable when, after the safety limits, it isn't at least "
        "0.05 kg a week faster than Steady, when a health answer rules it out, and always for "
        "Lose fat and build muscle."
    )


class DateRange(BaseModel):
    min: date
    max: date


class PreviewRequest(BaseModel):
    """Answers so far; nothing is stored."""

    model_config = ConfigDict(extra="forbid")

    answers: GoalAnswers
    language: Language = "en"


class PreviewRead(BaseModel):
    """The gate, and the pace options with their real dates, for answers so far."""

    gate: GateRead
    pace_options: list[PaceOption] = Field(
        description="Empty unless the goal is Lose fat, Lose fat and build muscle, or Build "
        "muscle (and allowed), and the body, health, activity and exercise answers (and, for "
        "Lose fat, the target) are in."
    )
    custom_date_range: DateRange | None = Field(
        description="The dates \"I have a date in mind\" accepts. A date sooner than the fastest "
        "pace on offer reaches is planned at that pace (a `pace_clamped` notice). Null with "
        "the pace options, for Maintain, and with no target."
    )
    max_rate_kg_week: float | None = Field(
        description="The fastest pace the user can be planned at, to 0.05 kg."
    )
    notices: list[Notice]


class GoalCreate(BaseModel):
    """Save the questionnaire's answers, with consent."""

    model_config = ConfigDict(extra="forbid")

    questionnaire_version: Literal[2]
    consent: Literal[True] = Field(description="Must be true: consent to process health data.")
    consent_version: str = Field(min_length=1, max_length=40)
    language: Language = "en"
    answers: GoalAnswers


class GoalRead(BaseModel):
    """A saved set of answers, with today's gate result for them."""

    id: int | None = Field(description="Null when nothing was stored (under 16).")
    questionnaire_version: int
    language: Language
    answers: GoalAnswers | None = Field(description="Null when nothing was stored.")
    consented_at: datetime | None
    created_at: datetime | None
    gate: GateRead


class PlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal_id: int


class PlanTargets(BaseModel):
    """Daily targets, rounded for display: kcal to 10, grams to 5."""

    kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int
    fiber_g: int


class PlanRate(BaseModel):
    """Weekly rate of weight change, kg (0 for Maintain), to 0.05 kg."""

    requested_kg_week: float
    effective_kg_week: float
    clamped: bool = Field(
        description="True when the safety limits made the pace slower than asked."
    )


class PlanTexts(BaseModel):
    """The plan's explanation and guidance, from the pattern library."""

    summary: str
    why: list[str]
    guidance: list[str]
    cautions: list[str]


class PlanRead(BaseModel):
    """A nutrition plan: its targets, pace, dates, notices and texts."""

    id: int
    goal_id: int
    status: PlanStatus
    reason: PlanReason
    language: Language
    goal: Goal
    pace: Pace | None = Field(description="Null for Maintain.")
    targets: PlanTargets
    rate: PlanRate
    start_weight_kg: float
    target_weight_kg: float | None
    goal_date: date | None = Field(
        description="When the target is reached at the effective rate; for Build muscle, or "
        "Lose fat and build muscle, with no target, the end of a 16-week block. Null for "
        "Maintain."
    )
    weeks: int | None
    notices: list[Notice]
    texts: PlanTexts
    pattern_key: str
    created_at: datetime
    activated_at: datetime | None
