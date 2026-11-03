"""Add servings to foods

Revision ID: 8f3c1a5e7b92
Revises: 7e2b9c4d6a31
Create Date: 2026-11-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "8f3c1a5e7b92"
down_revision: str | None = "7e2b9c4d6a31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("foods", sa.Column("servings", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("foods", "servings")
