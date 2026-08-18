"""add recipes foods recipe_ingredients tables

Revision ID: d681670d77ff
Revises: 
Create Date: 2026-08-14 16:39:37.761386

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd681670d77ff'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "foods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("calories_per_100g", sa.Numeric(), nullable=True),
        sa.Column("protein_per_100g", sa.Numeric(), nullable=True),
        sa.Column("fat_per_100g", sa.Numeric(), nullable=True),
        sa.Column("carbs_per_100g", sa.Numeric(), nullable=True),
        sa.Column("fiber_per_100g", sa.Numeric(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_foods_name", "foods", ["name"])

    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_nutrition", postgresql.JSONB(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_recipes_source_url", "recipes", ["source_url"])

    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("food_id", sa.Integer(), sa.ForeignKey("foods.id", ondelete="SET NULL"), nullable=True),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=True),
        sa.Column("unit", sa.Text(), nullable=True),
        sa.Column("grams", sa.Numeric(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_recipe_ingredients_recipe_id", "recipe_ingredients", ["recipe_id"])
    op.create_index("ix_recipe_ingredients_food_id", "recipe_ingredients", ["food_id"])


def downgrade() -> None:
    op.drop_table("recipe_ingredients")
    op.drop_index("ix_recipes_source_url", table_name="recipes")
    op.drop_table("recipes")
    op.drop_index("ix_foods_name", table_name="foods")
    op.drop_table("foods")
