"""Food database routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/foods", tags=["Foods"])


@router.get(
    "",
    summary="Foods (not implemented)",
    description="Placeholder for the future food search and lookup endpoints. Not implemented yet.",
    responses={501: {"description": "Not implemented yet."}},
)
def foods_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Foods is not implemented yet.")
