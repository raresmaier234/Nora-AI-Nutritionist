"""Food sources: where URLs come from, and how one becomes raw food records."""

from app.services.ingest.sources.base import (
    NEEDS_EXTRACTION,
    STRUCTURED,
    Discovered,
    FoodSource,
)
from app.services.ingest.sources.discovery import accepts, discover_site
from app.services.ingest.sources.html import HtmlSource

__all__ = [
    "NEEDS_EXTRACTION",
    "STRUCTURED",
    "Discovered",
    "FoodSource",
    "HtmlSource",
    "accepts",
    "discover_site",
]
