"""Add food ingest fields, trigram dedup index, and the ingest job frontier

Revision ID: b3f1a9c72d04
Revises: d681670d77ff
Create Date: 2026-08-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3f1a9c72d04"
down_revision: str | None = "d681670d77ff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Similarity search for near-duplicate food names.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.add_column("foods", sa.Column("name_normalized", sa.Text(), nullable=True))
    op.add_column("foods", sa.Column("sugar_per_100g", sa.Numeric(), nullable=True))
    op.add_column("foods", sa.Column("saturated_fat_per_100g", sa.Numeric(), nullable=True))
    op.add_column("foods", sa.Column("sodium_mg_per_100g", sa.Numeric(), nullable=True))
    op.add_column("foods", sa.Column("source_url", sa.Text(), nullable=True))
    op.add_column("foods", sa.Column("raw_extraction", postgresql.JSONB(), nullable=True))
    op.add_column(
        "foods",
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "foods",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Backfill so the NOT NULL below holds for any pre-existing rows. Mirrors
    # normalize_name(): lowercase, non-alphanumerics collapsed to single spaces, trimmed.
    op.execute(
        """
        UPDATE foods
        SET name_normalized = trim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g'))
        WHERE name_normalized IS NULL
        """
    )

    op.alter_column("foods", "name_normalized", nullable=False)
    op.create_unique_constraint("uq_foods_name_normalized", "foods", ["name_normalized"])

    op.create_index(
        "ix_foods_name_normalized_trgm",
        "foods",
        ["name_normalized"],
        postgresql_using="gin",
        postgresql_ops={"name_normalized": "gin_trgm_ops"},
    )

    op.create_table(
        "ingest_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("foods_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_unique_constraint("uq_ingest_jobs_url", "ingest_jobs", ["url"])
    op.create_index("ix_ingest_jobs_status", "ingest_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ingest_jobs_status", table_name="ingest_jobs")
    op.drop_constraint("uq_ingest_jobs_url", "ingest_jobs", type_="unique")
    op.drop_table("ingest_jobs")

    op.drop_index("ix_foods_name_normalized_trgm", table_name="foods")
    op.drop_constraint("uq_foods_name_normalized", "foods", type_="unique")

    op.drop_column("foods", "updated_at")
    op.drop_column("foods", "needs_review")
    op.drop_column("foods", "raw_extraction")
    op.drop_column("foods", "source_url")
    op.drop_column("foods", "sodium_mg_per_100g")
    op.drop_column("foods", "saturated_fat_per_100g")
    op.drop_column("foods", "sugar_per_100g")
    op.drop_column("foods", "name_normalized")

    # pg_trgm is left installed — other objects may depend on it.
