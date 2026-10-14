"""Food logging routes: what was eaten, when, per day. See docs/api.md.

A single shared log until user accounts exist.
"""

from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.meal import (
    CopyDayRequest,
    FoodLogEntryCreate,
    FoodLogEntryRead,
    FoodLogEntryUpdate,
)
from app.services import food_log
from app.services.food_log import EntryNotFoundError, FoodNotFoundError, FoodNotLoggableError

router = APIRouter(prefix="/meals", tags=["Meals"])


@router.get(
    "/entries",
    response_model=list[FoodLogEntryRead],
    summary="List a day's log",
    description="Every food logged on the given day, in the order it was eaten.",
)
def list_entries(
    date: Date | None = Query(None, description="Day as YYYY-MM-DD. Defaults to today."),
    db: Session = Depends(get_db),
) -> list[FoodLogEntryRead]:
    return [food_log.to_read(e) for e in food_log.list_entries(db, date or Date.today())]


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
def create_entry(data: FoodLogEntryCreate, db: Session = Depends(get_db)) -> FoodLogEntryRead:
    try:
        return food_log.to_read(food_log.create_entry(db, data))
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
        "Copy every entry from `from_date` onto `to_date`, keeping each entry's time of day. "
        "Existing entries on `to_date` are kept. Returns the new entries."
    ),
)
def copy_day(data: CopyDayRequest, db: Session = Depends(get_db)) -> list[FoodLogEntryRead]:
    return [food_log.to_read(e) for e in food_log.copy_day(db, data.from_date, data.to_date)]


@router.patch(
    "/entries/{entry_id}",
    response_model=FoodLogEntryRead,
    summary="Change a logged food",
    description=(
        "Change the amount eaten, when it was eaten, or its meal. A new `logged_at` moves the "
        "entry to that day and to that hour's meal, unless `meal` is sent too."
    ),
    responses={404: {"description": "No entry with this id."}},
)
def update_entry(
    entry_id: int, data: FoodLogEntryUpdate, db: Session = Depends(get_db)
) -> FoodLogEntryRead:
    try:
        return food_log.to_read(food_log.update_entry(db, entry_id, data))
    except EntryNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a logged food",
    description="Delete one entry from the log.",
    responses={404: {"description": "No entry with this id."}},
)
def delete_entry(entry_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        food_log.delete_entry(db, entry_id)
    except EntryNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
