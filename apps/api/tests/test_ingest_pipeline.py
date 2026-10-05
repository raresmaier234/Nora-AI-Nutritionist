"""Tests for seeding and running the ingest frontier against the site list.

These share the real database (rolled back after each test), which may already hold
genuinely queued jobs — so every URL here is on a synthetic host, and every `run()` is
restricted to that host so it never touches real work.
"""

import socket

import httpx
import pytest
from sqlalchemy import select

from app.db.models.ingest_job import STATUS_DONE, STATUS_FAILED, STATUS_PENDING, IngestJob
from app.services.ingest.extractor import ExtractionResult
from app.services.ingest.pipeline import requeue, run, seed_urls
from app.services.ingest.sites import Site, SiteList
from app.services.scraping.robots import RobotsCache

HOST = "zzz-listed.example"
SITES = SiteList(sites=(Site(host=HOST, paths=("/foods/",)),))


def job_for(db, url: str) -> IngestJob | None:
    return db.execute(select(IngestJob).where(IngestJob.url == url)).scalar_one_or_none()


# --- seeding ----------------------------------------------------------------------


def test_seed_refuses_urls_that_no_listed_site_owns(db_session) -> None:
    result = seed_urls(
        db_session,
        [
            f"https://{HOST}/foods/apple",
            f"https://{HOST}/blog/news",  # right host, wrong path
            "https://zzz-unlisted.example/foods/apple",
            "ftp://zzz-listed.example/foods/pear",
        ],
        sites=SITES,
    )

    assert result.added == 1
    assert result.rejected == [
        f"https://{HOST}/blog/news",
        "https://zzz-unlisted.example/foods/apple",
        "ftp://zzz-listed.example/foods/pear",
    ]
    assert job_for(db_session, "https://zzz-unlisted.example/foods/apple") is None


def test_seed_tags_each_job_with_its_site(db_session) -> None:
    seed_urls(db_session, [f"https://{HOST}/foods/apple"], sites=SITES)

    assert job_for(db_session, f"https://{HOST}/foods/apple").source == HOST


def test_seed_drops_the_fragment_so_one_page_is_queued_once(db_session) -> None:
    result = seed_urls(
        db_session,
        [f"https://{HOST}/foods/egg.html#egg", f"  https://{HOST}/foods/egg.html  "],
        sites=SITES,
    )

    assert result.added == 1
    assert job_for(db_session, f"https://{HOST}/foods/egg.html") is not None


# --- running ----------------------------------------------------------------------


class FakeExtractor:
    def __init__(self, *, error: Exception | None = None, foods: list[dict] | None = None):
        self.error = error
        self.foods = foods or []
        self.calls = 0

    def extract(self, page_text: str) -> ExtractionResult:
        self.calls += 1
        if self.error is not None:
            raise self.error
        return ExtractionResult(foods=self.foods, model="fake")


@pytest.fixture()
def public_dns(monkeypatch):
    def fake_getaddrinfo(host, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)


PANEL_PAGE = """<html><body><h1>Apple</h1><table>
  <tr><th>Nutrition facts</th><th>per 100g</th></tr>
  <tr><td>Energy</td><td>52 kcal</td></tr><tr><td>Carbohydrate</td><td>14 g</td></tr>
  <tr><td>Protein</td><td>0.3 g</td></tr><tr><td>Fat</td><td>0.2 g</td></tr>
</table></body></html>"""


def site_server(requested: list[str]) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        requested.append(f"{request.headers['host']}{request.url.path}")
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, headers={"content-type": "text/html"}, text=PANEL_PAGE)

    return httpx.Client(transport=httpx.MockTransport(handler))


def run_site(db, client, extractor, *, sites=SITES, site=HOST):
    robots = RobotsCache(client=client, default_delay=0.0, allowed_hosts=sites.hosts)
    return run(db, sites=sites, robots=robots, extractor=extractor, site=site)


