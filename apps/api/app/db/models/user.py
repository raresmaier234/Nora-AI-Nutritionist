"""User model: one person using Nora, as Nora knows them.

Sign-in itself lives in Supabase Auth: its `auth.users` holds the person's Google and Apple
identities and sessions, in Supabase's own database. This row holds everything else — their
name, plan and daily targets — and owns their food log and nutrition plans. Its `id` is the
Supabase user id (the access token's `sub`); there is no foreign key, since the two are in
different databases. The row is created the first time the API sees a valid token for that
id (see `app/services/users.py`).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Numeric, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

PLANS = ("basic", "premium")
# Where the daily targets come from: `default` (basic, or no plan yet), `plan` (copied from the
# active nutrition plan), `none` (a safety gate stopped the plan: log without targets).
TARGETS_MODES = ("default", "plan", "none")


class User(Base):
    __tablename__ = "users"

    # Supabase's id for the person, never generated here.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)

    # From the token; may be an Apple private relay address. Not unique: Supabase owns
    # identity, and one person can have two Supabase users (Apple relay, then Google).
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped[str] = mapped_column(Text, nullable=False, server_default="basic")
    # Reserved for subscriptions; null means the plan does not expire.
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Daily targets.
    kcal_target: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="2000")
    protein_target_g: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="150")
    carbs_target_g: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="220")
    fat_target_g: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="70")
    fiber_target_g: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="28")
    # Which targets apply (TARGETS_MODES). The columns above only count in `plan` mode;
    # otherwise the defaults are shown, or none at all (see app/services/users.py, to_read).
    targets_mode: Mapped[str] = mapped_column(Text, nullable=False, server_default="default")

    # The user's IANA time zone ("Europe/Bucharest"), sent by the app; null means UTC.
    timezone: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    # Last request from this user, to the hour: it is only written when an hour old.
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("plan IN ('basic', 'premium')", name="ck_users_plan"),
        CheckConstraint(
            "targets_mode IN ('default', 'plan', 'none')", name="ck_users_targets_mode"
        ),
    )
