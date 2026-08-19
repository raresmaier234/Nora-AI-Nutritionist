"""Tests for sitemap parsing and the index→leaf walk. No network."""

import pytest

from app.services.scraping.errors import FetchError, ParseError
from app.services.scraping.sitemap import (
    SITEMAP_INDEX,
    URL_SET,
    parse_sitemap,
    walk_sitemaps,
)

INDEX = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-basic-foods-1.xml</loc>
           <lastmod>2026-08-03T09:54:28-07:00</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-recipes-1.xml</loc></sitemap>
</sitemapindex>"""

URLSET = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/calories/butter-1</loc><lastmod>2025-02-26</lastmod></url>
  <url><loc>https://example.com/calories/milk-2</loc></url>
  <url><loc>https://example.com/calories/rice-3</loc><lastmod>2026-01-26</lastmod></url>
</urlset>"""


# --- parsing ----------------------------------------------------------------------


def test_recognises_an_index() -> None:
    assert parse_sitemap(INDEX).kind == SITEMAP_INDEX


def test_recognises_a_urlset() -> None:
    assert parse_sitemap(URLSET).kind == URL_SET


def test_namespace_prefixed_tags_are_parsed() -> None:
    """A default xmlns is what makes ElementTree's findall silently return nothing."""
    xml = """<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sm:url><sm:loc>https://example.com/calories/butter-1</sm:loc></sm:url>
    </sm:urlset>"""

    entries = parse_sitemap(xml).entries

    assert [e.loc for e in entries] == ["https://example.com/calories/butter-1"]


def test_lastmod_stays_with_its_own_loc_when_a_block_omits_it() -> None:
    """The misalignment bug: two independent findalls zipped would shift every later pair."""
    entries = parse_sitemap(URLSET).entries

    assert [(e.loc.rsplit("/", 1)[-1], e.lastmod) for e in entries] == [
        ("butter-1", "2025-02-26"),
        ("milk-2", None),
        ("rice-3", "2026-01-26"),
    ]


def test_entities_in_urls_are_resolved() -> None:
    xml = '<urlset><url><loc>https://example.com/a?x=1&amp;y=2</loc></url></urlset>'

    assert parse_sitemap(xml).entries[0].loc == "https://example.com/a?x=1&y=2"


def test_cdata_wrapped_locs_are_unwrapped() -> None:
    xml = "<urlset><url><loc><![CDATA[https://example.com/calories/butter-1]]></loc></url></urlset>"

    assert parse_sitemap(xml).entries[0].loc == "https://example.com/calories/butter-1"


def test_an_html_error_page_is_rejected() -> None:
    """The recipes family serves HTML error bodies; they must not walk as sitemaps."""
    with pytest.raises(ParseError, match="Not a sitemap"):
        parse_sitemap("<html><body><h1>Server error</h1></body></html>")


def test_an_empty_urlset_parses_to_no_entries() -> None:
    assert parse_sitemap("<urlset></urlset>").entries == ()


# --- walking ----------------------------------------------------------------------


def make_fetcher(documents: dict[str, str], *, calls: list[str] | None = None):
    def fetch(url: str) -> str:
        if calls is not None:
            calls.append(url)
        if url not in documents:
            raise FetchError(f"Source returned status 404", status_code=404)
        return documents[url]

    return fetch


def test_descends_from_index_to_leaf_and_yields_only_leaf_entries() -> None:
    docs = {
        "https://example.com/sitemap.xml": INDEX,
        "https://example.com/sitemap-basic-foods-1.xml": URLSET,
        "https://example.com/sitemap-recipes-1.xml": URLSET,
    }

    entries = list(walk_sitemaps(["https://example.com/sitemap.xml"], fetch=make_fetcher(docs)))

    assert len(entries) == 6  # both leaves, three entries each
    assert all("/calories/" in e.loc for e in entries)


def test_records_the_document_each_entry_came_from() -> None:
    docs = {
        "https://example.com/sitemap.xml": INDEX,
        "https://example.com/sitemap-basic-foods-1.xml": URLSET,
        "https://example.com/sitemap-recipes-1.xml": URLSET,
    }

    entries = list(walk_sitemaps(["https://example.com/sitemap.xml"], fetch=make_fetcher(docs)))

    assert {e.found_in for e in entries} == {
        "https://example.com/sitemap-basic-foods-1.xml",
        "https://example.com/sitemap-recipes-1.xml",
    }


def test_follow_prevents_the_fetch_entirely() -> None:
    """Skipping a family must cost nothing — thousands of 404s otherwise."""
    docs = {
        "https://example.com/sitemap.xml": INDEX,
        "https://example.com/sitemap-basic-foods-1.xml": URLSET,
        "https://example.com/sitemap-recipes-1.xml": URLSET,
    }
    calls: list[str] = []

    list(
        walk_sitemaps(
            ["https://example.com/sitemap.xml"],
            fetch=make_fetcher(docs, calls=calls),
            follow=lambda url: "recipes" not in url,
        )
    )

    assert not any("recipes" in url for url in calls)


def test_one_broken_document_does_not_end_the_walk() -> None:
    docs = {
        "https://example.com/sitemap.xml": INDEX,
        # basic-foods deliberately absent -> 404
        "https://example.com/sitemap-recipes-1.xml": URLSET,
    }

    entries = list(walk_sitemaps(["https://example.com/sitemap.xml"], fetch=make_fetcher(docs)))

    assert len(entries) == 3


def test_a_sitemap_listing_itself_terminates() -> None:
    docs = {
        "https://example.com/loop.xml": """<sitemapindex>
            <sitemap><loc>https://example.com/loop.xml</loc></sitemap>
        </sitemapindex>"""
    }
    calls: list[str] = []

    entries = list(walk_sitemaps(["https://example.com/loop.xml"], fetch=make_fetcher(docs, calls=calls)))

    assert entries == []
    assert calls.count("https://example.com/loop.xml") == 1


def test_document_limit_stops_the_walk() -> None:
    docs = {
        "https://example.com/sitemap.xml": INDEX,
        "https://example.com/sitemap-basic-foods-1.xml": URLSET,
        "https://example.com/sitemap-recipes-1.xml": URLSET,
    }
    calls: list[str] = []

    list(
        walk_sitemaps(
            ["https://example.com/sitemap.xml"],
            fetch=make_fetcher(docs, calls=calls),
            max_documents=2,
        )
    )

    assert len(calls) <= 2
