"""The food log: what was eaten, when, per day.

Every user has their own log. Each function takes the signed-in user's id and only ever
reads or changes that user's entries: another user's entry is "not found", exactly like one
that doesn't exist, so ids reveal nothing.
"""

import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.db.models.food_log_entry import FoodLogEntry
from app.schemas.food import Per100g
from app.schemas.meal import (
    DayTotals,
    FoodLogEntryCreate,
    FoodLogEntryRead,
    FoodLogEntryUpdate,
    FoodPortions,
    Portion,
)


class FoodNotFoundError(LookupError):
    """The `food_id` given does not exist."""


class FoodNotLoggableError(ValueError):
    """The food exists but lacks calories or a macro, so its entry would be meaningless."""


class EntryNotFoundError(LookupError):
    """The user has no log entry with this id."""


def _decimal(value: float) -> Decimal:
    # Via str, so 0.1 is stored as 0.1 and not as 0.1000000000000000055511151231257827.
    return Decimal(str(value))


def meal_for(eaten_at: datetime) -> str:
    """The meal an entry belongs to when the client gives only the time it was eaten.

    Read in the time's own UTC offset, so 08:10 in the user's timezone is breakfast
    wherever the server runs.
    """
    hour = eaten_at.hour
    if 5 <= hour < 11:
        return "breakfast"
    if 11 <= hour < 15:
        return "lunch"
    if 17 <= hour < 22:
        return "dinner"
    return "snacks"


def list_entries(db: Session, user_id: uuid.UUID, day: date) -> list[FoodLogEntry]:
    statement = (
        select(FoodLogEntry)
        .where(FoodLogEntry.user_id == user_id, FoodLogEntry.logged_on == day)
        .order_by(FoodLogEntry.logged_at, FoodLogEntry.id)
    )
    return list(db.execute(statement).scalars())


def _get_entry(db: Session, user_id: uuid.UUID, entry_id: int) -> FoodLogEntry:
    entry = db.execute(
        select(FoodLogEntry).where(FoodLogEntry.id == entry_id, FoodLogEntry.user_id == user_id)
    ).scalar_one_or_none()
    if entry is None:
        raise EntryNotFoundError(f"entry {entry_id} does not exist")
    return entry


def create_entry(db: Session, user_id: uuid.UUID, data: FoodLogEntryCreate) -> FoodLogEntry:
    """Log one food. A database food's name and values come from the database, not the request."""
    if data.food_id is not None:
        food = db.get(Food, data.food_id)
        if food is None:
            raise FoodNotFoundError(f"food {data.food_id} does not exist")
        values = (
            food.calories_per_100g,
            food.protein_per_100g,
            food.carbs_per_100g,
            food.fat_per_100g,
        )
        if any(value is None for value in values):
            raise FoodNotLoggableError(f"food {data.food_id} has no complete nutrition values")
        name = food.name
        kcal, protein, carbs, fat = values
    else:
        if data.name is None or data.per_100g is None:  # the schema already rejects this
            raise FoodNotLoggableError("an entry without food_id needs name and per_100g")
        name = data.name.strip()
        kcal, protein, carbs, fat = (
            _decimal(data.per_100g.kcal),
            _decimal(data.per_100g.protein),
            _decimal(data.per_100g.carbs),
            _decimal(data.per_100g.fat),
        )

    # Without logged_at the database stamps the entry with now(), as it always has.
    eaten_at = data.logged_at
    if eaten_at is not None:
        logged_on = eaten_at.date()
    else:
        logged_on = data.date or date.today()
    meal = data.meal or meal_for(eaten_at or datetime.now().astimezone())

    entry = FoodLogEntry(
        user_id=user_id,
        logged_on=logged_on,
        meal=meal,
        food_id=data.food_id,
        source=data.source,
        name=name,
        kcal_per_100g=kcal,
        protein_per_100g=protein,
        carbs_per_100g=carbs,
        fat_per_100g=fat,
        amount=_decimal(data.amount),
        unit=data.unit,
        grams=_decimal(data.grams),
    )
    if eaten_at is not None:
        entry.logged_at = eaten_at
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_entry(
    db: Session, user_id: uuid.UUID, entry_id: int, data: FoodLogEntryUpdate
) -> FoodLogEntry:
    entry = _get_entry(db, user_id, entry_id)

    if data.logged_at is not None:
        entry.logged_at = data.logged_at
        entry.logged_on = data.logged_at.date()
        entry.meal = meal_for(data.logged_at)
    if data.meal is not None:
        entry.meal = data.meal
    if data.amount is not None:
        entry.amount = _decimal(data.amount)
    if data.unit is not None:
        entry.unit = data.unit
    if data.grams is not None:
        entry.grams = _decimal(data.grams)

    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(db: Session, user_id: uuid.UUID, entry_id: int) -> None:
    entry = _get_entry(db, user_id, entry_id)
    db.delete(entry)
    db.commit()


