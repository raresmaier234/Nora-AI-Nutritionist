"""Tests for sitemap discovery and the HTML source. No network, no model.

Discovery is generic; these cases use EatThisMuch's layout because it is the site whose
traps (a decoy root sitemap, a family that 404s, query-string duplicates) shaped it.
"""

import httpx
import pytest

from app.services.ingest.extractor import ExtractionResult
from app.services.ingest.sites import Site, SiteList
from app.services.ingest.sources import HtmlSource, accepts, discover_site
from app.services.scraping.errors import UnsafeURLError
from app.services.scraping.robots import RobotsCache

EATTHISMUCH = Site(
    host="www.eatthismuch.com",
    paths=("/calories/",),
    skip_sitemaps=("recipes", "quantities"),
)

ROBOTS = """User-agent: *
Allow: /

Sitemap: https://www.eatthismuch.com/sitemap.xml
Sitemap: https://www.eatthismuch.com/sitemap-basic-foods.xml
Sitemap: https://www.eatthismuch.com/sitemap-recipes.xml
Sitemap: https://www.eatthismuch.com/sitemap-quantities.xml
Sitemap: https://elsewhere.example/sitemap.xml
"""

ROOT = """<urlset>
  <url><loc>https://www.eatthismuch.com/diets/keto</loc></url>
</urlset>"""

BASIC_INDEX = """<sitemapindex>
  <sitemap><loc>https://www.eatthismuch.com/sitemap-basic-foods-1.xml</loc>
           <lastmod>2026-08-03T09:54:28-07:00</lastmod></sitemap>
  <sitemap><loc>https://evil.example/sitemap-basic-foods-2.xml</loc></sitemap>
</sitemapindex>"""

BASIC_LEAF = """<urlset>
  <url><loc>https://www.eatthismuch.com/calories/butter-1</loc><lastmod>2025-02-26</lastmod></url>
  <url><loc>https://www.eatthismuch.com/calories/milk-2</loc></url>
  <url><loc>https://evil.example/calories/butter-1</loc></url>
</urlset>"""

QUANTITIES_INDEX = """<sitemapindex>
  <sitemap><loc>https://www.eatthismuch.com/sitemap-quantities-1.xml</loc></sitemap>
</sitemapindex>"""

DOCS = {
    "/sitemap.xml": ROOT,
    "/sitemap-basic-foods.xml": BASIC_INDEX,
    "/sitemap-basic-foods-1.xml": BASIC_LEAF,
    "/sitemap-quantities.xml": QUANTITIES_INDEX,
}


