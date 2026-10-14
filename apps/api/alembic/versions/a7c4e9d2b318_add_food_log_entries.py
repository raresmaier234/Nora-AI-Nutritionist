"""add food_log_entries

The food log behind the mobile Log Food screen: one row per food logged to a meal on a
day. Single shared log for now — no user_id until authentication exists.

Revision ID: a7c4e9d2b318
Revises: f5a3d7c19e62
Create Date: 2026-10-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c4e9d2b318"
down_revision: str | None = "f5a3d7c19e62"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "food_log_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("logged_on", sa.Date(), nullable=False),
        sa.Column("meal", sa.Text(), nullable=False),
        sa.Column(
            "food_id",
            sa.Integer(),
            sa.ForeignKey("foods.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kcal_per_100g", sa.Numeric(), nullable=False),
        sa.Column("protein_per_100g", sa.Numeric(), nullable=False),
        sa.Column("carbs_per_100g", sa.Numeric(), nullable=False),
        sa.Column("fat_per_100g", sa.Numeric(), nullable=False),
        sa.Column("amount", sa.Numeric(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("grams", sa.Numeric(), nullable=False),
        sa.Column(
            "logged_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "meal IN ('breakfast', 'lunch', 'dinner', 'snacks')", name="ck_food_log_entries_meal"
        ),
        sa.CheckConstraint(
            "source IN ('database', 'custom', 'barcode', 'photo', 'recipe')",
            name="ck_food_log_entries_source",
        ),
        sa.CheckConstraint("grams > 0", name="ck_food_log_entries_grams_positive"),
    )
    op.create_index("ix_food_log_entries_logged_on", "food_log_entries", ["logged_on"])
    op.create_index("ix_food_log_entries_food_id", "food_log_entries", ["food_id"])


def downgrade() -> None:
    op.drop_index("ix_food_log_entries_food_id", table_name="food_log_entries")
    op.drop_index("ix_food_log_entries_logged_on", table_name="food_log_entries")
    op.drop_table("food_log_entries")
