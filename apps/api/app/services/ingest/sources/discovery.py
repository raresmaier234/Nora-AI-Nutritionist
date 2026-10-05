"""Finding food URLs on a listed site, through the sitemaps it publishes.

Works the same for every site in the sites file; only the site's `paths` and
`skip_sitemaps` differ. Lessons learned on EatThisMuch that apply to any site:

- Seeds come from the `Sitemap:` lines in robots.txt, not from `/sitemap.xml`. A root
  sitemap can be a decoy: EatThisMuch's lists only diets and static pages, and following
  it alone finds zero foods. `/sitemap.xml` is only tried when robots.txt declares nothing.
- Unwanted sitemap families are skipped *before* they are fetched. A family of thousands
  of documents that all 404 otherwise costs hours at the crawl delay.
- A `<loc>` can name any URL on any server, so every entry — and every nested sitemap —
  must be on the site itself. The fetcher enforces the same rule on redirects.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from urllib.parse import urlsplit

from app.services.ingest.sites import Site
from app.services.ingest.sources.base import Discovered
from app.services.scraping.fetcher import XML_CONTENT_TYPES
from app.services.scraping.robots import RobotsCache
from app.services.scraping.sitemap import SITEMAP_MAX_BYTES, walk_sitemaps

logger = logging.getLogger(__name__)


def discover_site(
    site: Site, *, robots: RobotsCache, limit: int | None = None
) -> Iterator[Discovered]:
    """Yield the food page URLs `site`'s sitemaps list, in sitemap order.

    `robots` must be restricted to the listed hosts (`allowed_hosts`), so a redirect from a
    sitemap cannot take the walk off the list.
    """
    if robots.allowed_hosts is None or site.host not in robots.allowed_hosts:
        raise ValueError(
            f"the RobotsCache must be built with allowed_hosts including {site.host}, "
            "or redirects can leave the site list"
        )

    policy = robots.policy_for(site.base_url)

    declared = [url for url in policy.sitemaps if _is_wanted_sitemap(site, url)]
    seeds = declared or [f"{site.base_url}sitemap.xml"]
    if not declared:
        logger.info("%s declares no usable sitemaps in robots.txt; trying %s", site.host, seeds[0])

    logger.info("discovering %s from %d sitemaps", site.host, len(seeds))

    yielded = 0
    for entry in walk_sitemaps(
        seeds,
        # Sitemaps are served as application/xml; the default accepts HTML only.
        fetch=lambda url: robots.fetch(
            url, content_types=XML_CONTENT_TYPES, max_bytes=SITEMAP_MAX_BYTES
        ),
        follow=lambda url: _is_wanted_sitemap(site, url),
    ):
        if not accepts(site, entry.loc):
            continue

        yield Discovered(url=entry.loc, lastmod=entry.lastmod, discovered_from=entry.found_in)

        yielded += 1
        if limit is not None and yielded >= limit:
            return


def accepts(site: Site, loc: str) -> bool:
    """Whether a sitemap entry is a page on `site` worth ingesting."""
    parts = urlsplit(loc)
    return (
        site.owns(loc)
        # The section root itself ("/calories/") is a listing, not a food.
        and parts.path not in site.paths
        # Query strings restate pages already listed without one (EatThisMuch's
        # quantities family: /calories/butter-1?a=0.333...), which re-extracts foods we
        # already have and hides the cost as "enriched" in the run stats.
        and not parts.query
        and not parts.fragment
    )


def _is_wanted_sitemap(site: Site, url: str) -> bool:
    parts = urlsplit(url)
    if (parts.hostname or "") != site.host:
        return False
    path = parts.path.lower()
    return not any(word in path for word in site.skip_sitemaps)
