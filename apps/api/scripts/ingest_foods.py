#!/usr/bin/env python
"""Command line entry point for the food ingestion pipeline.

The crawler only touches the websites listed in `sites.toml` (next to this folder; pass
`--sites` to use another file). Edit that file to add or remove sites.

    # find food URLs from the listed sites' sitemaps
    python scripts/ingest_foods.py discover --dry-run          # walk and count, write nothing
    python scripts/ingest_foods.py discover                    # every listed site
    python scripts/ingest_foods.py discover --site www.kaufland.ro

    # or add URLs by hand; any URL not on a listed site is refused
    python scripts/ingest_foods.py seed urls.txt

    # work the frontier until it empties or you press Ctrl-C
    python scripts/ingest_foods.py run
    python scripts/ingest_foods.py run --limit 100 --site www.eatthismuch.com

    # retry failed jobs (Ollama was down, a site timed out)
    python scripts/ingest_foods.py requeue --site www.kaufland.ro

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
from elasticsearch import ApiError, TransportError
from sqlalchemy import func, select

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal, engine  # noqa: E402
from app.db.models.food import Food  # noqa: E402
from app.db.models.ingest_job import IngestJob  # noqa: E402
from app.services.food_index import get_food_index, index_foods  # noqa: E402
from app.services.ingest.extractor import OllamaExtractor  # noqa: E402
from app.services.ingest.pipeline import (  # noqa: E402
    pending_count,
    requeue,
    run,
    seed_discovered,
    seed_urls,
)
from app.services.ingest.sites import SiteList, SitesFileError, load_sites  # noqa: E402
from app.services.ingest.sources import discover_site  # noqa: E402
from app.services.scraping.robots import DEFAULT_CRAWL_DELAY_SECONDS, RobotsCache  # noqa: E402

DEFAULT_SITES_FILE = Path(__file__).resolve().parent.parent / "sites.toml"


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


def load_site_list(path: str) -> SiteList:
    try:
        return load_sites(path)
    except SitesFileError as exc:
        raise SystemExit(f"error: {exc}") from None


def selected_sites(sites: SiteList, hosts: list[str] | None) -> list:
    if not hosts:
        return list(sites.sites)
    try:
        return [sites.get(host.lower()) for host in hosts]
    except KeyError as exc:
        raise SystemExit(f"error: {exc.args[0]}") from None


def cmd_seed(args: argparse.Namespace) -> int:
    sites = load_site_list(args.sites)
    lines = (line.strip() for line in Path(args.file).read_text().splitlines())
    urls = [line for line in lines if line and not line.startswith("#")]
    if not urls:
        print(f"No URLs found in {args.file}")
        return 1

    with SessionLocal() as db:
        result = seed_urls(db, urls, sites=sites)

    accepted = len(urls) - len(result.rejected)
    print(f"Seeded {result.added} new URLs ({accepted - result.added} were already in the queue)")

    if result.rejected:
        print(f"\nRefused {len(result.rejected)} URLs not on a site listed in {args.sites}:")
        for url in result.rejected[:20]:
            print(f"  {url}")
        if len(result.rejected) > 20:
            print(f"  … and {len(result.rejected) - 20} more")
    return 0


def cmd_discover(args: argparse.Namespace) -> int:
    sites = load_site_list(args.sites)
    targets = selected_sites(sites, args.site)
    stop = StopRequested()
    stop.install()

    total_added = 0
    with httpx.Client() as client:
        robots = RobotsCache(client=client, default_delay=args.delay, allowed_hosts=sites.hosts)

        for site in targets:
            if stop():
                break
            print(f"\n{site.host} (paths: {', '.join(site.paths)}) — Ctrl-C to stop")

            found = discover_site(site, robots=robots, limit=args.limit)

            if args.dry_run:
                kept = 0
                for _ in found:
                    kept += 1
                    if kept % 5000 == 0:
                        print(f"  {kept} URLs so far…")
                    if stop():
                        break
                print(f"  dry run: {kept} URLs would be queued")
                continue

            def progress(seen: int, added: int) -> None:
                print(f"  {seen} discovered, {added} new")

            def until_stopped(items):
                for item in items:
                    yield item
                    if stop():
                        return

            with SessionLocal() as db:
                total_added += seed_discovered(
                    db, until_stopped(found), source=site.host, on_batch=progress
                )

    if args.dry_run:
        print("\nDry run: nothing written.")
    else:
        print(f"\nQueued {total_added} new URLs. Run `ingest_foods.py run` to ingest them.")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    sites = load_site_list(args.sites)
    if args.site:
        selected_sites(sites, [args.site])  # fail fast on a host that isn't listed
    extractor = OllamaExtractor(model=args.model) if args.model else OllamaExtractor()
    stop = StopRequested()
    stop.install()

    with httpx.Client() as client:
        # Paces start-to-start, so extraction time counts toward the politeness gap
        # instead of being added on top of it.
        robots = RobotsCache(client=client, default_delay=args.delay, allowed_hosts=sites.hosts)

        with SessionLocal() as db:
            site = args.site.lower() if args.site else None
            remaining = pending_count(db, site=site)
            if not remaining:
                print("Nothing pending.")
                return 0

            print(f"{remaining} pending. Ctrl-C to stop (the page in flight finishes first).")
            # New and changed foods go into the search index as each page commits, so they
            # are searchable straight away. Best effort: if Elasticsearch is down the run
            # carries on, and `python scripts/index_foods.py` catches the index up later.
            index = get_food_index()

            def keep_index_current(food_ids: list[int]) -> None:
                try:
                    index_foods(db, index, food_ids)
                except (ApiError, TransportError) as exc:
                    logging.getLogger(__name__).warning(
                        "search index not updated (%s); run scripts/index_foods.py later", exc
                    )

            stats = run(
                db,
                sites=sites,
                robots=robots,
                extractor=extractor,
                limit=args.limit,
                site=site,
                should_stop=stop,
                on_saved=keep_index_current if index is not None else None,
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


def cmd_requeue(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        count = requeue(
            db, site=args.site.lower() if args.site else None, include_done=args.include_done
        )
    kind = "failed and finished" if args.include_done else "failed"
    print(f"Requeued {count} {kind} jobs. Run `ingest_foods.py run` to process them.")
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
        print(f"{'site':28} {'status':12} count")
        for source, status, count in rows:
            print(f"{source:28} {status:12} {count}")
    else:
        print("Frontier is empty.")

    print(f"\nFoods stored: {foods} ({review} flagged for review)")
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    # DEBUG=true in .env makes the engine echo every SQL statement, which buries the
    # crawl's own progress; the API server keeps that behaviour, this script does not.
    engine.echo = False
    # Every fetch would otherwise log a line of its own.
    logging.getLogger("httpx").setLevel(logging.WARNING)

    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    def add_sites_option(command: argparse.ArgumentParser) -> None:
        command.add_argument(
            "--sites",
            default=str(DEFAULT_SITES_FILE),
            help="TOML file listing the websites the crawler may touch (default: %(default)s)",
        )

    def add_delay_option(command: argparse.ArgumentParser) -> None:
        command.add_argument(
            "--delay",
            type=float,
            default=DEFAULT_CRAWL_DELAY_SECONDS,
            help="politeness floor, seconds between requests to one site (default: %(default)s)",
        )

    discover = sub.add_parser("discover", help="find food URLs from the listed sites' sitemaps")
    add_sites_option(discover)
    discover.add_argument(
        "--site", action="append", help="only this host (repeatable; default: every listed site)"
    )
    discover.add_argument("--limit", type=int, default=None, help="stop after N URLs per site")
    discover.add_argument(
        "--dry-run", action="store_true", help="walk and count without writing anything"
    )
    add_delay_option(discover)
    discover.set_defaults(func=cmd_discover)

    seed = sub.add_parser("seed", help="add URLs from a file to the frontier")
    add_sites_option(seed)
    seed.add_argument("file", help="text file with one URL per line")
    seed.set_defaults(func=cmd_seed)

    run_cmd = sub.add_parser("run", help="process pending URLs")
    add_sites_option(run_cmd)
    run_cmd.add_argument("--limit", type=int, default=None, help="stop after N URLs")
    run_cmd.add_argument("--site", default=None, help="only work this host's URLs")
    run_cmd.add_argument("--model", default=None, help="override the Ollama model")
    add_delay_option(run_cmd)
    run_cmd.set_defaults(func=cmd_run)

    requeue_cmd = sub.add_parser("requeue", help="put failed jobs back in the queue")
    requeue_cmd.add_argument("--site", default=None, help="only this host's jobs")
    requeue_cmd.add_argument(
        "--include-done",
        action="store_true",
        help="also re-process finished jobs (after an extraction fix, say)",
    )
    requeue_cmd.set_defaults(func=cmd_requeue)

    status = sub.add_parser("status", help="show frontier and food counts")
    status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
 