def server(documents: dict[str, str], *, robots: str = ROBOTS, calls: list[str] | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(str(request.url))
        path = request.url.path
        if path == "/robots.txt":
            return httpx.Response(200, headers={"content-type": "text/plain"}, text=robots)
        if path in documents:
            return httpx.Response(
                200, headers={"content-type": "application/xml"}, text=documents[path]
            )
        return httpx.Response(404, text="not found")

    return httpx.Client(transport=httpx.MockTransport(handler))


def robots_for(client: httpx.Client, *hosts: str) -> RobotsCache:
    return RobotsCache(
        client=client, default_delay=0.0, allowed_hosts=hosts or {EATTHISMUCH.host}
    )


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
def test_only_pages_on_the_site_and_under_its_paths_are_accepted(loc, accepted) -> None:
    assert accepts(EATTHISMUCH, loc) is accepted


# --- discovery --------------------------------------------------------------------


def test_discovers_food_urls_from_the_sitemaps() -> None:
    with server(DOCS) as client:
        found = list(discover_site(EATTHISMUCH, robots=robots_for(client)))

    assert [d.url for d in found] == [
        "https://www.eatthismuch.com/calories/butter-1",
        "https://www.eatthismuch.com/calories/milk-2",
    ]


def test_carries_lastmod_and_provenance() -> None:
    with server(DOCS) as client:
        found = list(discover_site(EATTHISMUCH, robots=robots_for(client)))

    assert found[0].lastmod == "2025-02-26"
    assert found[0].discovered_from.endswith("/sitemap-basic-foods-1.xml")
    assert found[1].lastmod is None


def test_the_root_sitemap_alone_yields_nothing() -> None:
    """Regression for the central trap.

    EatThisMuch's /sitemap.xml lists only diets and static pages. A crawler that follows
    it instead of reading robots.txt finds zero foods — silently, with no error.
    """
    robots_root_only = "User-agent: *\nAllow: /\n\nSitemap: https://www.eatthismuch.com/sitemap.xml\n"

    with server(DOCS, robots=robots_root_only) as client:
        found = list(discover_site(EATTHISMUCH, robots=robots_for(client)))

    assert found == []


def test_skipped_sitemaps_are_never_fetched() -> None:
    """recipes 404s on every entry; quantities are duplicates. Both cost hours if walked."""
    calls: list[str] = []

    with server(DOCS, calls=calls) as client:
        list(discover_site(EATTHISMUCH, robots=robots_for(client)))

    assert not any("recipes" in url for url in calls)
    assert not any("quantities" in url for url in calls)


def test_never_fetches_a_sitemap_on_another_host() -> None:
    """robots.txt and sitemap indexes can both point off-site; neither is followed."""
    calls: list[str] = []

    with server(DOCS, calls=calls) as client:
        list(discover_site(EATTHISMUCH, robots=robots_for(client)))

    assert not any("elsewhere.example" in url or "evil.example" in url for url in calls)


def test_falls_back_to_sitemap_xml_when_robots_declares_none() -> None:
    site = Site(host="www.eatthismuch.com", paths=("/diets/",))

    with server(DOCS, robots="User-agent: *\nAllow: /\n") as client:
        found = list(discover_site(site, robots=robots_for(client)))

    assert [d.url for d in found] == ["https://www.eatthismuch.com/diets/keto"]


def test_a_malformed_sitemap_entry_skips_that_entry_not_the_walk() -> None:
    """A tab inside a <loc> used to raise out of the walk and end the whole discover run."""
    index = """<sitemapindex>
      <sitemap><loc>https://www.eatthismuch.com/sitemap-basic-foods\t0.xml</loc></sitemap>
      <sitemap><loc>https://www.eatthismuch.com/sitemap-basic-foods-1.xml</loc></sitemap>
    </sitemapindex>"""

    with server({**DOCS, "/sitemap-basic-foods.xml": index}) as client:
        found = list(discover_site(EATTHISMUCH, robots=robots_for(client)))

    assert [d.url for d in found][:2] == [
        "https://www.eatthismuch.com/calories/butter-1",
        "https://www.eatthismuch.com/calories/milk-2",
    ]


def test_discovery_refuses_an_unrestricted_robots_cache() -> None:
    """The redirect check only exists when the cache carries the list; forgetting it fails."""
    with server(DOCS) as client:
        with pytest.raises(ValueError, match="allowed_hosts"):
            list(discover_site(EATTHISMUCH, robots=RobotsCache(client=client)))


def test_the_html_source_refuses_an_unrestricted_robots_cache() -> None:
    with page_server() as client:
        with pytest.raises(ValueError, match="allowed_hosts"):
            HtmlSource(
                sites=SiteList(sites=(EATTHISMUCH,)),
                robots=RobotsCache(client=client),
                extractor=FakeExtractor([]),
            )


def test_the_html_source_refuses_a_cache_wider_than_the_site_list() -> None:
    with page_server() as client:
        with pytest.raises(ValueError, match="allowed_hosts"):
            HtmlSource(
                sites=SiteList(sites=(EATTHISMUCH,)),
                robots=RobotsCache(client=client, allowed_hosts={EATTHISMUCH.host, "evil.example"}),
                extractor=FakeExtractor([]),
            )


def test_limit_stops_discovery_early() -> None:
    with server(DOCS) as client:
        found = list(discover_site(EATTHISMUCH, robots=robots_for(client), limit=1))

    assert len(found) == 1


# --- the HTML source --------------------------------------------------------------


class FakeExtractor:
    def __init__(self, foods: list[dict]) -> None:
        self.foods = foods
        self.calls = 0

    def extract(self, page_text: str) -> ExtractionResult:
        self.calls += 1
        return ExtractionResult(foods=self.foods, model="fake")


PANEL_PAGE = """<html><body><h1>Kiwi</h1>
  <div><h3>Valoare nutritivă</h3>
    <p>kcal: 50 kcal</p><p>Carbohidrați: 9,1 g</p><p>Proteine: 0,9 g</p><p>Grăsimi: 0,6 g</p>
  </div></body></html>"""

CATEGORY_PAGE = """<html><body><h1>Fructe exotice</h1>
  <ul><li>Ananas</li><li>Smochine</li><li>Kiwi</li><li>Papaya</li><li>Nuca de cocos</li></ul>
  <p>Fructele exotice sunt bogate în vitamine, fibre și antioxidanți.</p></body></html>"""


def page_server(page: str = PANEL_PAGE) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, headers={"content-type": "text/html"}, text=page)

    return httpx.Client(transport=httpx.MockTransport(handler))


