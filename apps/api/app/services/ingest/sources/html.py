"""The generic HTML source: fetch a page, let the model read it.

Works for any URL, and is what the manual `seed urls.txt` workflow uses.
"""

from __future__ import annotations

from collections.abc import Iterator

import httpx

from app.services.ingest.extractor import OllamaExtractor, html_to_text
from app.services.ingest.sources.base import NEEDS_EXTRACTION, Discovered
from app.services.scraping import fetch_html
from app.services.scraping.robots import RobotsCache


class HtmlSource:
    """Fetches a page and extracts foods from it. Discovers nothing on its own."""

    name = "html"
    kind = NEEDS_EXTRACTION

    def __init__(
        self,
        *,
        extractor: OllamaExtractor | None = None,
        robots: RobotsCache | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._extractor = extractor or OllamaExtractor()
        self._robots = robots
        self._client = client

    def discover(self, *, limit: int | None = None) -> Iterator[Discovered]:
        """Nothing to discover — URLs for this source are seeded by hand."""
        return iter(())

    def _fetch(self, url: str) -> str:
        if self._robots is not None:
            # Goes through the robots gate and the per-host delay clock.
            return self._robots.fetch(url)
        return fetch_html(url, client=self._client)

    def load(self, url: str) -> list[dict]:
        return self._extractor.extract(html_to_text(self._fetch(url))).foods
