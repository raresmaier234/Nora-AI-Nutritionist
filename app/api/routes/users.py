"""User profile routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    summary="Users (not implemented)",
    description=(
        "Placeholder for the future user profile endpoints (goals, preferences, account "
        "details). Not implemented yet."
    ),
    responses={501: {"description": "Not implemented yet."}},
)
def users_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Users is not implemented yet.")
