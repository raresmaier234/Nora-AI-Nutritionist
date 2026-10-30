# SQLAlchemy models are registered here so Alembic's autogenerate can see them.
from app.db.models.food import Food  # noqa: F401
from app.db.models.food_log_entry import FoodLogEntry  # noqa: F401
from app.db.models.ingest_job import IngestJob  # noqa: F401
from app.db.models.recipe import Recipe  # noqa: F401
from app.db.models.recipe_ingredient import RecipeIngredient  # noqa: F401
from app.db.models.user import User  # noqa: F401
