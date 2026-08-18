"""Meal / food logging routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/meals", tags=["Meals"])


@router.get(
    "",
    summary="Meals (not implemented)",
    description="Placeholder for the future food logging endpoints (meals, entries). Not implemented yet.",
    responses={501: {"description": "Not implemented yet."}},
)
def meals_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Meals is not implemented yet.")
