"""Add package serving to foods

Revision ID: 9b4d2e6f8a13
Revises: 8f3c1a5e7b92
Create Date: 2026-11-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9b4d2e6f8a13"
down_revision: str | None = "8f3c1a5e7b92"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("foods", sa.Column("package_serving_label", sa.Text(), nullable=True))
    op.add_column("foods", sa.Column("package_serving_grams", sa.Numeric(), nullable=True))


def downgrade() -> None:
    op.drop_column("foods", "package_serving_grams")
    op.drop_column("foods", "package_serving_label")
