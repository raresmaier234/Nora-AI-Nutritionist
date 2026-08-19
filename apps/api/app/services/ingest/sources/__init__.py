"""Food sources: where URLs come from, and how one becomes raw food records."""

from app.services.ingest.sources.base import (
    NEEDS_EXTRACTION,
    STRUCTURED,
    Discovered,
    FoodSource,
)
from app.services.ingest.sources.eatthismuch import EatThisMuchSource
from app.services.ingest.sources.html import HtmlSource

SOURCES: dict[str, type] = {
    HtmlSource.name: HtmlSource,
    EatThisMuchSource.name: EatThisMuchSource,
}


def get_source(name: str, **kwargs) -> FoodSource:
    """Build a source by name."""
    try:
        source_class = SOURCES[name]
    except KeyError:
        raise KeyError(f"unknown source {name!r}; known: {sorted(SOURCES)}") from None
    return source_class(**kwargs)


__all__ = [
    "NEEDS_EXTRACTION",
    "SOURCES",
    "STRUCTURED",
    "Discovered",
    "EatThisMuchSource",
    "FoodSource",
    "HtmlSource",
    "get_source",
]