def test_a_leftover_job_for_an_unlisted_site_fails_without_being_fetched(db_session) -> None:
    """A site removed from the list must stop being crawled, even with jobs still queued."""
    url = "https://zzz-removed.example/foods/apple"
    db_session.add(IngestJob(url=url, source="zzz-removed.example", status=STATUS_PENDING))
    db_session.flush()
    requested: list[str] = []

    with site_server(requested) as client:
        stats = run_site(db_session, client, FakeExtractor(), site="zzz-removed.example")

    job = job_for(db_session, url)
    assert job.status == STATUS_FAILED
    assert "not on the site list" in job.last_error
    assert requested == []
    assert stats.failed == 1


def test_a_listed_page_is_fetched_and_completed(db_session, public_dns) -> None:
    seed_urls(db_session, [f"https://{HOST}/foods/apple"], sites=SITES)
    requested: list[str] = []
    extractor = FakeExtractor()

    with site_server(requested) as client:
        stats = run_site(db_session, client, extractor)

    assert job_for(db_session, f"https://{HOST}/foods/apple").status == STATUS_DONE
    assert f"{HOST}/foods/apple" in requested
    assert extractor.calls == 1
    assert stats.succeeded == 1


def test_an_unexpected_error_fails_the_job_instead_of_ending_the_run(
    db_session, public_dns
) -> None:
    """Left pending, a crashing job is picked first on every later run and blocks them all."""
    seed_urls(
        db_session, [f"https://{HOST}/foods/apple", f"https://{HOST}/foods/pear"], sites=SITES
    )

    with site_server([]) as client:
        stats = run_site(db_session, client, FakeExtractor(error=RuntimeError("boom")))

    for name in ("apple", "pear"):
        job = job_for(db_session, f"https://{HOST}/foods/{name}")
        assert job.status == STATUS_FAILED
        assert "RuntimeError: boom" in job.last_error
    assert stats.processed == 2


def test_a_crash_mid_job_does_not_leave_its_rolled_back_foods_in_the_stats(
    db_session, public_dns, monkeypatch
) -> None:
    import app.services.ingest.pipeline as pipeline

    seed_urls(db_session, [f"https://{HOST}/foods/apple"], sites=SITES)
    real_upsert = pipeline.upsert_food
    calls = {"n": 0}

    def upsert_then_crash(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("disk full")
        return real_upsert(*args, **kwargs)

    monkeypatch.setattr(pipeline, "upsert_food", upsert_then_crash)
    food = {
        "basis": "per_100g",
        "calories": "52 kcal",
        "carbs": "14g",
        "protein": "0.3g",
        "fat": "0.2g",
    }
    extractor = FakeExtractor(
        foods=[{**food, "name": "Zzz Test Apple A"}, {**food, "name": "Zzz Test Apple B"}]
    )

    with site_server([]) as client:
        stats = run_site(db_session, client, extractor)

    assert stats.failed == 1
    assert stats.foods_created == 0  # the first food's insert was rolled back with the job


def test_requeue_retries_failed_jobs_for_one_site_only(db_session) -> None:
    db_session.add_all(
        [
            IngestJob(url=f"https://{HOST}/foods/a", source=HOST, status=STATUS_FAILED,
                      last_error="ExtractionError: could not reach Ollama"),
            IngestJob(url=f"https://{HOST}/foods/b", source=HOST, status=STATUS_DONE),
            IngestJob(url="https://zzz-other.example/foods/c", source="zzz-other.example",
                      status=STATUS_FAILED),
        ]
    )
    db_session.flush()

    assert requeue(db_session, site=HOST) == 1

    retried = job_for(db_session, f"https://{HOST}/foods/a")
    assert retried.status == STATUS_PENDING
    assert retried.last_error is None
    assert job_for(db_session, f"https://{HOST}/foods/b").status == STATUS_DONE
    assert job_for(db_session, "https://zzz-other.example/foods/c").status == STATUS_FAILED


def test_requeue_can_include_finished_jobs(db_session) -> None:
    db_session.add(IngestJob(url=f"https://{HOST}/foods/b", source=HOST, status=STATUS_DONE))
    db_session.flush()

    assert requeue(db_session, site=HOST, include_done=True) == 1
    assert job_for(db_session, f"https://{HOST}/foods/b").status == STATUS_PENDING
