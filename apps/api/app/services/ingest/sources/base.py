"""The interface every food source implements.

Two kinds of source exist. An HTML source fetches a page and has the LLM read it; a
structured source (a JSON API, a CSV dump) already has typed values and skips the model
entirely.

Both work through one interface because of a decision made in the extractor: every
nutrient is captured as a *verbatim string*, and all arithmetic happens later in
`normalizer`. That means an LLM extraction and an API row have the same shape —
`{"name": ..., "basis": "per_100g", "calories": "372kcal", ...}` — so both flow through
the identical normalize → Atwater → dedup → store path with nothing branching on origin.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

# The page must be read by the model.
NEEDS_EXTRACTION = "html"
# The record already carries values; go straight to normalization.
STRUCTURED = "structured"


@dataclass(frozen=True)
class Discovered:
    """One unit of work a source found.

    `url` is the addressing key — it lands in `ingest_jobs.url`, which is UNIQUE and is
    what makes re-running discovery free. A structured source must therefore address its
    records by a stable URI rather than inlining payloads into the frontier.
    """

    url: str
    lastmod: str | None = None
    discovered_from: str | None = None


@runtime_checkable
class FoodSource(Protocol):
    """Finds work, and turns one unit of it into raw food records."""

    name: str
    kind: str

    def discover(self, *, limit: int | None = None) -> Iterator[Discovered]:
        """Yield URLs to ingest. May be empty for sources that are seeded manually."""
        ...

    def load(self, url: str) -> list[dict]:
        """Return raw food records in the shape `normalize_food()` consumes."""
        ...
