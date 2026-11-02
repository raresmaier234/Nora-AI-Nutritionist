"""Request and response shapes for the signed-in user's profile (`/api/v1/users/me`)."""

import uuid
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Literal
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Plan = Literal["basic", "premium"]
TargetsMode = Literal["default", "plan", "none"]

DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


@lru_cache
def time_zones() -> frozenset[str]:
    """Every IANA time zone name this machine knows, spelt exactly (no case folding: a
    case-insensitive disk would otherwise accept "europe/bucharest" here and not elsewhere)."""
    return frozenset(available_timezones())


class Targets(BaseModel):
    """Daily targets: calories, and grams of each macro and of fibre."""

    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float


class UserUpdate(BaseModel):
    """Change the display name and/or time zone. Omitted fields are kept.

    Targets can't be set here: they come from the defaults or the active nutrition plan.
    """

    # A misspelt field (or `targets`) is an error rather than a request that silently changes
    # nothing.
    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName | None = None
    timezone: str | None = Field(
        default=None,
        max_length=64,
        description="IANA time zone name, e.g. `Europe/Bucharest`.",
        examples=["Europe/Bucharest"],
    )

    @field_validator("timezone")
    @classmethod
    def _known_time_zone(cls, value: str | None) -> str | None:
        if value is not None and value not in time_zones():
            raise ValueError(f"{value!r} is not an IANA time zone name")
        return value


class UserRead(BaseModel):
    """The signed-in user's profile."""

    id: uuid.UUID = Field(description="The Supabase user id.")
    email: str | None
    display_name: str | None
    avatar_url: str | None
    plan: Plan = Field(description="`premium` only while `plan_expires_at` is unset or ahead.")
    plan_expires_at: datetime | None
    timezone: str | None = Field(description="IANA time zone; null means UTC.")
    targets_mode: TargetsMode = Field(
        description="`default`: the default targets. `plan`: the active nutrition plan's. "
        "`none`: log without targets (a safety gate stopped the plan)."
    )
    targets: Targets | None = Field(description="Null when `targets_mode` is `none`.")
    check_in_due: bool = Field(
        description="Whether this week's check-in is due. Always false until weekly check-ins "
        "exist."
    )