def html_source(client: httpx.Client, site: Site, extractor: FakeExtractor) -> HtmlSource:
    return HtmlSource(
        sites=SiteList(sites=(site,)),
        robots=robots_for(client, site.host),
        extractor=extractor,
    )


def test_refuses_a_url_that_no_listed_site_owns() -> None:
    extractor = FakeExtractor([])

    with page_server() as client:
        source = html_source(client, EATTHISMUCH, extractor)
        with pytest.raises(UnsafeURLError, match="not on the site list"):
            source.load("https://www.eatthismuch.com/recipes/lasagne")

    assert extractor.calls == 0


KAUFLAND = Site(
    host="www.kaufland.ro", paths=("/sortiment/enciclopedia-alimentelor/",), always_per_100g=True
)
KAUFLAND_URL = "https://www.kaufland.ro/sortiment/enciclopedia-alimentelor/fructe/banana.html"


def test_a_page_without_a_nutrition_panel_never_reaches_the_model() -> None:
    """Regression: given a category page listing fruit names, llama3.2 invented values for
    all of them — consistent enough to pass every check."""
    extractor = FakeExtractor([{"name": "Ananas", "basis": "per_100g", "calories": "45"}])

    with page_server(CATEGORY_PAGE) as client:
        foods = html_source(client, KAUFLAND, extractor).load(
            "https://www.kaufland.ro/sortiment/enciclopedia-alimentelor/fructe/fructe-exotice.html"
        )

    assert foods == []
    assert extractor.calls == 0


@pytest.mark.parametrize("serving", [None, "50g", "nuca dură"])
def test_always_per_100g_overrules_the_models_guess(serving) -> None:
    """Encyclopedia pages print per-100g values without ever saying "per 100g".

    Seen live: the model called them per-serving with no weight, with a 50g weight lifted
    from "50 kcal", and with a word ("nuca dură") in place of a weight.
    """
    extractor = FakeExtractor([{"name": "Kiwi", "basis": "per_serving", "serving_grams": serving}])

    with page_server() as client:
        foods = html_source(client, KAUFLAND, extractor).load(KAUFLAND_URL)

    assert foods[0]["basis"] == "per_100g"
    assert foods[0]["serving_grams"] is None


def test_a_page_containing_a_skip_marker_is_not_read() -> None:
    site = Site(host="www.kaufland.ro", skip_pages_containing=("nu a fost inca aprobat",))
    extractor = FakeExtractor([{"name": "Kiwi", "basis": "per_100g"}])
    page = PANEL_PAGE.replace("</body>", "<p>Acest aliment nu a fost inca aprobat.</p></body>")

    with page_server(page) as client:
        assert html_source(client, site, extractor).load(KAUFLAND_URL) == []

    assert extractor.calls == 0


def test_a_site_with_a_reader_never_calls_the_model() -> None:
    site = Site(host="www.kaufland.ro", reader="kaufland")
    extractor = FakeExtractor([{"name": "invented"}])

    with page_server() as client:
        foods = html_source(client, site, extractor).load(KAUFLAND_URL)

    assert extractor.calls == 0
    assert foods[0]["name"] == "Kiwi"
    assert foods[0]["protein"] == "0,9 g"


def test_an_unknown_reader_is_refused_up_front() -> None:
    with page_server() as client:
        with pytest.raises(ValueError, match="unknown reader"):
            html_source(client, Site(host="www.kaufland.ro", reader="nope"), FakeExtractor([]))


def test_without_always_per_100g_the_models_basis_stands() -> None:
    extractor = FakeExtractor([{"name": "Butter", "basis": "per_serving", "serving_grams": None}])

    with page_server() as client:
        foods = html_source(client, EATTHISMUCH, extractor).load(
            "https://www.eatthismuch.com/calories/butter-1"
        )

    assert foods[0]["basis"] == "per_serving"
