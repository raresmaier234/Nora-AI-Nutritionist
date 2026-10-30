"""add users, and an owner for each food log entry

Accounts, signed in through Supabase Auth: `users.id` is the Supabase user id. Each food log
entry gains a `user_id`, nullable for now: the entries logged before accounts existed have
no owner until scripts/claim_shared_log.py assigns them. A later migration makes it NOT NULL,
once that script has run in every environment — doing it here would fail on those entries.

Revision ID: 84b0e5747027
Revises: a7c4e9d2b318
Create Date: 2026-10-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "84b0e5747027"
down_revision: str | None = "a7c4e9d2b318"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("plan", sa.Text(), server_default="basic", nullable=False),
        sa.Column("plan_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("kcal_target", sa.Numeric(), server_default="2000", nullable=False),
        sa.Column("protein_target_g", sa.Numeric(), server_default="150", nullable=False),
        sa.Column("carbs_target_g", sa.Numeric(), server_default="220", nullable=False),
        sa.Column("fat_target_g", sa.Numeric(), server_default="70", nullable=False),
        sa.Column("fiber_target_g", sa.Numeric(), server_default="28", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("plan IN ('basic', 'premium')", name="ck_users_plan"),
    )

    op.add_column(
        "food_log_entries",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_food_log_entries_user_id_logged_on", "food_log_entries", ["user_id", "logged_on"]
    )


def downgrade() -> None:
    op.drop_index("ix_food_log_entries_user_id_logged_on", table_name="food_log_entries")
    op.drop_column("food_log_entries", "user_id")
    op.drop_table("users")
