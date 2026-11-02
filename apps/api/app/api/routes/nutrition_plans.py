"""The premium nutrition plan: questionnaire answers (goals), previews and plans. See
docs/api.md and docs/plans/ai-nutrition-plan.md.

Every route needs sign-in and the premium plan; basic users get 403. The logic is in
`app/services/nutrition_plan/`.
"""

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.db.session import get_db
from app.schemas.nutrition_plan import (
    GoalCreate,
    GoalRead,
    PlanCreate,
    PlanRead,
    PreviewRead,
    PreviewRequest,
)
from app.services.auth import AUTH_RESPONSES, require_plan
from app.services.nutrition_plan import plans
from app.services.nutrition_plan.plans import (
    AnswersError,
    GoalNotFoundError,
    PlanConflictError,
    PlanNotFoundError,
)

PREMIUM_ONLY = "Personal nutrition plans are a premium feature."

router = APIRouter(
    prefix="/users/me",
    tags=["Nutrition plan"],
    responses={**AUTH_RESPONSES, 403: {"description": PREMIUM_ONLY}},
)

premium_user = require_plan("premium", detail=PREMIUM_ONLY)

ANSWERS_422 = {
    422: {
        "description": "Invalid answers. Schema errors have FastAPI's usual list as `detail`; "
        "the rest have `{\"code\", \"message\", …}` (see docs/api.md)."
    }
}


def _unprocessable(exc: AnswersError) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.detail)


@router.post(
    "/nutrition-plans/preview",
    response_model=PreviewRead,
    summary="Preview the gates and paces for answers so far",
    description=(
        "Runs the safety gates on the questionnaire answers given so far and, once the goal "
        "(Lose fat or Build muscle), body, health, activity and exercise answers and (for Lose "
        "fat) the target are in, the pace options with the weekly rate and goal date the "
        "calorie limits really allow. Nothing is stored. Missing answers are never an error "
        "here; invalid ones (and an invalid target or custom date) are 422."
    ),
    responses=ANSWERS_422,
)
def preview_plan(
    data: PreviewRequest, user: User = Depends(premium_user)
) -> PreviewRead:
    try:
        return plans.preview(data.answers, data.language, date.today())
    except AnswersError as exc:
        raise _unprocessable(exc) from exc


@router.post(
    "/goals",
    response_model=GoalRead,
    status_code=status.HTTP_201_CREATED,
    summary="Save my questionnaire answers",
    description=(
        "Stores the questionnaire answers (version 2) with the user's consent, and returns them "
        "with the safety gate's result. `201`, except under 16: `200` with `id: null`, the stop "
        "gate, and nothing stored. Any stop puts the user in log-without-targets mode "
        "(`targets_mode: none`) and archives their active plan. A goal the gates don't allow is "
        "`422` with the gate in `detail`, so the app can show the gate screen and re-submit "
        "with an allowed goal."
    ),
    responses={
        200: {"description": "Under 16: nothing stored; `id` is null and `gate` is a stop."},
        **ANSWERS_422,
    },
)
def create_goal(
    data: GoalCreate,
    response: Response,
    user: User = Depends(premium_user),
    db: Session = Depends(get_db),
) -> GoalRead:
    try:
        goal, stored = plans.create_goal(db, user, data, date.today())
    except AnswersError as exc:
        raise _unprocessable(exc) from exc
    if not stored:
        response.status_code = status.HTTP_200_OK
    return goal


@router.get(
    "/goals",
    response_model=GoalRead,
    summary="Get my latest questionnaire answers",
    description=(
        "The user's latest saved answers, with the safety gate's result for them today (age "
        "is recomputed). 404 if they have never saved any."
    ),
    responses={404: {"description": "No answers saved yet."}},
)
def get_goal(user: User = Depends(premium_user), db: Session = Depends(get_db)) -> GoalRead:
    goal = plans.latest_goal(db, user)
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No answers saved yet.")
    return plans.goal_read(goal, date.today())


@router.post(
    "/nutrition-plans",
    response_model=PlanRead,
    status_code=status.HTTP_201_CREATED,
    summary="Build a draft plan from my answers",
    description=(
        "Builds a draft plan from one of the user's saved goals: daily targets, the requested "
        "and effective weekly rate, the goal date from the effective rate, notices (a clamped "
        "pace, a tiny deficit) and the plan's texts. `reason` is `change` when the user "
        "already has an active plan, else `initial`. Nothing changes until it is activated."
    ),
    responses={
        404: {"description": "No such goal for this user."},
        409: {
            "description": "The goal's gate is a stop, or the user is in log-without-targets "
            "mode (`detail.code`: `gate_stop`, `targets_off`, `goal_not_allowed`)."
        },
    },
)
def create_plan(
    data: PlanCreate, user: User = Depends(premium_user), db: Session = Depends(get_db)
) -> PlanRead:
    try:
        row = plans.create_plan(db, user, data.goal_id, date.today())
    except GoalNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PlanConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=exc.detail) from exc
    return plans.plan_read(row)


@router.get(
    "/nutrition-plans/active",
    response_model=PlanRead,
    summary="Get my active plan",
    description="The user's active plan, with its texts, or 404 if they have none.",
    responses={404: {"description": "No active plan."}},
)
def get_active_plan(
    user: User = Depends(premium_user), db: Session = Depends(get_db)
) -> PlanRead:
    row = plans.active_plan(db, user)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No active plan.")
    return plans.plan_read(row)


@router.post(
    "/nutrition-plans/{plan_id}/activate",
    response_model=PlanRead,
    summary="Use this plan",
    description=(
        "Makes a draft the active plan: the previous active plan is archived, the plan's "
        "targets become the user's daily targets, and `targets_mode` becomes `plan`."
    ),
    responses={
        404: {"description": "No such plan for this user."},
        409: {
            "description": "The plan isn't a draft, or the user is in log-without-targets mode "
            "(`detail.code`: `not_a_draft`, `targets_off`)."
        },
    },
)
def activate_plan(
    plan_id: int, user: User = Depends(premium_user), db: Session = Depends(get_db)
) -> PlanRead:
    try:
        row = plans.activate(db, user, plan_id, datetime.now(UTC))
    except PlanNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PlanConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=exc.detail) from exc
    return plans.plan_read(row)
