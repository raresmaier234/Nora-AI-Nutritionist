"""Barcode lookup routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.services.auth import AUTH_RESPONSES, get_current_user

router = APIRouter(
    prefix="/barcodes",
    tags=["Barcodes"],
    dependencies=[Depends(get_current_user)],
    responses=AUTH_RESPONSES,
)


@router.get(
    "",
    summary="Barcodes (not implemented)",
    description="Placeholder for the future barcode-to-food lookup endpoints. Not implemented yet.",
    responses={501: {"description": "Not implemented yet."}},
)
def barcodes_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Barcodes is not implemented yet.")
