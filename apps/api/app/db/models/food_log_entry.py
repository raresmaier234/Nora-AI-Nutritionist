"""FoodLogEntry model: one food logged to one meal on one day.

There are no user accounts yet, so this is a single shared log. When authentication is
built, entries gain a `user_id` and every query filters on it.

An entry keeps its own copy of the food's name and per-100g macros rather than reading them
through `food_id` at display time. That is what lets foods that are not in the database —
a custom food, a photo estimate, a recipe — be logged at all, and it keeps the history
fixed: re-farming or correcting a food must not change what someone ate last week.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.db.models.food import Food

MEALS = ("breakfast", "lunch", "dinner", "snacks")
SOURCES = ("database", "custom", "barcode", "photo", "recipe")


class FoodLogEntry(Base):
    __tablename__ = "food_log_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    logged_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal: Mapped[str] = mapped_column(Text, nullable=False)

    # Set when the entry came from the food database; kept nullable so deleting a food does
    # not delete anyone's history.
    food_id: Mapped[int | None] = mapped_column(
        ForeignKey("foods.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source: Mapped[str] = mapped_column(Text, nullable=False)

    # Snapshot of the food at the time it was logged.
    name: Mapped[str] = mapped_column(Text, nullable=False)
    kcal_per_100g: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    protein_per_100g: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    carbs_per_100g: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    fat_per_100g: Mapped[Decimal] = mapped_column(Numeric, nullable=False)

    # What the user entered ("1 piece") and what it weighs; macros are computed from grams.
    amount: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    grams: Mapped[Decimal] = mapped_column(Numeric, nullable=False)

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    food: Mapped["Food | None"] = relationship()

    __table_args__ = (
        CheckConstraint(
            "meal IN ('breakfast', 'lunch', 'dinner', 'snacks')", name="ck_food_log_entries_meal"
        ),
        CheckConstraint(
            "source IN ('database', 'custom', 'barcode', 'photo', 'recipe')",
            name="ck_food_log_entries_source",
        ),
        CheckConstraint("grams > 0", name="ck_food_log_entries_grams_positive"),
    )
