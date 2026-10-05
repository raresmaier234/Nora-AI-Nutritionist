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

    # The full profile, per 100g, in the unit each name states (no unit = grams). Mostly
    # empty for sites that publish only the label; see app/services/ingest/nutrients.py.
    # Carbohydrate breakdown.
    starch_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    sucrose_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    glucose_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    fructose_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    lactose_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    maltose_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    galactose_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    # Fat breakdown.
    monounsaturated_fat_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    polyunsaturated_fat_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    trans_fat_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    omega_3_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    omega_6_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    ala_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    epa_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    dha_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    dpa_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    cholesterol_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    # Protein breakdown: amino acids.
    tryptophan_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    threonine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    isoleucine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    leucine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    lysine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    methionine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    cystine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    phenylalanine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    tyrosine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    valine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    arginine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    histidine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    alanine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    aspartic_acid_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    glutamic_acid_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    glycine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    proline_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    serine_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    hydroxyproline_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    # Vitamins.
    vitamin_a_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    retinol_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    beta_carotene_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    alpha_carotene_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    lycopene_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_d_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_d2_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_d3_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_k_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    folate_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_b12_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_c_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_e_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    thiamin_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    riboflavin_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    niacin_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    pantothenic_acid_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    vitamin_b6_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    choline_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    betaine_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    # Minerals.
    calcium_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    iron_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    magnesium_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    phosphorus_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    potassium_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    zinc_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    copper_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    manganese_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    selenium_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    fluoride_ug_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    # Water, alcohol and stimulants.
    water_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    alcohol_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    caffeine_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    theobromine_mg_per_100g: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

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
