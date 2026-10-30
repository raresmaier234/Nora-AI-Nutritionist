"""The signed-in user's own profile and account. See docs/api.md."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.db.session import get_db
from app.schemas.user import UserRead, UserUpdate
from app.services import users
from app.services.auth import AUTH_RESPONSES, get_current_user
from app.services.supabase_admin import SupabaseAdmin, SupabaseAdminError, get_supabase_admin

router = APIRouter(prefix="/users", tags=["Users"], responses=AUTH_RESPONSES)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get my profile",
    description=(
        "The signed-in user's profile: name, email, avatar, plan and daily targets. There is "
        "no sign-up step: the first request with a new user's access token creates their "
        "profile from the token (name and avatar from their Google or Apple account), on the "
        "`basic` plan with default targets."
    ),
)
def get_me(user: User = Depends(get_current_user)) -> UserRead:
    return users.to_read(user)


@router.patch(
    "/me",
    response_model=UserRead,
    summary="Change my profile",
    description=(
        "Change the display name and/or any of the daily targets; anything not sent is kept. "
        "Targets: `kcal` 500–10000, `protein_g`, `carbs_g` and `fat_g` 0–1000, `fiber_g` "
        "0–200. Returns the updated profile."
    ),
)
def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    return users.to_read(users.update_profile(db, user, data))


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete my account",
    description=(
        "Delete the signed-in user's account and everything in it: their Supabase sign-in "
        "first, then their profile and whole food log. If Supabase doesn't confirm, nothing "
        "is deleted and the answer is 502, so the app can say so and let the user retry. The "
        "app should sign out straight after a 204."
    ),
    responses={
        502: {"description": "Supabase did not delete the sign-in account; nothing was deleted."},
        503: {"description": "Account deletion (or sign-in) is not configured on this server."},
    },
)
def delete_me(
    user: User = Depends(get_current_user),
    supabase: SupabaseAdmin | None = Depends(get_supabase_admin),
    db: Session = Depends(get_db),
) -> Response:
    if supabase is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not configured on this server.",
        )
    try:
        users.delete_account(db, user, supabase)
    except SupabaseAdminError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Could not delete the sign-in account at Supabase, so nothing was deleted. "
            "Try again.",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
