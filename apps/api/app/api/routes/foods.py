"""Food database routes: search, and one food's full nutrition. See docs/api.md."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.food import FoodDetail, FoodSearchResult, Per100g
from app.services.food_details import get_food_detail
from app.services.food_index import FoodIndex, get_food_index
from app.services.food_search import DEFAULT_LIMIT, search_foods

router = APIRouter(prefix="/foods", tags=["Foods"])


@router.get(
    "",
    response_model=list[FoodSearchResult],
    summary="Search foods",
    description=(
        "Foods whose name matches the query, best match first. Built for search as you type: "
        "a partial last word matches ('alm' finds almonds), small typos are forgiven "
        "('chiken'), case and accents are ignored, and English and Romanian names find each "
        "other ('chicken' finds 'piept de pui'). Only foods with calories, protein, carbs and "
        "fat are returned; values are per 100g."
    ),
)
def search(
    q: str = Query(min_length=1, max_length=100, description="Text to search for, e.g. 'milk'."),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=50, description="Maximum number of results."),
    db: Session = Depends(get_db),
    index: FoodIndex | None = Depends(get_food_index),
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
        for food in search_foods(db, q, limit=limit, index=index)
    ]


# `:int` keeps non-numeric paths (the removed /foods/scrape) a 404 rather than a 422.
@router.get(
    "/{food_id:int}",
    response_model=FoodDetail,
    summary="Get a food's full nutrition",
    description=(
        "One food with everything known about it, per 100g: calories and macros, then fibre, "
        "sugars, fats and fatty acids, amino acids, vitamins, minerals and other compounds. Each "
        "nutrient states its unit (g, mg or ug). Nutrients without data for this food are left "
        "out, so a food known only from its nutrition label returns just those values."
    ),
    responses={404: {"description": "No food with this id."}},
)
def get_food(food_id: int, db: Session = Depends(get_db)) -> FoodDetail:
    detail = get_food_detail(db, food_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"food {food_id} does not exist")
    return detail
