"""RecipeIngredient model: one ingredient line of a recipe, optionally matched to a Food."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.db.models.food import Food
    from app.db.models.recipe import Recipe


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    food_id: Mapped[int | None] = mapped_column(
        ForeignKey("foods.id", ondelete="SET NULL"), nullable=True, index=True
    )
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    grams: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")
    food: Mapped["Food | None"] = relationship(back_populates="recipe_ingredients")
