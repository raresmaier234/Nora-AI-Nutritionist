"""Drives the ingest frontier: fetch, extract, normalize, store.

Progress is committed per job, so a run that dies at hour 30 of 39 resumes where it stopped
without re-fetching or re-extracting anything already done.

One page's failure is never allowed to end a run — a URL that 403s, a model timeout, or a
label that fails the plausibility check all mark that job and move on.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field, replace
from urllib.parse import urldefrag

from sqlalchemy import func, select, update
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
from app.services.ingest.sites import SiteList
from app.services.ingest.sources import Discovered, FoodSource, HtmlSource
from app.services.ingest.store import upsert_food
from app.services.scraping import ScrapeError
from app.services.scraping.robots import RobotsCache

logger = logging.getLogger(__name__)

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
    # Same name as a food already stored from another page; left unmerged.
    foods_name_taken: int = 0
    flagged_for_review: int = 0
    rejection_reasons: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"{self.processed} urls processed ({self.succeeded} ok, {self.failed} failed) — "
            f"{self.foods_created} foods created, {self.foods_enriched} enriched, "
            f"{self.foods_rejected} rejected, {self.foods_name_taken} name already taken, "
            f"{self.flagged_for_review} flagged for review"
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


@dataclass
class SeedResult:
    added: int
    # URLs refused because no listed site owns them.
    rejected: list[str]


def seed_urls(db: Session, urls: Iterable[str], *, sites: SiteList) -> SeedResult:
    """Queue manually supplied URLs, refusing any that no listed site owns.

    Each job is tagged with its site's host, so `status` and `run --site` can tell sites
    apart. The fragment is dropped: it is never sent to the server, and keeping it would
    let `page#a` and `page#b` queue the same page twice.
    """
    by_host: dict[str, list[Discovered]] = {}
    rejected: list[str] = []

    for raw in urls:
        url = urldefrag(raw.strip()).url
        site = sites.site_for(url)
        if site is None:
            rejected.append(raw.strip())
            continue
        by_host.setdefault(site.host, []).append(Discovered(url=url))

    added = sum(
        seed_discovered(db, items, source=host) for host, items in by_host.items()
    )
    return SeedResult(added=added, rejected=rejected)


def requeue(db: Session, *, site: str | None = None, include_done: bool = False) -> int:
    """Put failed jobs (and, with `include_done`, finished ones) back in the queue.

    A job that failed because Ollama was not running, or a site was briefly down, is never
    retried on its own: `run` only takes pending jobs. Returns how many were requeued.
    """
    statuses = [STATUS_FAILED, STATUS_DONE] if include_done else [STATUS_FAILED]
    query = (
        update(IngestJob)
        .where(IngestJob.status.in_(statuses))
        .values(status=STATUS_PENDING, last_error=None)
    )
    if site is not None:
        query = query.where(IngestJob.source == site)
    count = db.execute(query).rowcount
    db.commit()
    return count


def pending_count(db: Session, *, site: str | None = None) -> int:
    query = select(func.count()).select_from(IngestJob).where(IngestJob.status == STATUS_PENDING)
    if site is not None:
        query = query.where(IngestJob.source == site)
    return db.execute(query).scalar_one()


def process_job(
    db: Session,
    job: IngestJob,
    *,
    source: FoodSource,
    stats: RunStats,
) -> list[int]:
    """Run one URL through the pipeline and commit the outcome.

    Returns the ids of the foods it added or changed, so the caller can bring the search
    index up to date once they are committed.
    """
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
        return []

    created = 0
    saved: list[int] = []
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
            saved.append(outcome.food.id)
        elif outcome.name_taken:
            stats.foods_name_taken += 1
        else:
            stats.foods_enriched += 1
            saved.append(outcome.food.id)
        if outcome.similar:
            stats.flagged_for_review += 1

    # A page with no usable food is still a page we are finished with, not a failure.
    job.status = STATUS_DONE
    job.foods_found = created
    job.last_error = None
    job.processed_at = func.now()
    stats.succeeded += 1
    db.commit()
    return saved


def _fail_unexpectedly(db: Session, job_id: int, exc: Exception) -> None:
    logger.exception("job %s crashed", job_id)
    db.rollback()
    job = db.get(IngestJob, job_id)
    if job is None:
        return
    job.attempts += 1
    job.status = STATUS_FAILED
    job.last_error = f"unexpected {type(exc).__name__}: {exc}"[:1000]
    job.processed_at = func.now()
    db.commit()


def run(
    db: Session,
    *,
    sites: SiteList,
    robots: RobotsCache,
    extractor: OllamaExtractor | None = None,
    limit: int | None = None,
    site: str | None = None,
    should_stop: Callable[[], bool] | None = None,
    on_saved: Callable[[list[int]], None] | None = None,
) -> RunStats:
    """Process pending jobs until the frontier empties, `limit` is hit, or asked to stop.

    Only URLs owned by a site in `sites` are fetched; a pending job for any other site is
    marked failed without a request being made. `robots` paces every request and should be
    built with `allowed_hosts=sites.hosts` so redirects cannot leave the list either.

    `site` restricts the run to one host's jobs. `should_stop` is polled between jobs,
    which is what lets Ctrl-C finish the page in flight and exit cleanly rather than
    abandoning it mid-write.

    `on_saved` is called with the ids of the foods each page added or changed, after they
    are committed — how the ingest command keeps the search index current. It must handle
    its own errors: a failure there is not the page's failure.
    """
    source = HtmlSource(sites=sites, robots=robots, extractor=extractor)
    stats = RunStats()

    while limit is None or stats.processed < limit:
        if should_stop is not None and should_stop():
            logger.info("stop requested — finishing after %s urls", stats.processed)
            break

        query = select(IngestJob).where(IngestJob.status == STATUS_PENDING)
        if site is not None:
            query = query.where(IngestJob.source == site)
        # Ordered so ingestion follows discovery order. Without this, `--limit N` over a
        # frontier of ~863k rows takes an arbitrary physical slice.
        job = db.execute(query.order_by(IngestJob.id).limit(1)).scalar_one_or_none()

        if job is None:
            break

        before = replace(stats, rejection_reasons=list(stats.rejection_reasons))
        try:
            saved = process_job(db, job, source=source, stats=stats)
        except Exception as exc:
            # Anything unexpected is recorded on the job rather than ending the run. Left
            # pending, the same job would be picked first again next run and crash it too.
            _fail_unexpectedly(db, job.id, exc)
            # The job's writes were rolled back, so its counts must be too.
            stats.__dict__.update(before.__dict__)
            stats.failed += 1
            saved = []
        stats.processed += 1
        if saved and on_saved is not None:
            on_saved(saved)

    return stats
