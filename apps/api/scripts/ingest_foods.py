#!/usr/bin/env python
"""Command line entry point for the food ingestion pipeline.

    # find food URLs automatically from a site's sitemaps
    python scripts/ingest_foods.py discover --dry-run        # walk and count, write nothing
    python scripts/ingest_foods.py discover                  # queue what it finds

    # or add URLs by hand (idempotent — re-seeding an overlapping list is safe)
    python scripts/ingest_foods.py seed urls.txt

    # work the frontier until it empties or you press Ctrl-C
    python scripts/ingest_foods.py run
    python scripts/ingest_foods.py run --limit 100

    # where things stand
    python scripts/ingest_foods.py status

Both `discover` and `run` are resumable and safe to interrupt: progress is committed as it
goes, and Ctrl-C finishes the page in flight before exiting. Expect roughly 2s per page.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
from pathlib import Path

import httpx
from sqlalchemy import func, select

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal  # noqa: E402
from app.db.models.food import Food  # noqa: E402
from app.db.models.ingest_job import IngestJob  # noqa: E402
from app.services.ingest.extractor import OllamaExtractor  # noqa: E402
from app.services.ingest.pipeline import (  # noqa: E402
    DEFAULT_DELAY_SECONDS,
    pending_count,
    run,
    seed_discovered,
    seed_urls,
)
from app.services.ingest.sources import EatThisMuchSource, get_source  # noqa: E402
from app.services.scraping.robots import RobotsCache  # noqa: E402


class StopRequested:
    """Turns the first Ctrl-C into a clean stop, and the second into an immediate exit.

    Interrupting mid-page would otherwise abandon work that is already half-written; the
    pipeline polls this between jobs so the page in flight finishes and commits first.
    """

    def __init__(self) -> None:
        self._requested = False

    def __call__(self) -> bool:
        return self._requested

    def install(self) -> None:
        def handler(signum, frame) -> None:
            if self._requested:
                print("\nInterrupted again — exiting now.", file=sys.stderr)
                raise KeyboardInterrupt
            self._requested = True
            print("\nStopping after the current page… (Ctrl-C again to quit now)", file=sys.stderr)

        signal.signal(signal.SIGINT, handler)


def cmd_seed(args: argparse.Namespace) -> int:
    urls = [
        line.strip()
        for line in Path(args.file).read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]
    if not urls:
        print(f"No URLs found in {args.file}")
        return 1

    with SessionLocal() as db:
        added = seed_urls(db, urls)

    print(f"Seeded {added} new URLs ({len(urls) - added} already queued)")
    return 0


def cmd_discover(args: argparse.Namespace) -> int:
    stop = StopRequested()
    stop.install()

    with httpx.Client() as client:
        robots = RobotsCache(client=client, default_delay=args.delay)
        source = get_source(args.source, robots=robots, client=client, extractor=None)

        families = args.family or list(EatThisMuchSource.DEFAULT_FAMILIES)
        print(f"Discovering from {args.source}, families: {', '.join(families)}")
        print("Ctrl-C to stop.\n")

        found = source.discover(families=families, limit=args.limit)

        if args.dry_run:
            kept = 0
            for _ in found:
                kept += 1
                if kept % 5000 == 0:
                    print(f"  {kept} URLs so far…")
                if stop():
                    break
            print(f"\nDry run: {kept} URLs would be queued. Nothing written.")
            return 0

        def progress(seen: int, added: int) -> None:
            print(f"  {seen} discovered, {added} new")

        def until_stopped(items):
            for item in items:
                yield item
                if stop():
                    return

        with SessionLocal() as db:
            added = seed_discovered(
                db, until_stopped(found), source=args.source, on_batch=progress
            )

    print(f"\nQueued {added} new URLs. Run `ingest_foods.py run` to ingest them.")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    extractor = OllamaExtractor(model=args.model) if args.model else OllamaExtractor()
    stop = StopRequested()
    stop.install()

    with httpx.Client() as client:
        # Robots pacing replaces the flat delay: it measures start-to-start, so extraction
        # time counts toward the politeness gap instead of being added on top of it.
        robots = RobotsCache(client=client, default_delay=args.delay)

        with SessionLocal() as db:
            remaining = pending_count(db)
            if not remaining:
                print("Nothing pending.")
                return 0

            print(f"{remaining} pending. Ctrl-C to stop (the page in flight finishes first).")
            stats = run(
                db,
                limit=args.limit,
                source_name=args.source,
                extractor=extractor,
                robots=robots,
                client=client,
                should_stop=stop,
            )

    print(stats.summary())

    if stats.rejection_reasons:
        print("\nMost common rejections:")
        counts: dict[str, int] = {}
        for reason in stats.rejection_reasons:
            key = reason.split("(")[0].strip()
            counts[key] = counts.get(key, 0) + 1
        for reason, count in sorted(counts.items(), key=lambda kv: -kv[1])[:5]:
            print(f"  {count:5}  {reason}")

    return 0


def cmd_status(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        rows = db.execute(
            select(IngestJob.source, IngestJob.status, func.count())
            .group_by(IngestJob.source, IngestJob.status)
            .order_by(IngestJob.source, IngestJob.status)
        ).all()
        foods = db.execute(select(func.count()).select_from(Food)).scalar_one()
        review = db.execute(
            select(func.count()).select_from(Food).where(Food.needs_review.is_(True))
        ).scalar_one()

    if rows:
        print(f"{'source':16} {'status':12} count")
        for source, status, count in rows:
            print(f"{source:16} {status:12} {count}")
    else:
        print("Frontier is empty.")

    print(f"\nFoods stored: {foods} ({review} flagged for review)")
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    discover = sub.add_parser("discover", help="find food URLs from a site's sitemaps")
    discover.add_argument(
        "--source", default="eatthismuch", help="which site adapter to use"
    )
    discover.add_argument(
        "--family",
        action="append",
        choices=sorted(EatThisMuchSource.FAMILY_GROUPS),
        help="which food families to walk (repeatable; default: basic + restaurant)",
    )
    discover.add_argument("--limit", type=int, default=None, help="stop after N URLs")
    discover.add_argument(
        "--dry-run", action="store_true", help="walk and count without writing anything"
    )
    discover.add_argument(
        "--delay", type=float, default=2.0, help="politeness floor, seconds between fetches"
    )
    discover.set_defaults(func=cmd_discover)

    seed = sub.add_parser("seed", help="add URLs from a file to the frontier")
    seed.add_argument("file", help="text file with one URL per line")
    seed.set_defaults(func=cmd_seed)

    run_cmd = sub.add_parser("run", help="process pending URLs")
    run_cmd.add_argument("--limit", type=int, default=None, help="stop after N URLs")
    run_cmd.add_argument("--source", default=None, help="only work this source's URLs")
    run_cmd.add_argument("--model", default=None, help="override the Ollama model")
    run_cmd.add_argument(
        "--delay", type=float, default=DEFAULT_DELAY_SECONDS, help="politeness floor, seconds"
    )
    run_cmd.set_defaults(func=cmd_run)

    status = sub.add_parser("status", help="show frontier and food counts")
    status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
 