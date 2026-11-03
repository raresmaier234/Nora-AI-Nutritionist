"""Request and response shapes for the food log (`/api/v1/meals`)."""

from datetime import date as Date
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, model_validator

from app.schemas.food import Per100g

MealSlug = Literal["breakfast", "lunch", "dinner", "snacks"]
EntrySource = Literal["database", "custom", "barcode", "photo", "recipe"]

# A single entry heavier than this is a typo, not a meal.
MAX_GRAMS = 5000


class FoodLogEntryCreate(BaseModel):
    """Log one food.

    Either `food_id` (a food from the database — its name and macros are taken from the
    database, whatever else is sent) or `name` and `per_100g` (custom, barcode, photo or
    recipe entries).
    """

    date: Date | None = Field(
        default=None,
        description="Day to log to. Defaults to the day of `logged_at`, or today.",
    )
    logged_at: AwareDatetime | None = Field(
        default=None,
        description="When the food was eaten, with its UTC offset. Defaults to now.",
    )
    meal: MealSlug | None = Field(
        default=None, description="Defaults to the meal for the hour it was eaten."
    )
    food_id: int | None = None
    source: EntrySource = "database"
    name: str | None = Field(default=None, min_length=1, max_length=200)
    per_100g: Per100g | None = None
    amount: float = Field(gt=0, le=100_000)
    unit: str = Field(min_length=1, max_length=40)
    grams: float = Field(gt=0, le=MAX_GRAMS)

    @model_validator(mode="after")
    def _food_or_snapshot(self) -> "FoodLogEntryCreate":
        if self.food_id is None and (self.name is None or self.per_100g is None):
            raise ValueError("send either food_id, or both name and per_100g")
        if self.date is not None and self.logged_at is not None:
            if self.date != self.logged_at.date():
                raise ValueError("date and logged_at are different days")
        return self


class FoodLogEntryUpdate(BaseModel):
    """Change how much was eaten, when, or which meal it belongs to. Omitted fields are kept."""

    logged_at: AwareDatetime | None = Field(
        default=None,
        description="New time eaten. Moves the entry to that day, and to that hour's meal "
        "unless `meal` is also sent.",
    )
    meal: MealSlug | None = None
    amount: float | None = Field(default=None, gt=0, le=100_000)
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    grams: float | None = Field(default=None, gt=0, le=MAX_GRAMS)


class FoodLogEntryRead(BaseModel):
    """One logged food, with the per-100g values it was logged with."""

    id: int
    date: Date
    meal: MealSlug
    food_id: int | None
    source: EntrySource
    name: str
    per_100g: Per100g
    amount: float
    unit: str
    grams: float
    logged_at: datetime


class Portion(BaseModel):
    """An amount of a food as it was logged: "1.5" "cup", weighing 373 g."""

    amount: float
    unit: str
    grams: float


class FoodPortions(BaseModel):
    """How much of one food the signed-in user usually logs, and logged last time."""

    usual: Portion | None = Field(
        description="The amount logged most often among recent entries, once it's been logged "
        "at least twice; null until then."
    )
    last: Portion | None = Field(description="The amount logged most recently; null if never.")


class DayTotals(BaseModel):
    """What was eaten on one day."""

    date: Date
    kcal: float
    protein: float
    carbs: float
    fat: float
    fiber: float | None = Field(
        description="Grams of fibre from the database foods logged that day that state it; null "
        "when none does (custom foods and scans carry macros only)."
    )
    entries: int = Field(description="How many foods were logged; 0 for a day with nothing.")


class LogSummary(BaseModel):
    """Daily totals over a range of days, for the dashboard."""

    days: list[DayTotals] = Field(description="Every day from `start` to `end`, in order.")
    maintenance_kcal: int | None = Field(
        description="The active plan's estimated daily expenditure (TDEE), to compare intake "
        "against; null without an active plan."
    )


class CopyDayRequest(BaseModel):
    """Copy every entry from one day onto another (the app's "Copy yesterday")."""

    from_date: Date
    to_date: Date
