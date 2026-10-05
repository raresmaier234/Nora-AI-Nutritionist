"""The HTML source: fetch a page on a listed site and let the model read it."""

from __future__ import annotations

import logging

from app.services.ingest.extractor import OllamaExtractor, nutrition_panel
from app.services.ingest.normalizer import PER_100G
from app.services.ingest.sites import SiteList
from app.services.ingest.sources.base import NEEDS_EXTRACTION
from app.services.ingest.sources.readers import READERS
from app.services.scraping.errors import UnsafeURLError
from app.services.scraping.robots import RobotsCache

logger = logging.getLogger(__name__)


class HtmlSource:
    """Fetches a page through the robots gate and extracts foods from it.

    Refuses any URL not owned by a site in `sites`, so a job left in the queue from before
    a site was removed fails instead of being fetched.
    """

    name = "html"
    kind = NEEDS_EXTRACTION

    def __init__(
        self,
        *,
        sites: SiteList,
        robots: RobotsCache,
        extractor: OllamaExtractor | None = None,
    ) -> None:
        sites.require_enforced_by(robots.allowed_hosts)
        unknown = {site.reader for site in sites.sites if site.reader} - READERS.keys()
        if unknown:
            raise ValueError(f"unknown reader {sorted(unknown)}; known: {sorted(READERS)}")
        self._sites = sites
        self._robots = robots
        self._extractor = extractor or OllamaExtractor()

    def load(self, url: str) -> list[dict]:
        site = self._sites.site_for(url)
        if site is None:
            raise UnsafeURLError(f"{url} is not on the site list")

        html = self._robots.fetch(url)

        skip = next((marker for marker in site.skip_pages_containing if marker in html), None)
        if skip is not None:
            logger.info("skipping %s: page contains %r", url, skip)
            return []

        if site.reader is not None:
            # Structured data the site labelled itself: no model, nothing to invent.
            return READERS[site.reader](html)

        panel = nutrition_panel(html)
        if panel is None:
            # Category and article pages land here. The model is never shown them: with no
            # table to copy from, it invents one.
            logger.info("no nutrition panel on %s; skipped", url)
            return []

        foods = self._extractor.extract(panel).foods

        if site.always_per_100g:
            foods = [_always_per_100g(food) for food in foods]
        return foods


def _always_per_100g(food: dict) -> dict:
    """Overrule the model's basis on a site whose pages are all per 100g.

    Such pages never say "per 100g", so the model has to guess, and it guesses per-serving —
    once inventing a 50g serving from "50 kcal", which doubled every value. On these sites
    the operator's knowledge beats the model's guess, so any serving it reported is dropped.
    """
    return {**food, "basis": PER_100G, "serving_grams": None}
