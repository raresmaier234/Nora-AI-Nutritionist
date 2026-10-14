"""The food log: what was eaten, when, per day.

A single shared log until user accounts exist — see `app/db/models/food_log_entry.py`.
"""

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.db.models.food_log_entry import FoodLogEntry
from app.schemas.food import Per100g
from app.schemas.meal import FoodLogEntryCreate, FoodLogEntryRead, FoodLogEntryUpdate


class FoodNotFoundError(LookupError):
    """The `food_id` given does not exist."""


class FoodNotLoggableError(ValueError):
    """The food exists but lacks calories or a macro, so its entry would be meaningless."""


class EntryNotFoundError(LookupError):
    """No log entry has this id."""


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


def list_entries(db: Session, day: date) -> list[FoodLogEntry]:
    statement = (
        select(FoodLogEntry)
        .where(FoodLogEntry.logged_on == day)
        .order_by(FoodLogEntry.logged_at, FoodLogEntry.id)
    )
    return list(db.execute(statement).scalars())


def create_entry(db: Session, data: FoodLogEntryCreate) -> FoodLogEntry:
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


def update_entry(db: Session, entry_id: int, data: FoodLogEntryUpdate) -> FoodLogEntry:
    entry = db.get(FoodLogEntry, entry_id)
    if entry is None:
        raise EntryNotFoundError(f"entry {entry_id} does not exist")

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


def delete_entry(db: Session, entry_id: int) -> None:
    entry = db.get(FoodLogEntry, entry_id)
    if entry is None:
        raise EntryNotFoundError(f"entry {entry_id} does not exist")
    db.delete(entry)
    db.commit()


def copy_day(db: Session, from_date: date, to_date: date) -> list[FoodLogEntry]:
    """Copy every entry of `from_date` onto `to_date`, keeping each entry's time of day.

    Breakfast logged at 08:10 yesterday is copied as 08:10 today, so the copied day reads
    the same. Done in one transaction: the day is copied whole or not at all.
    """
    shift = datetime.combine(to_date, time()) - datetime.combine(from_date, time())
    copies = [
        FoodLogEntry(
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
        for entry in list_entries(db, from_date)
    ]
    db.add_all(copies)
    db.commit()
    for copy in copies:
        db.refresh(copy)
    return copies


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
