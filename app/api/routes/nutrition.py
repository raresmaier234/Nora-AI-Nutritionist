"""Nutrition summary / AI estimation routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/nutrition", tags=["Nutrition"])


@router.get(
    "",
    summary="Nutrition (not implemented)",
    description=(
        "Placeholder for the future daily nutrition summary and AI food photo "
        "recognition/estimation endpoints. Not implemented yet."
    ),
    responses={501: {"description": "Not implemented yet."}},
)
def nutrition_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Nutrition is not implemented yet.")
