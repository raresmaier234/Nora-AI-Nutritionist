"""EatThisMuch: ~863k food pages, discovered through its sitemaps.

The site publishes `User-agent: ClaudeBot / Allow: / Crawl-delay: 2` — one of the few
that explicitly welcomes a bulk crawler rather than banning one.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterator, Sequence
from urllib.parse import urlsplit

from app.services.ingest.sources.base import Discovered
from app.services.ingest.sources.html import HtmlSource
from app.services.scraping.fetcher import XML_CONTENT_TYPES
from app.services.scraping.sitemap import walk_sitemaps

logger = logging.getLogger(__name__)

# Maps /sitemap-branded-foods-ac-3.xml -> "branded-foods-ac", /sitemap.xml -> no match.
_FAMILY_RE = re.compile(r"^/sitemap-(?P<family>[a-z-]+?)(?:-\d+)?\.xml$", re.IGNORECASE)


class EatThisMuchSource(HtmlSource):
    name = "eatthismuch"

    HOST = "www.eatthismuch.com"
    BASE_URL = "https://www.eatthismuch.com/"
    FOOD_PATH_PREFIX = "/calories/"

    # recipes: every one of its ~7,230 leaves 404s, so descending costs hours of nothing.
    # quantities: query-param restatements of foods we already have, e.g.
    #   /calories/butter-1?a=0.33309859154929583%3A5
    # Ingesting those re-extracts stored foods and counts as "enriched", so the waste is
    # both expensive and invisible in the run stats.
    SKIP_FAMILIES = frozenset({"recipes", "quantities"})

    FAMILY_GROUPS: dict[str, tuple[str, ...]] = {
        "basic": ("basic-foods",),
        "restaurant": ("restaurant-foods",),
        "branded": (
            "branded-foods-ac",
            "branded-foods-df",
            "branded-foods-gi",
            "branded-foods-jl",
            "branded-foods-mo",
            "branded-foods-pr",
            "branded-foods-su",
            "branded-foods-vz",
        ),
    }

    DEFAULT_FAMILIES = ("basic", "restaurant")

    def discover(
        self,
        *,
        families: Sequence[str] | None = None,
        limit: int | None = None,
    ) -> Iterator[Discovered]:
        if self._robots is None:
            raise ValueError("EatThisMuchSource needs a RobotsCache to discover")

        wanted = self._wanted_families(families)
        policy = self._robots.policy_for(self.BASE_URL)

        # Seeds come from robots.txt, never from /sitemap.xml. The root sitemap lists only
        # sitemap-diets and sitemap-static — following it finds ZERO food URLs. This is the
        # single most expensive thing about this site to rediscover.
        seeds = [url for url in policy.sitemaps if self._is_wanted_sitemap(url, wanted)]
        if not seeds:
            logger.warning("no usable sitemaps declared in robots.txt for %s", self.HOST)
            return

        logger.info("discovering from %d sitemaps: %s", len(seeds), ", ".join(seeds))

        yielded = 0
        for entry in walk_sitemaps(
            seeds,
            # Sitemaps are served as application/xml; the default accepts HTML only.
            fetch=lambda url: self._robots.fetch(url, content_types=XML_CONTENT_TYPES),
            follow=lambda url: self._is_wanted_sitemap(url, wanted),
        ):
            if not self.accepts(entry.loc):
                continue

            yield Discovered(
                url=entry.loc, lastmod=entry.lastmod, discovered_from=entry.found_in
            )

            yielded += 1
            if limit is not None and yielded >= limit:
                return

    def _wanted_families(self, families: Sequence[str] | None) -> frozenset[str]:
        groups = families or self.DEFAULT_FAMILIES
        wanted: set[str] = set()
        for group in groups:
            if group not in self.FAMILY_GROUPS:
                raise ValueError(
                    f"unknown family {group!r}; choose from {sorted(self.FAMILY_GROUPS)}"
                )
            wanted.update(self.FAMILY_GROUPS[group])
        return frozenset(wanted)

    def _is_wanted_sitemap(self, url: str, wanted: frozenset[str]) -> bool:
        parts = urlsplit(url)
        if parts.hostname != self.HOST:
            return False

        match = _FAMILY_RE.match(parts.path)
        if match is None:
            return False  # /sitemap.xml itself — the decoy root

        family = match.group("family").lower()
        if family in self.SKIP_FAMILIES:
            return False
        return family in wanted

    def accepts(self, loc: str) -> bool:
        """Whether a sitemap entry is a food page worth ingesting."""
        parts = urlsplit(loc)
        return (
            parts.scheme in ("http", "https")
            # A <loc> may hold any URL. The SSRF guard blocks private addresses but will
            # happily fetch an arbitrary public third party, so without this check anyone
            # able to influence the sitemap could aim a 100k-request crawler at a target
            # of their choosing.
            and parts.hostname == self.HOST
            and parts.path.startswith(self.FOOD_PATH_PREFIX)
            and len(parts.path) > len(self.FOOD_PATH_PREFIX)
            # Catches any quantities-style duplicate that leaks past the family skip.
            and not parts.query
            and not parts.fragment
        )
