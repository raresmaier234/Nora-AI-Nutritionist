"""Food model: a canonical per-100g nutrition reference, matched against ingredients later."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Index, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.utils.naming import normalize_name

if TYPE_CHECKING:
    from app.db.models.recipe_ingredient import RecipeIngredient


class Food(Base):
    __tablename__ = "foods"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    # Case/accent/punctuation-folded name. Unique, so duplicate foods cannot be inserted
    # even if a dedup check upstream misses one. Derived from `name` when not supplied, so
    # no call site can accidentally create a food without its dedup key.
    name_normalized: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        default=lambda context: normalize_name(context.get_current_parameters()["name"]),
    )

    calories_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    protein_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    fat_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    carbs_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    fiber_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    sugar_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    saturated_fat_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    sodium_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The extractor's verbatim output. Kept so a normalization bug can be corrected later
    # without re-crawling the source page.
    raw_extraction: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    needs_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(back_populates="food")

    __table_args__ = (
        # Trigram index for similarity search. At 100k+ rows an unindexed similarity()
        # scan is a sequential read of the whole table on every candidate lookup.
        Index(
            "ix_foods_name_normalized_trgm",
            "name_normalized",
            postgresql_using="gin",
            postgresql_ops={"name_normalized": "gin_trgm_ops"},
        ),
    )
