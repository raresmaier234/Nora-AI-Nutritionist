"""Barcode lookup: a scanned product's food, from the barcodes stored with each food. See docs/api.md."""

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.food import FoodDetail
from app.services.auth import AUTH_RESPONSES, get_current_user
from app.services.food_details import find_by_barcode

router = APIRouter(
    prefix="/barcodes",
    tags=["Barcodes"],
    dependencies=[Depends(get_current_user)],
    responses=AUTH_RESPONSES,
)


@router.get(
    "/{code}",
    response_model=FoodDetail,
    summary="Look up a barcode",
    description=(
        "The food a scanned barcode belongs to, with its full nutrition, units and package "
        "serving — the same as GET /foods/{id}. A 12-digit UPC and the 13-digit EAN with a "
        "leading 0 find the same product. Only foods that can be logged (calories, protein, "
        "carbs and fat known) are returned."
    ),
    responses={404: {"description": "No loggable food has this barcode."}},
)
def lookup_barcode(
    code: str = Path(pattern=r"^\d{8,14}$", description="The barcode's digits (EAN-8, UPC-A, EAN-13, GTIN-14)."),
    db: Session = Depends(get_db),
) -> FoodDetail:
    detail = find_by_barcode(db, code)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"no food with barcode {code}")
    return detail
