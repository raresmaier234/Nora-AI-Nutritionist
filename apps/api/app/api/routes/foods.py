"""Food database routes: search. See docs/api.md."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.food import FoodSearchResult, Per100g
from app.services.food_search import DEFAULT_LIMIT, search_foods

router = APIRouter(prefix="/foods", tags=["Foods"])


@router.get(
    "",
    response_model=list[FoodSearchResult],
    summary="Search foods",
    description=(
        "Foods whose name contains the query or closely resembles it, best match first. "
        "Case, accents and punctuation are ignored. Only foods with calories, protein, carbs "
        "and fat are returned; values are per 100g."
    ),
)
def search(
    q: str = Query(min_length=1, max_length=100, description="Text to search for, e.g. 'milk'."),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=50, description="Maximum number of results."),
    db: Session = Depends(get_db),
) -> list[FoodSearchResult]:
    return [
        FoodSearchResult(
            id=food.id,
            name=food.name,
            per_100g=Per100g(
                kcal=float(food.calories_per_100g),
                protein=float(food.protein_per_100g),
                carbs=float(food.carbs_per_100g),
                fat=float(food.fat_per_100g),
            ),
        )
        for food in search_foods(db, q, limit=limit)
    ]
