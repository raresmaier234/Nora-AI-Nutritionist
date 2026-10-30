"""Users: the row behind each signed-in person, their profile and plan, and deleting them.

How a `users` row relates to Supabase's own user record is explained in
`app/db/models/user.py`; how a request becomes a user, in `app/services/auth.py`.
"""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models.food_log_entry import FoodLogEntry
from app.db.models.user import PLANS, User
from app.schemas.user import Targets, UserRead, UserUpdate
from app.services.supabase_admin import SupabaseAdmin

# `last_seen_at` is kept to the hour, so most requests don't write to the database at all.
LAST_SEEN_RESOLUTION = timedelta(hours=1)


class UserLookupError(LookupError):
    """No user, or more than one, has the email given to a script."""


def _text(value: Any) -> str | None:
    """A claim's text, or None when it is missing, blank or not text."""
    if not isinstance(value, str):
        return None
    return value.strip() or None


def get_or_create(db: Session, claims: dict[str, Any]) -> User:
    """The user a verified access token belongs to, created the first time they are seen.

    A new row takes its email, name and avatar from the token. After that the email follows
    the token, and a name or avatar the row lacks is filled in from it: Apple sends the name
    only once, and the app saves it to Supabase after the first token was issued. A name
    the user set is never overwritten. Writes only when something changed or `last_seen_at`
    is over an hour old.
    """
    user_id = uuid.UUID(claims["sub"])
    email = _text(claims.get("email"))
    metadata = claims.get("user_metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    name = _text(metadata.get("full_name")) or _text(metadata.get("name"))
    avatar = _text(metadata.get("avatar_url")) or _text(metadata.get("picture"))

    user = db.get(User, user_id)
    if user is None:
        # The app's first requests arrive together (profile and the day's log), so two may
        # both find no row. ON CONFLICT lets the slower one use the faster one's row.
        db.execute(
            insert(User)
            .values(id=user_id, email=email, display_name=name, avatar_url=avatar)
            .on_conflict_do_nothing(index_elements=[User.id])
        )
        db.commit()
        return db.get_one(User, user_id)

    changed = False
    if email is not None and user.email != email:
        user.email = email
        changed = True
    if user.display_name is None and name is not None:
        user.display_name = name
        changed = True
    if user.avatar_url is None and avatar is not None:
        user.avatar_url = avatar
        changed = True
    now = datetime.now(UTC)
    if changed or now - user.last_seen_at >= LAST_SEEN_RESOLUTION:
        user.last_seen_at = now
        db.commit()
    return user


def current_plan(user: User) -> str:
    """The plan in force: a plan whose `plan_expires_at` has passed is basic."""
    if user.plan_expires_at is not None and user.plan_expires_at <= datetime.now(UTC):
        return "basic"
    return user.plan


def has_plan(user: User, plan: str) -> bool:
    """Whether the user's plan is `plan` or a higher one (PLANS is in order)."""
    return PLANS.index(current_plan(user)) >= PLANS.index(plan)


def _decimal(value: float) -> Decimal:
    # Via str, so 0.1 is stored as 0.1 and not as 0.1000000000000000055511151231257827.
    return Decimal(str(value))


def update_profile(db: Session, user: User, data: UserUpdate) -> User:
    """Change the display name and/or any of the daily targets; anything not sent is kept."""
    if data.display_name is not None:
        user.display_name = data.display_name
    targets = data.targets
    if targets is not None:
        if targets.kcal is not None:
            user.kcal_target = _decimal(targets.kcal)
        if targets.protein_g is not None:
            user.protein_target_g = _decimal(targets.protein_g)
        if targets.carbs_g is not None:
            user.carbs_target_g = _decimal(targets.carbs_g)
        if targets.fat_g is not None:
            user.fat_target_g = _decimal(targets.fat_g)
        if targets.fiber_g is not None:
            user.fiber_target_g = _decimal(targets.fiber_g)
    db.commit()
    db.refresh(user)
    return user


def delete_account(db: Session, user: User, supabase: SupabaseAdmin) -> None:
    """Delete the user everywhere: their Supabase user first, then their row and food log.

    In that order so a failure never leaves someone who can still sign in to an account
    that looks freshly emptied. Raises `SupabaseAdminError`, having deleted nothing, if
    Supabase doesn't confirm.
    """
    supabase.delete_user(user.id)
    db.delete(user)  # the food log goes with it (ON DELETE CASCADE)
    db.commit()


def find_by_email(db: Session, email: str) -> User:
    """The one user with this email, ignoring case. For the admin scripts."""
    matches = list(
        db.execute(select(User).where(func.lower(User.email) == email.strip().lower())).scalars()
    )
    if not matches:
        raise UserLookupError(f"no user has the email {email!r}; sign in to the app first")
    if len(matches) > 1:
        ids = ", ".join(str(user.id) for user in matches)
        raise UserLookupError(f"{len(matches)} users have the email {email!r} ({ids})")
    return matches[0]


def claim_unowned_entries(db: Session, user: User) -> int:
    """Give every food log entry without a user to `user`. Returns how many there were.

    For the shared log from before accounts existed (scripts/claim_shared_log.py).
    """
    result = db.execute(
        update(FoodLogEntry).where(FoodLogEntry.user_id.is_(None)).values(user_id=user.id)
    )
    db.commit()
    return result.rowcount


def set_plan(db: Session, user: User, plan: str) -> None:
    """Put the user on `plan` with no expiry (scripts/set_plan.py, until payments exist)."""
    if plan not in PLANS:
        raise ValueError(f"unknown plan {plan!r}; expected one of {PLANS}")
    user.plan = plan
    user.plan_expires_at = None
    db.commit()


def to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        plan=current_plan(user),
        plan_expires_at=user.plan_expires_at,
        targets=Targets(
            kcal=float(user.kcal_target),
            protein_g=float(user.protein_target_g),
            carbs_g=float(user.carbs_target_g),
            fat_g=float(user.fat_target_g),
            fiber_g=float(user.fiber_target_g),
        ),
    )
