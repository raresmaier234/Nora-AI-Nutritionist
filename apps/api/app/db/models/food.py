"""Food model: a canonical per-100g nutrition reference, matched against ingredients later."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.db.models.recipe_ingredient import RecipeIngredient


class Food(Base):
    __tablename__ = "foods"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    calories_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    protein_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    fat_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    carbs_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    fiber_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(back_populates="food")