def copy_day(
    db: Session, user_id: uuid.UUID, from_date: date, to_date: date
) -> list[FoodLogEntry]:
    """Copy the user's entries of `from_date` onto `to_date`, keeping each one's time of day.

    Breakfast logged at 08:10 yesterday is copied as 08:10 today, so the copied day reads
    the same. Done in one transaction: the day is copied whole or not at all.
    """
    shift = datetime.combine(to_date, time()) - datetime.combine(from_date, time())
    copies = [
        FoodLogEntry(
            user_id=user_id,
            logged_on=to_date,
            meal=entry.meal,
            food_id=entry.food_id,
            source=entry.source,
            name=entry.name,
            kcal_per_100g=entry.kcal_per_100g,
            protein_per_100g=entry.protein_per_100g,
            carbs_per_100g=entry.carbs_per_100g,
            fat_per_100g=entry.fat_per_100g,
            amount=entry.amount,
            unit=entry.unit,
            grams=entry.grams,
            logged_at=entry.logged_at + shift,
        )
        for entry in list_entries(db, user_id, from_date)
    ]
    db.add_all(copies)
    db.commit()
    for copy in copies:
        db.refresh(copy)
    return copies


def daily_totals(db: Session, user_id: uuid.UUID, start: date, end: date) -> list[DayTotals]:
    """What the user ate each day from `start` to `end`, a row for every day (zeros when nothing
    was logged). Values come from each entry's own snapshot; fibre from the food's record."""
    per_gram = FoodLogEntry.grams / 100
    rows = db.execute(
        select(
            FoodLogEntry.logged_on,
            func.sum(FoodLogEntry.kcal_per_100g * per_gram),
            func.sum(FoodLogEntry.protein_per_100g * per_gram),
            func.sum(FoodLogEntry.carbs_per_100g * per_gram),
            func.sum(FoodLogEntry.fat_per_100g * per_gram),
            func.sum(Food.fiber_per_100g * per_gram),
            func.count(FoodLogEntry.id),
        )
        .outerjoin(Food, Food.id == FoodLogEntry.food_id)
        .where(FoodLogEntry.user_id == user_id, FoodLogEntry.logged_on.between(start, end))
        .group_by(FoodLogEntry.logged_on)
    ).all()
    by_day = {row[0]: row for row in rows}

    days = []
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        row = by_day.get(day)
        if row is None:
            days.append(DayTotals(date=day, kcal=0, protein=0, carbs=0, fat=0, fiber=None, entries=0))
            continue
        _, kcal, protein, carbs, fat, fiber, count = row
        days.append(
            DayTotals(
                date=day,
                kcal=round(float(kcal), 1),
                protein=round(float(protein), 1),
                carbs=round(float(carbs), 1),
                fat=round(float(fat), 1),
                fiber=None if fiber is None else round(float(fiber), 1),
                entries=count,
            )
        )
    return days


# How far back "usual" looks, in entries of the food: recent habits, not last year's.
_RECENT_ENTRIES = 30


def portions(db: Session, user_id: uuid.UUID, food_id: int) -> FoodPortions:
    """The user's usual and last amount of a food, from their own log."""
    entries = db.execute(
        select(FoodLogEntry.amount, FoodLogEntry.unit, FoodLogEntry.grams)
        .where(FoodLogEntry.user_id == user_id, FoodLogEntry.food_id == food_id)
        .order_by(FoodLogEntry.logged_at.desc(), FoodLogEntry.id.desc())
        .limit(_RECENT_ENTRIES)
    ).all()
    if not entries:
        return FoodPortions(usual=None, last=None)

    def portion(row) -> Portion:
        return Portion(amount=float(row.amount), unit=row.unit, grams=float(row.grams))

    # Most often logged (amount, unit); a tie goes to the more recent, as the list is newest first.
    counts: dict[tuple[Decimal, str], int] = {}
    for row in entries:
        counts[(row.amount, row.unit)] = counts.get((row.amount, row.unit), 0) + 1
    best = max(counts, key=counts.get)
    usual = next(row for row in entries if (row.amount, row.unit) == best) if counts[best] >= 2 else None
    return FoodPortions(usual=portion(usual) if usual else None, last=portion(entries[0]))


def to_read(entry: FoodLogEntry) -> FoodLogEntryRead:
    return FoodLogEntryRead(
        id=entry.id,
        date=entry.logged_on,
        meal=entry.meal,
        food_id=entry.food_id,
        source=entry.source,
        name=entry.name,
        per_100g=Per100g(
            kcal=float(entry.kcal_per_100g),
            protein=float(entry.protein_per_100g),
            carbs=float(entry.carbs_per_100g),
            fat=float(entry.fat_per_100g),
        ),
        amount=float(entry.amount),
        unit=entry.unit,
        grams=float(entry.grams),
        logged_at=entry.logged_at,
    )
