"""NutritionPlan model: the daily targets the algorithm built from a goal, and why.

A plan starts as a `draft` (what the review screen shows). Activating it makes it the user's
one `active` plan and copies its targets to the user's daily targets; the plan it replaces is
`archived`. At most one plan per user is active (a partial unique index).

The numbers are fixed when the plan is built: `targets` are the rounded daily targets, and
`baseline` keeps the unrounded working (BMR, TDEE, protein weight, rates, the rules that
applied) for the weekly reviews to come. Texts are not stored: they are rendered from the
pattern library when the plan is read, in the plan's `language`.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

PLAN_STATUSES = ("draft", "active", "archived")
PLAN_REASONS = ("initial", "review", "change", "maintenance_transition")


class NutritionPlan(Base):
    __tablename__ = "nutrition_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    goal_id: Mapped[int] = mapped_column(
        ForeignKey("nutrition_goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="draft")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # The plan that was active when this one was built (a change or a review update).
    previous_plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("nutrition_plans.id", ondelete="SET NULL"), nullable=True
    )

    goal: Mapped[str] = mapped_column(Text, nullable=False)
    # gentle, steady, faster or custom; null for Maintain.
    pace: Mapped[str | None] = mapped_column(Text, nullable=True)
    # goal.pace band.training.phase: which texts of the pattern library the plan uses.
    pattern_key: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False)

    # {"kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"}, rounded for display.
    targets: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # {"requested_kg_week", "effective_kg_week", "clamped"}: the pace asked for, and the one
    # the calories allow once the safety limits apply. The goal date comes from the latter.
    rate: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # [{"code", "params"}]: rendered into messages when read.
    notices: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    # The unrounded working: BMR, TDEE, protein weight, rates, rules applied, inputs.
    baseline: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    start_weight_kg: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    target_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    # When the target is reached at the effective pace (or the end of a 16-week muscle-building
    # block with no target); null for Maintain, or when no deficit is possible.
    goal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weeks: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'active', 'archived')", name="ck_nutrition_plans_status"
        ),
        CheckConstraint(
            "reason IN ('initial', 'review', 'change', 'maintenance_transition')",
            name="ck_nutrition_plans_reason",
        ),
        CheckConstraint(
            "goal IN ('lose_fat', 'recomp', 'build_muscle', 'maintain')",
            name="ck_nutrition_plans_goal",
        ),
        # A user has at most one active plan.
        Index(
            "uq_nutrition_plans_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )
