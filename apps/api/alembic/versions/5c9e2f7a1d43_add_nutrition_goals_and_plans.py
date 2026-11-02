"""add nutrition goals and plans, and each user's targets mode and time zone

The premium nutrition plan (docs/plans/ai-nutrition-plan.md, phase 1): `nutrition_goals` keeps
each set of questionnaire answers, `nutrition_plans` the plans built from them (at most one
active per user). `users.targets_mode` says where the daily targets come from — the defaults,
the active plan, or none at all for users a safety gate stopped — and `users.timezone` is the
user's IANA time zone, for the weekly check-ins to come.

Revision ID: 5c9e2f7a1d43
Revises: 84b0e5747027
Create Date: 2026-10-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "5c9e2f7a1d43"
down_revision: str | None = "84b0e5747027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("targets_mode", sa.Text(), server_default="default", nullable=False)
    )
    op.create_check_constraint(
        "ck_users_targets_mode", "users", "targets_mode IN ('default', 'plan', 'none')"
    )
    op.add_column("users", sa.Column("timezone", sa.Text(), nullable=True))

    op.create_table(
        "nutrition_goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("questionnaire_version", sa.Integer(), nullable=False),
        sa.Column("answers", postgresql.JSONB(), nullable=False),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("consent_version", sa.Text(), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_nutrition_goals_user_id", "nutrition_goals", ["user_id"])

    op.create_table(
        "nutrition_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "goal_id",
            sa.Integer(),
            sa.ForeignKey("nutrition_goals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "previous_plan_id",
            sa.Integer(),
            sa.ForeignKey("nutrition_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("pace", sa.Text(), nullable=True),
        sa.Column("pattern_key", sa.Text(), nullable=False),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("targets", postgresql.JSONB(), nullable=False),
        sa.Column("rate", postgresql.JSONB(), nullable=False),
        sa.Column("notices", postgresql.JSONB(), nullable=False),
        sa.Column("baseline", postgresql.JSONB(), nullable=False),
        sa.Column("start_weight_kg", sa.Numeric(), nullable=False),
        sa.Column("target_weight_kg", sa.Numeric(), nullable=True),
        sa.Column("goal_date", sa.Date(), nullable=True),
        sa.Column("weeks", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'archived')", name="ck_nutrition_plans_status"
        ),
        sa.CheckConstraint(
            "reason IN ('initial', 'review', 'change', 'maintenance_transition')",
            name="ck_nutrition_plans_reason",
        ),
        sa.CheckConstraint(
            "goal IN ('lose_fat', 'recomp', 'build_muscle', 'maintain')",
            name="ck_nutrition_plans_goal",
        ),
    )
    op.create_index("ix_nutrition_plans_user_id", "nutrition_plans", ["user_id"])
    op.create_index("ix_nutrition_plans_goal_id", "nutrition_plans", ["goal_id"])
    op.create_index(
        "uq_nutrition_plans_one_active_per_user",
        "nutrition_plans",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )


def downgrade() -> None:
    op.drop_table("nutrition_plans")
    op.drop_table("nutrition_goals")
    op.drop_column("users", "timezone")
    op.drop_constraint("ck_users_targets_mode", "users", type_="check")
    op.drop_column("users", "targets_mode")
