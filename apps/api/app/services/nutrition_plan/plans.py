"""Goals and plans in the database, and previews: what the nutrition plan routes call.

- A **preview** runs the gates and the pace options on answers so far; nothing is stored.
- Saving a **goal** checks the answers, runs the gates and stores the answers with consent.
  A stop puts the user in "log without targets" (`users.targets_mode = none`) and archives
  their active plan; under-16s' answers are never stored.
- A **plan** is built as a draft from a goal; **activating** it archives the active plan and
  copies its targets to the user's daily targets (`targets_mode = plan`).

The gates are re-run from a goal's stored answers whenever it is read or used, so age is
always today's.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.nutrition_goal import NutritionGoal
from app.db.models.nutrition_plan import NutritionPlan
from app.db.models.user import User
from app.schemas.nutrition_plan import (
    DateRange,
    GateRead,
    GoalAnswers,
    GoalCreate,
    GoalRead,
    Notice,
    PaceOption,
    PlanRead,
    PreviewRead,
    Reason,
    StopScreen,
)
from app.services.nutrition_plan import algorithm, gates, texts
from app.services.nutrition_plan.gates import LOSS_GOALS, MUSCLE_GOALS
from app.services.nutrition_plan.person import TRAINING_DAYS, Person, age_on, from_answers

MAX_AGE = 100
# Answers every goal needs, before anything else is checked.
ALWAYS_NEEDED = ("goal", "birth_year", "birth_month")
# The rest of what a goal needs, unless the gates stop it first.
NEEDED = ("sex", "height_cm", "weight_kg", "health", "activity", "strength_days", "cardio_days")
# The goals with a target weight and a pace.
WEIGHT_GOALS = (*LOSS_GOALS, "build_muscle")


class AnswersError(ValueError):
    """Answers that can't be used, beyond what the schema checks: 422, with `detail`."""

    def __init__(self, code: str, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.detail = {"code": code, "message": message, **extra}


class GoalNotFoundError(LookupError):
    """No goal with that id belongs to the user."""


class PlanNotFoundError(LookupError):
    """No plan with that id belongs to the user."""


class PlanConflictError(ValueError):
    """The plan can't be built or activated in the user's current state: 409, with `detail`."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.detail = {"code": code, "message": message}


# --- Checking answers ------------------------------------------------------------------------


def missing_answers(answers: GoalAnswers) -> list[str]:
    """Which answers a goal still needs, given the ones it has (the questionnaire's
    "Shown for" column)."""
    needed = list(ALWAYS_NEEDED + NEEDED)
    health = answers.health or []
    if "diabetes" in health:
        needed.append("diabetes_hypo_risk")
    if "eating_disorder" in health:
        needed.append("ed_status")
    if (answers.strength_days or 0) >= 1 or answers.goal in MUSCLE_GOALS:
        needed.append("lifting_experience")
    if (
        answers.goal in MUSCLE_GOALS
        and answers.strength_days is not None
        and answers.strength_days < TRAINING_DAYS
    ):
        needed.append("will_train")
    if answers.goal == "lose_fat":
        needed.append("target_weight_kg")
    if answers.goal in WEIGHT_GOALS:
        needed.append("pace")
        if answers.pace == "custom":
            needed.extend(["target_weight_kg", "target_date"])
    return [name for name in dict.fromkeys(needed) if getattr(answers, name) is None]


def _missing_error(fields: list[str]) -> AnswersError:
    return AnswersError(
        "missing_answers", f"These answers are needed: {', '.join(fields)}.", fields=fields
    )


def check_birth(answers: GoalAnswers, today: date) -> None:
    """A birth month in the future, or an age over 100, is a typo. Under 16 is a stop, not
    an error."""
    if answers.birth_year is None or answers.birth_month is None:
        return
    if (answers.birth_year, answers.birth_month) > (today.year, today.month):
        raise AnswersError("invalid_birth", "The birth month and year can't be in the future.")
    if age_on(answers.birth_year, answers.birth_month, today) > MAX_AGE:
        raise AnswersError("invalid_birth", f"Plans are for ages up to {MAX_AGE}.")


def check_target_and_date(
    answers: GoalAnswers, person: Person, language: str, today: date
) -> None:
    """The target weight against the current one (and height), and a custom date against the
    range the goal accepts. Skipped while the answers they need are missing."""
    goal = answers.goal
    if goal not in WEIGHT_GOALS:
        return
    target = answers.target_weight_kg
    if target is not None and person.weight_kg is not None and person.height_cm is not None:
        problem = gates.check_target(person, goal, target)
        if problem is not None:
            message = texts.error_message(
                language, problem.code, {"min_kg": problem.min_kg, "max_kg": problem.max_kg}
            )
            raise AnswersError(
                problem.code,
                message,
                min_target_weight_kg=problem.min_kg,
                max_target_weight_kg=problem.max_kg,
            )
    if answers.pace == "custom" and answers.target_date is not None:
        earliest, latest = algorithm.custom_date_range(goal, today)
        if not earliest <= answers.target_date <= latest:
            message = texts.error_message(
                language, "target_date_out_of_range", {"min_date": earliest, "max_date": latest}
            )
            raise AnswersError(
                "target_date_out_of_range",
                message,
                custom_date_range={"min": earliest.isoformat(), "max": latest.isoformat()},
            )


# --- Reading gates and plans -----------------------------------------------------------------


def gate_read(gate: gates.Gate, language: str) -> GateRead:
    return GateRead(
        result=gate.result,
        allowed_goals=list(gate.allowed_goals),
        reasons=[
            Reason(code=code, message=texts.reason_message(language, code))
            for code in gate.reasons
        ],
        stop=None if gate.stop is None else StopScreen(**texts.stop_screen(language, gate.stop)),
    )


def _notices(language: str, notices: list[dict[str, Any]]) -> list[Notice]:
    return [Notice(code=n["code"], message=texts.notice_message(language, n)) for n in notices]


# --- Preview ---------------------------------------------------------------------------------


def preview(answers: GoalAnswers, language: str, today: date) -> PreviewRead:
    """The gate for the answers so far and, once the pace screen's inputs are in, the pace
    options with their real dates. Missing answers are never an error here."""
    check_birth(answers, today)
    person = from_answers(answers, today)
    goal = answers.goal
    gate = gates.evaluate(person, goal)
    result = PreviewRead(
        gate=gate_read(gate, language),
        pace_options=[],
        custom_date_range=None,
        max_rate_kg_week=None,
        notices=[],
    )
    if gate.stop is not None or goal not in WEIGHT_GOALS:
        return result
    if goal not in gate.allowed_goals:
        return result

    check_target_and_date(answers, person, language, today)

    target = answers.target_weight_kg
    ready = person.complete and (
        target is not None
        if goal == "lose_fat"
        else (person.strength_days == 0 or person.lifting_experience is not None)
    )
    if not ready:
        return result

    p = algorithm.paces(person, goal)
    options = algorithm.pace_options(person, goal, target, today)
    result.pace_options = [
        PaceOption(
            pace=option.pace,
            rate_kg_week=algorithm.display_rate(option.rate_kg_week),
            effective_rate_kg_week=algorithm.display_rate(option.effective_rate_kg_week),
            weeks=option.weeks,
            goal_date=option.goal_date,
            kcal=option.kcal,
            available=option.available,
        )
        for option in options
    ]
    result.max_rate_kg_week = algorithm.display_rate(p.max_fraction * person.weight_kg)
    result.custom_date_range = _custom_dates(goal, target, today)

    # Notices for the pace picked so far (Steady until then).
    pace = answers.pace
    if pace == "custom" and (answers.target_date is None or target is None):
        pace = None
    if pace == "faster" and not _faster_offered(options):
        pace = None
    plan = algorithm.build_plan(person, goal, pace, target, answers.target_date, today)
    result.notices = _notices(language, list(plan.notices))
    return result


def _faster_offered(options: list[algorithm.PaceChoice]) -> bool:
    return next(option.available for option in options if option.pace == "faster")


def _custom_dates(goal: str, target: float | None, today: date) -> DateRange | None:
    """The dates "I have a date in mind" accepts (4 or 8 to 52 or 104 weeks away); None with no
    target, as a date needs one. A date sooner than the fastest pace on offer reaches is
    planned at that pace, with a `pace_clamped` notice: the app says so as the date is picked."""
    if target is None:
        return None
    earliest, latest = algorithm.custom_date_range(goal, today)
    return DateRange(min=earliest, max=latest)


# --- Goals -----------------------------------------------------------------------------------


def _stop_targets(db: Session, user: User) -> None:
    """Log without targets: no targets shown at all, and no active plan."""
    current = active_plan(db, user)
    if current is not None:
        current.status = "archived"
    user.targets_mode = "none"


def goal_read(goal: NutritionGoal, today: date) -> GoalRead:
    answers = GoalAnswers.model_validate(goal.answers)
    gate = gates.evaluate(from_answers(answers, today), answers.goal)
    return GoalRead(
        id=goal.id,
        questionnaire_version=goal.questionnaire_version,
        language=goal.language,
        answers=answers,
        consented_at=goal.consented_at,
        created_at=goal.created_at,
        gate=gate_read(gate, goal.language),
    )


def create_goal(db: Session, user: User, data: GoalCreate, today: date) -> tuple[GoalRead, bool]:
    """Check and store the answers. Returns the goal as read, and whether it was stored
    (under-16s' answers never are).

    In order: the answers every goal needs (goal, birth); the birth date; the gates — a stop
    is stored as is, however few answers there are; the goal must be one the gates allow; the
    rest of the answers; the target, custom date and pace.
    """
    answers = data.answers
    missing = [name for name in ALWAYS_NEEDED if getattr(answers, name) is None]
    if missing:
        raise _missing_error(missing)
    check_birth(answers, today)
    person = from_answers(answers, today)
    gate = gates.evaluate(person, answers.goal)

    if gate.stop == "under_16":
        _stop_targets(db, user)
        db.commit()
        not_stored = GoalRead(
            id=None,
            questionnaire_version=data.questionnaire_version,
            language=data.language,
            answers=None,
            consented_at=None,
            created_at=None,
            gate=gate_read(gate, data.language),
        )
        return not_stored, False

    if gate.stop is None:
        if answers.goal not in gate.allowed_goals:
            raise AnswersError(
                "goal_not_allowed",
                "That goal isn't available for these answers; `gate` says which are.",
                gate=gate_read(gate, data.language).model_dump(mode="json"),
            )
        missing = missing_answers(answers)
        if missing:
            raise _missing_error(missing)
        check_target_and_date(answers, person, data.language, today)
        if answers.pace == "faster" and not _faster_offered(
            algorithm.pace_options(person, answers.goal, answers.target_weight_kg, today)
        ):
            message = texts.error_message(data.language, "pace_not_available", {})
            raise AnswersError("pace_not_available", message)

    goal = NutritionGoal(
        user_id=user.id,
        questionnaire_version=data.questionnaire_version,
        answers=answers.model_dump(mode="json"),
        language=data.language,
        consent_version=data.consent_version,
        consented_at=datetime.now(UTC),
    )
    db.add(goal)
    if gate.stop is not None:
        _stop_targets(db, user)
    elif user.targets_mode == "none":
        # A re-screen that no longer stops: back to the default targets until a plan is used.
        user.targets_mode = "default"
    db.commit()
    db.refresh(goal)
    return goal_read(goal, today), True


def latest_goal(db: Session, user: User) -> NutritionGoal | None:
    return db.scalar(
        select(NutritionGoal)
        .where(NutritionGoal.user_id == user.id)
        .order_by(NutritionGoal.created_at.desc(), NutritionGoal.id.desc())
        .limit(1)
    )


# --- Plans -----------------------------------------------------------------------------------


def active_plan(db: Session, user: User) -> NutritionPlan | None:
    return db.scalar(
        select(NutritionPlan).where(
            NutritionPlan.user_id == user.id, NutritionPlan.status == "active"
        )
    )


def maintenance_kcal(db: Session, user: User) -> int | None:
    """The active plan's estimated daily expenditure (its TDEE), as the plan shows it; None
    without an active plan."""
    plan = active_plan(db, user)
    if plan is None:
        return None
    return int(algorithm.round_to(plan.baseline["tdee"], algorithm.KCAL_STEP))


def _decimal(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def create_plan(db: Session, user: User, goal_id: int, today: date) -> NutritionPlan:
    """A draft plan from one of the user's goals, built with today's age."""
    goal = db.scalar(
        select(NutritionGoal).where(NutritionGoal.id == goal_id, NutritionGoal.user_id == user.id)
    )
    if goal is None:
        raise GoalNotFoundError(f"Goal {goal_id} not found.")
    answers = GoalAnswers.model_validate(goal.answers)
    person = from_answers(answers, today)
    gate = gates.evaluate(person, answers.goal)
    if gate.stop is not None:
        raise PlanConflictError(
            "gate_stop", "These answers stop the plan, so no plan can be built from them."
        )
    if user.targets_mode == "none":
        raise PlanConflictError(
            "targets_off",
            "The user's latest answers stopped the plan; answer the questionnaire again first.",
        )
    if answers.goal not in gate.allowed_goals:
        raise PlanConflictError(
            "goal_not_allowed", "The gates no longer allow this goal; answer again."
        )

    plan = algorithm.build_plan(
        person, answers.goal, answers.pace, answers.target_weight_kg, answers.target_date, today
    )
    current = active_plan(db, user)
    row = NutritionPlan(
        user_id=user.id,
        goal_id=goal.id,
        status="draft",
        reason="change" if current is not None else "initial",
        previous_plan_id=None if current is None else current.id,
        goal=plan.goal,
        pace=plan.pace,
        pattern_key=plan.pattern_key,
        language=goal.language,
        targets=plan.targets,
        rate={
            "requested_kg_week": algorithm.display_rate(plan.requested_rate_kg_week),
            "effective_kg_week": algorithm.display_rate(plan.effective_rate_kg_week),
            "clamped": plan.clamped,
        },
        notices=list(plan.notices),
        baseline={
            **algorithm.baseline(plan, person),
            "addons": texts.addon_codes(answers, person, plan.goal, plan.targets["kcal"]),
            "inputs": answers.model_dump(
                mode="json",
                include={
                    "sex", "height_cm", "weight_kg", "health", "activity", "strength_days",
                    "cardio_days", "lifting_experience", "eating_style", "allergies",
                    "meals_per_day",
                },
            ),
        },
        start_weight_kg=_decimal(plan.start_weight_kg),
        target_weight_kg=_decimal(plan.target_weight_kg),
        goal_date=plan.goal_date,
        weeks=plan.weeks,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def activate(db: Session, user: User, plan_id: int, now: datetime) -> NutritionPlan:
    """Make a draft the active plan: the active one is archived, and the draft's targets
    become the user's daily targets."""
    row = db.scalar(
        select(NutritionPlan).where(NutritionPlan.id == plan_id, NutritionPlan.user_id == user.id)
    )
    if row is None:
        raise PlanNotFoundError(f"Plan {plan_id} not found.")
    if row.status != "draft":
        raise PlanConflictError(
            "not_a_draft", f"Only a draft can be activated; this plan is {row.status}."
        )
    if user.targets_mode == "none":
        raise PlanConflictError(
            "targets_off",
            "The user's latest answers stopped the plan; answer the questionnaire again first.",
        )

    current = active_plan(db, user)
    if current is not None:
        current.status = "archived"
        db.flush()  # before the draft becomes active: at most one active plan per user
        row.previous_plan_id = current.id
        if row.reason == "initial":
            row.reason = "change"
    row.status = "active"
    row.activated_at = now

    targets = row.targets
    user.kcal_target = Decimal(targets["kcal"])
    user.protein_target_g = Decimal(targets["protein_g"])
    user.carbs_target_g = Decimal(targets["carbs_g"])
    user.fat_target_g = Decimal(targets["fat_g"])
    user.fiber_target_g = Decimal(targets["fiber_g"])
    user.targets_mode = "plan"
    db.commit()
    db.refresh(row)
    return row


def plan_read(row: NutritionPlan) -> PlanRead:
    """The plan with its notices and texts rendered in its language."""
    baseline = row.baseline
    inputs = baseline["inputs"]
    targets = row.targets
    meals = inputs["meals_per_day"]
    values = {
        **targets,
        "maintenance_kcal": int(algorithm.round_to(baseline["tdee"], algorithm.KCAL_STEP)),
        "rate_kg_week": row.rate["effective_kg_week"],
        "goal_date": row.goal_date,
        "weeks": row.weeks,
        "target_weight_kg": None if row.target_weight_kg is None else float(row.target_weight_kg),
        "start_weight_kg": float(row.start_weight_kg),
        "meals_per_day": meals,
        "protein_per_meal_g": algorithm.round_to(
            targets["protein_g"] / meals, algorithm.GRAMS_STEP
        ),
        "allergies": inputs["allergies"] or None,
    }
    return PlanRead(
        id=row.id,
        goal_id=row.goal_id,
        status=row.status,
        reason=row.reason,
        language=row.language,
        goal=row.goal,
        pace=row.pace,
        targets=targets,
        rate=row.rate,
        start_weight_kg=float(row.start_weight_kg),
        target_weight_kg=values["target_weight_kg"],
        goal_date=row.goal_date,
        weeks=row.weeks,
        notices=_notices(row.language, row.notices),
        texts=texts.plan_texts(row.language, row.pattern_key, values, baseline["addons"]),
        pattern_key=row.pattern_key,
        created_at=row.created_at,
        activated_at=row.activated_at,
    )
