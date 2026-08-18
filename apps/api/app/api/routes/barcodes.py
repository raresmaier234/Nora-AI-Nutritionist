"""Barcode lookup routes — planned, not implemented yet. See docs/api.md."""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/barcodes", tags=["Barcodes"])


@router.get(
    "",
    summary="Barcodes (not implemented)",
    description="Placeholder for the future barcode-to-food lookup endpoints. Not implemented yet.",
    responses={501: {"description": "Not implemented yet."}},
)
def barcodes_placeholder() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Barcodes is not implemented yet.")
