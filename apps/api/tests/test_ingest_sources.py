"""Tests for the source adapters. No network, no model."""

import httpx
import pytest

from app.services.ingest.sources import EatThisMuchSource, HtmlSource, get_source
from app.services.scraping.robots import RobotsCache

ROBOTS = """User-agent: *
Allow: /

Sitemap: https://www.eatthismuch.com/sitemap.xml
Sitemap: https://www.eatthismuch.com/sitemap-basic-foods.xml
Sitemap: https://www.eatthismuch.com/sitemap-recipes.xml
Sitemap: https://www.eatthismuch.com/sitemap-quantities.xml
"""

BASIC_INDEX = """<sitemapindex>
  <sitemap><loc>https://www.eatthismuch.com/sitemap-basic-foods-1.xml</loc>
           <lastmod>2026-08-03T09:54:28-07:00</lastmod></sitemap>
</sitemapindex>"""

BASIC_LEAF = """<urlset>
  <url><loc>https://www.eatthismuch.com/calories/butter-1</loc><lastmod>2025-02-26</lastmod></url>
  <url><loc>https://www.eatthismuch.com/calories/milk-2</loc></url>
</urlset>"""

QUANTITIES_INDEX = """<sitemapindex>
  <sitemap><loc>https://www.eatthismuch.com/sitemap-quantities-1.xml</loc></sitemap>
</sitemapindex>"""


def site(documents: dict[str, str], *, calls: list[str] | None = None) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        path = request.url.path
        if calls is not None:
            calls.append(path)
        if path == "/robots.txt":
            return httpx.Response(200, headers={"content-type": "text/plain"}, text=ROBOTS)
        for known, body in documents.items():
            if known.endswith(path):
                return httpx.Response(200, headers={"content-type": "application/xml"}, text=body)
        return httpx.Response(404, text="not found")

    return httpx.Client(transport=httpx.MockTransport(handler))


def source_with(client: httpx.Client, robots_body: str | None = None) -> EatThisMuchSource:
    robots = RobotsCache(client=client, default_delay=0.0)
    return EatThisMuchSource(robots=robots, client=client, extractor=object())


DOCS = {
    "/sitemap-basic-foods.xml": BASIC_INDEX,
    "/sitemap-basic-foods-1.xml": BASIC_LEAF,
    "/sitemap-quantities.xml": QUANTITIES_INDEX,
}


# --- URL filtering ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("loc", "accepted"),
    [
        ("https://www.eatthismuch.com/calories/butter-1", True),
        ("https://www.eatthismuch.com/calories/bud-light-beer-78021", True),
        # The quantities duplicates — same food, restated with a query string.
        ("https://www.eatthismuch.com/calories/butter-1?a=0.33309859154929583%3A5", False),
        ("https://www.eatthismuch.com/calories/", False),
        ("https://www.eatthismuch.com/recipes/lasagne", False),
        ("https://www.eatthismuch.com/diets/keto", False),
        ("https://www.eatthismuch.com/calories/butter-1#nutrition", False),
        # Cross-host: a <loc> can name any server.
        ("https://evil.example/calories/butter-1", False),
        ("http://www.eatthismuch.com.evil.example/calories/x", False),
        ("ftp://www.eatthismuch.com/calories/x", False),
    ],
)
def test_only_real_food_urls_are_accepted(loc, accepted) -> None:
    with site(DOCS) as client:
        assert source_with(client).accepts(loc) is accepted


# --- discovery --------------------------------------------------------------------


def test_discovers_food_urls_from_the_sitemaps(monkeypatch) -> None:
    with site(DOCS) as client:
        found = list(source_with(client).discover(families=["basic"]))

    assert [d.url for d in found] == [
        "https://www.eatthismuch.com/calories/butter-1",
        "https://www.eatthismuch.com/calories/milk-2",
    ]


def test_carries_lastmod_and_provenance(monkeypatch) -> None:
    with site(DOCS) as client:
        found = list(source_with(client).discover(families=["basic"]))

    assert found[0].lastmod == "2025-02-26"
    assert found[0].discovered_from.endswith("/sitemap-basic-foods-1.xml")
    assert found[1].lastmod is None


def test_the_root_sitemap_alone_yields_nothing() -> None:
    """Regression for the central trap.

    /sitemap.xml lists only diets and static pages. A crawler that follows it instead of
    reading robots.txt finds zero foods — silently, with no error.
    """
    robots_root_only = "User-agent: *\nAllow: /\n\nSitemap: https://www.eatthismuch.com/sitemap.xml\n"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(
                200, headers={"content-type": "text/plain"}, text=robots_root_only
            )
        return httpx.Response(404, text="not found")

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        found = list(source_with(client).discover(families=["basic"]))

    assert found == []


def test_skipped_families_are_never_fetched() -> None:
    """recipes 404s on every leaf; quantities are duplicates. Both cost hours if walked."""
    calls: list[str] = []

    with site(DOCS, calls=calls) as client:
        list(source_with(client).discover(families=["basic"]))

    assert not any("recipes" in path for path in calls)
    assert not any("quantities" in path for path in calls)


def test_limit_stops_discovery_early() -> None:
    with site(DOCS) as client:
        found = list(source_with(client).discover(families=["basic"], limit=1))

    assert len(found) == 1


def test_an_unknown_family_is_rejected() -> None:
    with site(DOCS) as client:
        with pytest.raises(ValueError, match="unknown family"):
            list(source_with(client).discover(families=["nonsense"]))


# --- registry ---------------------------------------------------------------------


def test_sources_can_be_built_by_name() -> None:
    assert isinstance(get_source("html", extractor=object()), HtmlSource)
    assert isinstance(get_source("eatthismuch", extractor=object()), EatThisMuchSource)


def test_an_unknown_source_name_lists_the_known_ones() -> None:
    with pytest.raises(KeyError, match="eatthismuch"):
        get_source("nope")


def test_the_html_source_discovers_nothing() -> None:
    assert list(HtmlSource(extractor=object()).discover()) == []
