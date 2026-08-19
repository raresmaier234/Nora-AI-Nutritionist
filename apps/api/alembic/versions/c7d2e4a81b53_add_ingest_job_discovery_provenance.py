"""Add discovery provenance to ingest_jobs

Revision ID: c7d2e4a81b53
Revises: b3f1a9c72d04
Create Date: 2026-08-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c7d2e4a81b53"
down_revision: str | None = "b3f1a9c72d04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default backfills existing rows in the ADD COLUMN itself. Correct here:
    # everything seeded before this migration was manually supplied HTML.
    op.add_column(
        "ingest_jobs",
        sa.Column("source", sa.Text(), nullable=False, server_default="html"),
    )
    op.add_column("ingest_jobs", sa.Column("discovered_from", sa.Text(), nullable=True))
    op.add_column("ingest_jobs", sa.Column("lastmod", sa.Text(), nullable=True))
    op.create_index("ix_ingest_jobs_source", "ingest_jobs", ["source"])


def downgrade() -> None:
    op.drop_index("ix_ingest_jobs_source", table_name="ingest_jobs")
    op.drop_column("ingest_jobs", "lastmod")
    op.drop_column("ingest_jobs", "discovered_from")
    op.drop_column("ingest_jobs", "source")
