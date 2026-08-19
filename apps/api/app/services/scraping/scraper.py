"""A reusable JSON-LD scraper, parameterised by what it extracts and what it returns.

The pipeline (fetch -> extract JSON-LD -> filter by Schema.org type -> normalise) is the
same for a Recipe, a Product, an Event or an Article. Only the last step differs, so the
type name and the normaliser are injected and everything else is shared.
"""

from typing import Callable, Generic, Protocol, TypeVar

import httpx

from app.services.scraping.fetcher import fetch_html
from app.services.scraping.jsonld import extract_json_ld, find_by_type

T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)


class Normalizer(Protocol[T_co]):
    """Turns one raw JSON-LD object into a caller-defined model.

    Implementations should raise ParseError when an object can't be interpreted.
    """

    def __call__(self, node: dict) -> T_co: ...


class JsonLdScraper(Generic[T]):
    """Scrapes objects of one Schema.org type from a page.

    Holds no per-request state, so a single instance is safe to share across requests.
    """

    def __init__(
        self,
        schema_type: str,
        normalizer: Normalizer[T],
        *,
        client: httpx.Client | None = None,
    ) -> None:
        self._schema_type = schema_type
        self._normalizer = normalizer
        self._client = client

    def scrape(self, url: str) -> list[T]:
        """Return every matching object on the page, normalised. Empty if none match."""
        html = fetch_html(url, client=self._client)
        return self.scrape_html(html)

    def scrape_html(self, html: str) -> list[T]:
        """Same as `scrape`, on HTML you already have — useful for tests and caches."""
        nodes = find_by_type(extract_json_ld(html), self._schema_type)
        return [self._normalizer(node) for node in nodes]


def json_ld_scraper(
    schema_type: str,
    normalizer: Normalizer[T],
    *,
    client: httpx.Client | None = None,
) -> JsonLdScraper[T]:
    """Build a scraper for one Schema.org type.

        recipes = json_ld_scraper("Recipe", normalize_recipe).scrape(url)
    """
    return JsonLdScraper(schema_type, normalizer, client=client)
