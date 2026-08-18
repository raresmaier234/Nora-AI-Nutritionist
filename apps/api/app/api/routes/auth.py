"""Authentication routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "",
    summary="Authentication (not implemented)",
    description=(
        "Placeholder for the future authentication endpoints (sign up, log in, token "
        "issuance/refresh). Not implemented yet."
    ),
    responses={501: {"description": "Not implemented yet."}},
)
def auth_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Auth is not implemented yet.")
