"""Request and response shapes for the signed-in user's profile (`/api/v1/users/me`)."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Plan = Literal["basic", "premium"]

DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class Targets(BaseModel):
    """Daily targets: calories, and grams of each macro and of fibre."""

    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float


class TargetsUpdate(BaseModel):
    """Any subset of the daily targets. Omitted targets are kept."""

    model_config = ConfigDict(extra="forbid")

    kcal: float | None = Field(default=None, ge=500, le=10_000)
    protein_g: float | None = Field(default=None, ge=0, le=1000)
    carbs_g: float | None = Field(default=None, ge=0, le=1000)
    fat_g: float | None = Field(default=None, ge=0, le=1000)
    fiber_g: float | None = Field(default=None, ge=0, le=200)


class UserUpdate(BaseModel):
    """Change the display name and/or daily targets. Omitted fields are kept."""

    # A misspelt field is an error rather than a request that silently changes nothing.
    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName | None = None
    targets: TargetsUpdate | None = None


class UserRead(BaseModel):
    """The signed-in user's profile."""

    id: uuid.UUID = Field(description="The Supabase user id.")
    email: str | None
    display_name: str | None
    avatar_url: str | None
    plan: Plan = Field(description="`premium` only while `plan_expires_at` is unset or ahead.")
    plan_expires_at: datetime | None
    targets: Targets
