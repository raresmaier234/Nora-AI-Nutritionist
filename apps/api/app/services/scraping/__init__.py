"""Generic web scraping: safe fetching, JSON-LD extraction, robots and sitemaps.

Self-contained by design: nothing here imports from the rest of `app`, so the package
can be lifted into another project as-is.
"""

from app.services.scraping.errors import (
    FetchError,
    ParseError,
    RobotsDisallowedError,
    ScrapeError,
    UnsafeURLError,
)
from app.services.scraping.fetcher import (
    HTML_CONTENT_TYPES,
    TEXT_CONTENT_TYPES,
    XML_CONTENT_TYPES,
    fetch_document,
    fetch_html,
)
from app.services.scraping.jsonld import extract_json_ld, find_by_type, iter_json_ld_nodes
from app.services.scraping.scraper import JsonLdScraper, Normalizer, json_ld_scraper
from app.services.scraping.ssrf import SafeRequestTarget, resolve_safe_target

__all__ = [
    "HTML_CONTENT_TYPES",
    "TEXT_CONTENT_TYPES",
    "XML_CONTENT_TYPES",
    "FetchError",
    "JsonLdScraper",
    "Normalizer",
    "ParseError",
    "RobotsDisallowedError",
    "SafeRequestTarget",
    "ScrapeError",
    "UnsafeURLError",
    "extract_json_ld",
    "fetch_document",
    "fetch_html",
    "find_by_type",
    "iter_json_ld_nodes",
    "json_ld_scraper",
    "resolve_safe_target",
]
