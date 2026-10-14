"""Search over the food database, for picking a food to log."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models.food import Food
from app.utils.naming import normalize_name

DEFAULT_LIMIT = 20


def search_foods(db: Session, query: str, *, limit: int = DEFAULT_LIMIT) -> list[Food]:
    """Foods whose name contains `query` or closely resembles it, best match first.

    Matching runs on `name_normalized`, so "Crème" finds "creme" and punctuation is ignored.
    Both conditions are served by the trigram index on that column, so this stays fast as
    farming grows the table. Only foods with all four core values are returned — a food
    without calories or a macro cannot be logged meaningfully.
    """
    # normalize_name leaves only letters, digits and spaces, so the LIKE patterns below need
    # no escaping.
    q = normalize_name(query)
    if not q:
        return []

    similarity = func.similarity(Food.name_normalized, q)
    statement = (
        select(Food)
        .where(or_(Food.name_normalized.like(f"%{q}%"), Food.name_normalized.op("%")(q)))
        .where(
            Food.calories_per_100g.is_not(None),
            Food.protein_per_100g.is_not(None),
            Food.carbs_per_100g.is_not(None),
            Food.fat_per_100g.is_not(None),
        )
        .order_by(
            (Food.name_normalized == q).desc(),
            Food.name_normalized.like(f"{q}%").desc(),
            similarity.desc(),
            func.length(Food.name),
            Food.id,
        )
        .limit(limit)
    )
    return list(db.execute(statement).scalars())
