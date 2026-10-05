"""Parsing and walking of XML sitemaps.

Fields are pulled out with targeted regexes rather than an XML parser. That is a
deliberate choice for this format:

- Sitemaps set a default namespace (`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`),
  so `ElementTree.findall("url/loc")` silently returns nothing — a bug that produces zero
  URLs and no error.
- Entity-expansion attacks are structurally impossible here rather than merely mitigated;
  the transport byte cap does not help, because expansion happens inside the parser.
- Real sitemaps serve HTML error bodies and truncated documents. Regex extraction returns
  what it found instead of raising, which matters across a walk of ~180 documents.

We need exactly two fields from a machine-generated, flat format. The usual objection to
parsing XML this way is about preserving document semantics, which we are not doing.
"""

from __future__ import annotations

import html
import logging
import re
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass, replace

from app.services.scraping.errors import ParseError, ScrapeError

logger = logging.getLogger(__name__)

SITEMAP_INDEX = "sitemapindex"
URL_SET = "urlset"

DEFAULT_MAX_DEPTH = 3
# The sitemaps.org limit for one uncompressed file (50,000 URLs). Page-sized caps are far
# too small: freshful.ro's product sitemap alone is over 5 MB.
SITEMAP_MAX_BYTES = 50 * 1024 * 1024
DEFAULT_MAX_DOCUMENTS = 500

# Tag names may carry a namespace prefix (`<sm:loc>`), so allow one.
_TAG = r"(?:[A-Za-z0-9_.-]+:)?"

_ROOT_INDEX_RE = re.compile(rf"<{_TAG}sitemapindex[\s>]", re.IGNORECASE)
_ROOT_URLSET_RE = re.compile(rf"<{_TAG}urlset[\s>]", re.IGNORECASE)

# One <url> or <sitemap> block. Parsing per block keeps loc and lastmod together; running
# two independent findalls and zipping them misaligns every later pair as soon as one
# block omits its lastmod, which silently corrupts the incremental-recrawl key.
_BLOCK_RE = re.compile(
    rf"<{_TAG}(?:url|sitemap)\b[^>]*>(.*?)</{_TAG}(?:url|sitemap)\s*>",
    re.IGNORECASE | re.DOTALL,
)
_LOC_RE = re.compile(rf"<{_TAG}loc\s*>(.*?)</{_TAG}loc\s*>", re.IGNORECASE | re.DOTALL)
_LASTMOD_RE = re.compile(
    rf"<{_TAG}lastmod\s*>(.*?)</{_TAG}lastmod\s*>", re.IGNORECASE | re.DOTALL
)

_CDATA_RE = re.compile(r"^\s*<!\[CDATA\[(.*?)]]>\s*$", re.DOTALL)


@dataclass(frozen=True)
class SitemapEntry:
    """One `<loc>` from a sitemap, with the document it was found in."""

    loc: str
    lastmod: str | None = None
    found_in: str | None = None


@dataclass(frozen=True)
class Sitemap:
    kind: str  # SITEMAP_INDEX or URL_SET
    entries: tuple[SitemapEntry, ...]


def _clean(value: str) -> str:
    """Unwrap CDATA and resolve entity references (`&amp;` in a URL is common)."""
    match = _CDATA_RE.match(value)
    if match:
        value = match.group(1)
    return html.unescape(value.strip())


def parse_sitemap(xml_text: str) -> Sitemap:
    """Parse a sitemap document.

    Raises ParseError when the text is neither a `<sitemapindex>` nor a `<urlset>` — which
    is how an HTML error page served with a 200 gets rejected rather than silently walked.
    """
    if _ROOT_INDEX_RE.search(xml_text):
        kind = SITEMAP_INDEX
    elif _ROOT_URLSET_RE.search(xml_text):
        kind = URL_SET
    else:
        raise ParseError("Not a sitemap: no <sitemapindex> or <urlset> root")

    entries: list[SitemapEntry] = []
    for block in _BLOCK_RE.finditer(xml_text):
        body = block.group(1)

        loc_match = _LOC_RE.search(body)
        if loc_match is None:
            continue
        loc = _clean(loc_match.group(1))
        if not loc:
            continue

        lastmod_match = _LASTMOD_RE.search(body)
        lastmod = _clean(lastmod_match.group(1)) if lastmod_match else None

        entries.append(SitemapEntry(loc=loc, lastmod=lastmod or None))

    return Sitemap(kind=kind, entries=tuple(entries))


def walk_sitemaps(
    start_urls: Sequence[str],
    *,
    fetch: Callable[[str], str],
    follow: Callable[[str], bool] = lambda url: True,
    max_depth: int = DEFAULT_MAX_DEPTH,
    max_documents: int = DEFAULT_MAX_DOCUMENTS,
) -> Iterator[SitemapEntry]:
    """Yield leaf entries, descending through nested sitemap indexes.

    `follow` decides whether to descend into a nested index. It is consulted *before* the
    fetch, so skipping a family costs nothing — which matters when one family is thousands
    of documents that all 404.

    A document that fails to fetch or parse is logged and skipped: one broken family must
    not end the walk.
    """
    queue: list[tuple[str, int]] = [(url, 0) for url in start_urls]
    visited: set[str] = set()
    fetched = 0

    while queue:
        url, depth = queue.pop(0)

        # A sitemap that lists itself, or two that cross-reference, would otherwise loop.
        if url in visited:
            continue
        visited.add(url)

        if depth > max_depth:
            logger.warning("sitemap depth limit reached, skipping %s", url)
            continue

        if fetched >= max_documents:
            logger.warning("sitemap document limit (%s) reached, stopping walk", max_documents)
            return

        try:
            fetched += 1
            document = parse_sitemap(fetch(url))
        except (ScrapeError, ParseError) as exc:
            logger.warning("skipping sitemap %s: %s", url, exc)
            continue

        if document.kind == URL_SET:
            for entry in document.entries:
                yield replace(entry, found_in=url)
            continue

        for entry in document.entries:
            if follow(entry.loc):
                queue.append((entry.loc, depth + 1))
