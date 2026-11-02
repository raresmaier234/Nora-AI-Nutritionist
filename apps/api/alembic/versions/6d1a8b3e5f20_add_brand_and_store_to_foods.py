"""Add brand and store to foods

Revision ID: 6d1a8b3e5f20
Revises: 5c9e2f7a1d43
Create Date: 2026-11-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6d1a8b3e5f20"
down_revision: str | None = "5c9e2f7a1d43"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("foods", sa.Column("brand", sa.Text(), nullable=True))
    op.add_column("foods", sa.Column("store", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("foods", "store")
    op.drop_column("foods", "brand")
