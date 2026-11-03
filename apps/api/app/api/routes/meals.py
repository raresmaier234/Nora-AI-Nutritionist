"""Food logging routes: what was eaten, when, per day. See docs/api.md.

Each signed-in user has their own log; these routes only ever see the caller's entries.
"""

from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.db.session import get_db
from app.schemas.meal import (
    CopyDayRequest,
    FoodLogEntryCreate,
    FoodLogEntryRead,
    FoodLogEntryUpdate,
    FoodPortions,
    LogSummary,
)
from app.services import food_log
from app.services.nutrition_plan import plans
from app.services.auth import AUTH_RESPONSES, get_current_user
from app.services.food_log import EntryNotFoundError, FoodNotFoundError, FoodNotLoggableError

router = APIRouter(prefix="/meals", tags=["Meals"], responses=AUTH_RESPONSES)


@router.get(
    "/entries",
    response_model=list[FoodLogEntryRead],
    summary="List a day's log",
    description="Every food the signed-in user logged on the given day, in the order eaten.",
)
def list_entries(
    date: Date | None = Query(None, description="Day as YYYY-MM-DD. Defaults to today."),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FoodLogEntryRead]:
    entries = food_log.list_entries(db, user.id, date or Date.today())
    return [food_log.to_read(e) for e in entries]


@router.get(
    "/portions",
    response_model=FoodPortions,
    summary="Your portions of a food",
    description=(
        "How much of a database food the signed-in user usually logs and logged last time, from "
        "their own log — for one-tap portion buttons. `usual` is the amount logged most often "
        "among the last 30 entries of the food, once it has been logged at least twice."
    ),
)
def get_portions(
    food_id: int = Query(description="The database food's id."),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FoodPortions:
    return food_log.portions(db, user.id, food_id)


# A dashboard asks for a week, or a few; more than a quarter is a mistake, not a chart.
MAX_SUMMARY_DAYS = 92


@router.get(
    "/summary",
    response_model=LogSummary,
    summary="Daily totals for a range of days",
    description=(
        "What the signed-in user ate each day from `start` to `end` (inclusive, at most 92 "
        "days): calories, protein, carbs, fat, fibre where known, and how many foods. Every day "
        "in the range is listed, with zeros when nothing was logged. `maintenance_kcal` is the "
        "active plan's estimated daily expenditure, to show eating against burning."
    ),
    responses={422: {"description": "`end` before `start`, or a range longer than 92 days."}},
)
def get_summary(
    start: Date = Query(description="First day, YYYY-MM-DD."),
    end: Date = Query(description="Last day, YYYY-MM-DD."),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LogSummary:
    if end < start or (end - start).days >= MAX_SUMMARY_DAYS:
        raise HTTPException(
            422,
            detail=f"the range must run forwards and cover at most {MAX_SUMMARY_DAYS} days",
        )
    return LogSummary(
        days=food_log.daily_totals(db, user.id, start, end),
        maintenance_kcal=plans.maintenance_kcal(db, user),
    )


@router.post(
    "/entries",
    response_model=FoodLogEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log a food",
    description=(
        "Log one food. Send `food_id` to log a food from the database — its name "
        "and values are taken from the database. Otherwise send `name` and `per_100g` "
        "(custom foods, barcode, photo and recipe entries). Macros are computed from `grams`. "
        "`logged_at` is when it was eaten (defaults to now); `meal` defaults to the meal for "
        "that hour."
    ),
    responses={
        404: {"description": "`food_id` does not exist."},
        422: {"description": "Invalid entry, or the food has incomplete nutrition values."},
    },
)
def create_entry(
    data: FoodLogEntryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FoodLogEntryRead:
    try:
        return food_log.to_read(food_log.create_entry(db, user.id, data))
    except FoodNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except FoodNotLoggableError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc


@router.post(
    "/entries/copy",
    response_model=list[FoodLogEntryRead],
    status_code=status.HTTP_201_CREATED,
    summary="Copy a day's log",
    description=(
        "Copy every entry the signed-in user logged on `from_date` onto `to_date`, keeping "
        "each entry's time of day. Existing entries on `to_date` are kept. Returns the new "
        "entries."
    ),
)
def copy_day(
    data: CopyDayRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FoodLogEntryRead]:
    copies = food_log.copy_day(db, user.id, data.from_date, data.to_date)
    return [food_log.to_read(e) for e in copies]


@router.patch(
    "/entries/{entry_id}",
    response_model=FoodLogEntryRead,
    summary="Change a logged food",
    description=(
        "Change the amount eaten, when it was eaten, or its meal. A new `logged_at` moves the "
        "entry to that day and to that hour's meal, unless `meal` is sent too."
    ),
    responses={404: {"description": "The signed-in user has no entry with this id."}},
)
def update_entry(
    entry_id: int,
    data: FoodLogEntryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FoodLogEntryRead:
    try:
        return food_log.to_read(food_log.update_entry(db, user.id, entry_id, data))
    except EntryNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a logged food",
    description="Delete one entry from the signed-in user's log.",
    responses={404: {"description": "The signed-in user has no entry with this id."}},
)
def delete_entry(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        food_log.delete_entry(db, user.id, entry_id)
    except EntryNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
