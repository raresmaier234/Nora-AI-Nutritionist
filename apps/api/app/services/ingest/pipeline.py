"""Drives the ingest frontier: fetch, extract, normalize, store.

Progress is committed per job, so a run that dies at hour 30 of 39 resumes where it stopped
without re-fetching or re-extracting anything already done.

One page's failure is never allowed to end a run — a URL that 403s, a model timeout, or a
label that fails the plausibility check all mark that job and move on.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.models.ingest_job import (
    STATUS_DONE,
    STATUS_FAILED,
    STATUS_PENDING,
    IngestJob,
)
from app.services.ingest.extractor import ExtractionError, OllamaExtractor
from app.services.ingest.normalizer import NormalizationError, normalize_food
from app.services.ingest.sources import Discovered, FoodSource, HtmlSource, get_source
from app.services.ingest.store import upsert_food
from app.services.scraping import ScrapeError
from app.services.scraping.robots import RobotsCache

logger = logging.getLogger(__name__)

# Politeness delay between fetches, used only when robots pacing is not in play.
DEFAULT_DELAY_SECONDS = 1.0

# 5 columns x 1000 rows stays well under libpq's 65,535 bind-parameter ceiling.
DEFAULT_BATCH_SIZE = 1000


@dataclass
class RunStats:
    processed: int = 0
    succeeded: int = 0
    failed: int = 0
    foods_created: int = 0
    foods_enriched: int = 0
    foods_rejected: int = 0
    flagged_for_review: int = 0
    rejection_reasons: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"{self.processed} urls processed ({self.succeeded} ok, {self.failed} failed) — "
            f"{self.foods_created} foods created, {self.foods_enriched} enriched, "
            f"{self.foods_rejected} rejected, {self.flagged_for_review} flagged for review"
        )


def seed_discovered(
    db: Session,
    discovered: Iterable[Discovered],
    *,
    source: str,
    batch_size: int = DEFAULT_BATCH_SIZE,
    on_batch: Callable[[int, int], None] | None = None,
) -> int:
    """Bulk-insert discovered URLs. Returns how many rows were actually new.

    Uses Core insert with ON CONFLICT DO NOTHING rather than the ORM: at ~863k rows an
    identity map holding every object would exhaust memory, and the conflict clause is
    what makes re-running discovery free. Commits per batch, matching the per-job commit
    policy that makes the whole pipeline resumable.
    """
    added = 0
    seen_total = 0
    batch: list[dict] = []

    def flush() -> None:
        nonlocal added, batch
        if not batch:
            return
        # Deduplicate within the batch: harmless under DO NOTHING, but it keeps the
        # reported count honest and is required if this ever becomes DO UPDATE.
        unique = list({row["url"]: row for row in batch}.values())
        statement = (
            pg_insert(IngestJob)
            .values(unique)
            .on_conflict_do_nothing(index_elements=["url"])
            # RETURNING, not rowcount: psycopg reports -1 for a DO NOTHING insert, and
            # only genuinely inserted rows come back here, so the count is exact.
            .returning(IngestJob.id)
        )
        added += len(db.execute(statement).scalars().all())
        db.commit()
        batch = []

    for item in discovered:
        batch.append(
            {
                "url": item.url,
                "source": source,
                "discovered_from": item.discovered_from,
                "lastmod": item.lastmod,
                "status": STATUS_PENDING,
            }
        )
        seen_total += 1

        if len(batch) >= batch_size:
            flush()
            if on_batch is not None:
                on_batch(seen_total, added)

    flush()
    if on_batch is not None:
        on_batch(seen_total, added)

    return added


def seed_urls(db: Session, urls: list[str]) -> int:
    """Add manually supplied URLs to the frontier. Returns the number added."""
    return seed_discovered(
        db, (Discovered(url=url) for url in urls), source=HtmlSource.name
    )


def pending_count(db: Session) -> int:
    return db.execute(
        select(func.count()).select_from(IngestJob).where(IngestJob.status == STATUS_PENDING)
    ).scalar_one()


def process_job(
    db: Session,
    job: IngestJob,
    *,
    source: FoodSource,
    stats: RunStats,
) -> None:
    """Run one URL through the pipeline and commit the outcome."""
    job.attempts += 1

    try:
        raw_foods = source.load(job.url)
    except (ScrapeError, ExtractionError) as exc:
        job.status = STATUS_FAILED
        job.last_error = f"{type(exc).__name__}: {exc}"[:1000]
        job.processed_at = func.now()
        stats.failed += 1
        db.commit()
        logger.warning("job %s failed: %s", job.url, exc)
        return

    created = 0
    for raw in raw_foods:
        try:
            normalized = normalize_food(raw)
        except NormalizationError as exc:
            # The commonest path by far: the model reported something the page didn't
            # actually support, or the numbers contradict each other.
            stats.foods_rejected += 1
            stats.rejection_reasons.append(str(exc))
            continue

        outcome = upsert_food(
            db, normalized, source_url=job.url, raw_extraction=raw
        )
        if outcome.created:
            created += 1
            stats.foods_created += 1
        else:
            stats.foods_enriched += 1
        if outcome.similar:
            stats.flagged_for_review += 1

    # A page with no usable food is still a page we are finished with, not a failure.
    job.status = STATUS_DONE
    job.foods_found = created
    job.last_error = None
    job.processed_at = func.now()
    stats.succeeded += 1
    db.commit()


def run(
    db: Session,
    *,
    limit: int | None = None,
    source_name: str | None = None,
    extractor: OllamaExtractor | None = None,
    robots: RobotsCache | None = None,
    client: httpx.Client | None = None,
    delay_seconds: float = DEFAULT_DELAY_SECONDS,
    should_stop: Callable[[], bool] | None = None,
) -> RunStats:
    """Process pending jobs until the frontier empties, `limit` is hit, or asked to stop.

    Each job is routed to the adapter named in `ingest_jobs.source`, so a frontier holding
    both manually seeded URLs and discovered ones works without special handling.

    `should_stop` is polled between jobs, which is what lets Ctrl-C finish the page in
    flight and exit cleanly rather than abandoning it mid-write.
    """
    extractor = extractor or OllamaExtractor()
    stats = RunStats()
    sources: dict[str, FoodSource] = {}

    def source_for(name: str) -> FoodSource:
        if name not in sources:
            sources[name] = get_source(
                name, extractor=extractor, robots=robots, client=client
            )
        return sources[name]

    while limit is None or stats.processed < limit:
        if should_stop is not None and should_stop():
            logger.info("stop requested — finishing after %s urls", stats.processed)
            break

        query = select(IngestJob).where(IngestJob.status == STATUS_PENDING)
        if source_name is not None:
            query = query.where(IngestJob.source == source_name)
        # Ordered so ingestion follows discovery order. Without this, `--limit N` over a
        # frontier of ~863k rows takes an arbitrary physical slice.
        job = db.execute(query.order_by(IngestJob.id).limit(1)).scalar_one_or_none()

        if job is None:
            break

        process_job(db, job, source=source_for(job.source or HtmlSource.name), stats=stats)
        stats.processed += 1

        # When robots is in play it already paced the request start-to-start; sleeping
        # again here would double the delay for no benefit to the site.
        if robots is None and delay_seconds:
            time.sleep(delay_seconds)

    return stats
