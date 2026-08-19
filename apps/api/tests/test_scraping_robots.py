"""Tests for robots.txt handling and crawl pacing. No network.

The EatThisMuch file below is verbatim from the live site.
"""

import httpx
import pytest

from app.services.scraping.errors import RobotsDisallowedError
from app.services.scraping.robots import RobotsCache

EATTHISMUCH_ROBOTS = """User-agent: ClaudeBot
Allow: /
Crawl-delay: 2

User-agent: meta-externalagent
Allow: /
Crawl-delay: 2

User-agent: *
Allow: /

Sitemap: https://www.eatthismuch.com/sitemap.xml
Sitemap: https://www.eatthismuch.com/sitemap-basic-foods.xml
Sitemap: https://www.eatthismuch.com/sitemap-restaurant-foods.xml
Sitemap: https://www.eatthismuch.com/sitemap-recipes.xml
Sitemap: https://www.eatthismuch.com/sitemap-quantities.xml
Sitemap: https://www.eatthismuch.com/sitemap-branded-foods-ac.xml
"""

FOOD_URL = "https://www.eatthismuch.com/calories/butter-1"


def robots_server(body: str = EATTHISMUCH_ROBOTS, *, status: int = 200, calls: list | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(str(request.url))
        if request.url.path == "/robots.txt":
            if status != 200:
                return httpx.Response(status, text="nope")
            return httpx.Response(200, headers={"content-type": "text/plain"}, text=body)
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<html/>")

    return httpx.Client(transport=httpx.MockTransport(handler))


def cache(client: httpx.Client, **kwargs) -> RobotsCache:
    return RobotsCache(client=client, **kwargs)


# --- the real file ----------------------------------------------------------------


def test_a_food_url_is_allowed() -> None:
    with robots_server() as client:
        assert cache(client).can_fetch(FOOD_URL) is True


def test_sitemaps_are_read_from_robots() -> None:
    """The root sitemap.xml does not list the food sitemaps — robots.txt is the only source."""
    with robots_server() as client:
        policy = cache(client).policy_for(FOOD_URL)

    assert len(policy.sitemaps) == 6
    assert "https://www.eatthismuch.com/sitemap-basic-foods.xml" in policy.sitemaps


def test_the_delay_floor_applies_when_robots_declares_none_for_us() -> None:
    """Our token falls in the `*` group, which sets no Crawl-delay."""
    with robots_server() as client:
        assert cache(client).crawl_delay(FOOD_URL) == 2.0


def test_a_larger_declared_delay_wins_over_the_floor() -> None:
    body = "User-agent: *\nAllow: /\nCrawl-delay: 10\n"

    with robots_server(body) as client:
        assert cache(client).crawl_delay(FOOD_URL) == 10.0


def test_a_fractional_delay_falls_back_to_the_floor() -> None:
    """stdlib silently drops non-integer Crawl-delay; the floor covers it."""
    body = "User-agent: *\nAllow: /\nCrawl-delay: 2.5\n"

    with robots_server(body) as client:
        assert cache(client).crawl_delay(FOOD_URL) == 2.0


def test_disallowed_paths_are_refused() -> None:
    body = "User-agent: *\nDisallow: /private\n"

    with robots_server(body) as client:
        robots = cache(client)
        assert robots.can_fetch("https://example.com/private/x") is False
        assert robots.can_fetch("https://example.com/public/x") is True


def test_a_named_disallow_applies_to_that_agent_only() -> None:
    body = "User-agent: *\nAllow: /\n\nUser-agent: OtherBot\nDisallow: /\n"

    with robots_server(body) as client:
        assert cache(client).can_fetch("https://example.com/x") is True


# --- caching ----------------------------------------------------------------------


def test_robots_is_fetched_once_per_origin() -> None:
    calls: list = []
    with robots_server(calls=calls) as client:
        robots = cache(client)
        for _ in range(10):
            robots.can_fetch(FOOD_URL)

    assert sum(1 for url in calls if url.endswith("/robots.txt")) == 1


# --- failure policy (RFC 9309) ----------------------------------------------------


def test_a_missing_robots_means_crawling_is_allowed() -> None:
    with robots_server(status=404) as client:
        assert cache(client).can_fetch(FOOD_URL) is True


@pytest.mark.parametrize("status", [401, 403, 429, 500, 503])
def test_an_unreachable_robots_means_assume_disallowed(status: int) -> None:
    with robots_server(status=status) as client:
        assert cache(client).can_fetch(FOOD_URL) is False


def test_a_network_failure_means_assume_disallowed() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with httpx.Client(transport=httpx.MockTransport(refuse)) as client:
        assert cache(client).can_fetch(FOOD_URL) is False


# --- pacing -----------------------------------------------------------------------


def test_the_first_request_to_a_host_does_not_wait(monkeypatch) -> None:
    slept: list[float] = []
    monkeypatch.setattr("app.services.scraping.robots.time.sleep", slept.append)

    with robots_server() as client:
        cache(client).wait(FOOD_URL)

    assert slept == []


def test_waiting_is_measured_start_to_start(monkeypatch) -> None:
    """Work done between requests counts toward the delay, so it is not slept twice."""
    now = {"t": 1000.0}
    slept: list[float] = []
    monkeypatch.setattr("app.services.scraping.robots.time.monotonic", lambda: now["t"])
    monkeypatch.setattr("app.services.scraping.robots.time.sleep", slept.append)

    with robots_server() as client:
        robots = cache(client)
        robots.wait(FOOD_URL)
        now["t"] += 1.5  # extraction took 1.5s of the 2.0s delay
        robots.wait(FOOD_URL)

    assert slept == pytest.approx([0.5])


def test_no_wait_when_work_already_exceeded_the_delay(monkeypatch) -> None:
    now = {"t": 1000.0}
    slept: list[float] = []
    monkeypatch.setattr("app.services.scraping.robots.time.monotonic", lambda: now["t"])
    monkeypatch.setattr("app.services.scraping.robots.time.sleep", slept.append)

    with robots_server() as client:
        robots = cache(client)
        robots.wait(FOOD_URL)
        now["t"] += 5.0
        robots.wait(FOOD_URL)

    assert slept == []


# --- the gate ---------------------------------------------------------------------


def test_fetch_refuses_a_disallowed_url_loudly(monkeypatch) -> None:
    monkeypatch.setattr("app.services.scraping.robots.time.sleep", lambda _: None)
    body = "User-agent: *\nDisallow: /private\n"

    with robots_server(body) as client:
        with pytest.raises(RobotsDisallowedError):
            cache(client).fetch("https://example.com/private/x")


def test_fetch_returns_the_body_for_an_allowed_url(monkeypatch) -> None:
    monkeypatch.setattr("app.services.scraping.robots.time.sleep", lambda _: None)

    with robots_server() as client:
        assert cache(client).fetch(FOOD_URL) == "<html/>"
