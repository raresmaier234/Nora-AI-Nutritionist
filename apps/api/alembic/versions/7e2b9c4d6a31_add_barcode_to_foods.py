"""Add barcode to foods

Revision ID: 7e2b9c4d6a31
Revises: 6d1a8b3e5f20
Create Date: 2026-11-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7e2b9c4d6a31"
down_revision: str | None = "6d1a8b3e5f20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("foods", sa.Column("barcode", sa.Text(), nullable=True))
    # Unique, and the index a lookup by scanned barcode uses.
    op.create_unique_constraint("uq_foods_barcode", "foods", ["barcode"])


def downgrade() -> None:
    op.drop_constraint("uq_foods_barcode", "foods", type_="unique")
    op.drop_column("foods", "barcode")
