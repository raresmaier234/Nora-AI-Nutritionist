"""Food database routes: recipe scraping. See docs/api.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/foods", tags=["Foods"])

from app.services import scrapper  # noqa: E402,F401  (registers routes on import)
