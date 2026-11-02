#!/usr/bin/env python
"""Import products sold in Romania from the Open Food Facts bulk export.

    # stream the world export (~1.5 GB gzipped) once, keeping only Romania's products
    python scripts/import_openfoodfacts.py download

    # save them through the normal normalizer, checks and dedup
    python scripts/import_openfoodfacts.py import --dry-run    # count, write nothing
    python scripts/import_openfoodfacts.py import --limit 200
    python scripts/import_openfoodfacts.py import

    python scripts/index_foods.py                              # then rebuild the search index

`import` is safe to run again: a product already stored from the same Open Food Facts page
only gains values it was missing. Download again to pick up new products; Open Food Facts
rebuilds the export daily. See app/services/ingest/sources/openfoodfacts.py for the licence.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import sys
from collections import Counter
from pathlib import Path

import httpx

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal  # noqa: E402
from app.services.ingest.normalizer import NormalizationError, normalize_food  # noqa: E402
from app.services.ingest.sources.openfoodfacts import (  # noqa: E402
    EXPORT_URL,
    barcode,
    product_url,
    read_rows,
    romanian_rows,
    row_to_raw,
)
from app.services.ingest.store import upsert_food  # noqa: E402

DEFAULT_FILE = Path(__file__).resolve().parent.parent / "data" / "openfoodfacts-romania.tsv"
# Open Food Facts asks clients to identify themselves.
USER_AGENT = "NoraNutrition/0.1 (food database import)"
COMMIT_EVERY = 500


class _ResponseReader(io.RawIOBase):
    """An httpx streaming response as a file, so gzip can read it as it downloads."""

    def __init__(self, response: httpx.Response) -> None:
        self._chunks = response.iter_raw()
        self._pending = b""
        self.read_bytes = 0

    def readable(self) -> bool:
        return True

    def readinto(self, buffer) -> int:
        while not self._pending:
            try:
                self._pending = next(self._chunks)
            except StopIteration:
                return 0
        size = min(len(buffer), len(self._pending))
        buffer[:size], self._pending = self._pending[:size], self._pending[size:]
        self.read_bytes += size
        return size


def cmd_download(args: argparse.Namespace) -> int:
    out = Path(args.file)
    out.parent.mkdir(parents=True, exist_ok=True)
    partial = out.with_suffix(".partial")
    kept = 0

    with httpx.stream(
        "GET", EXPORT_URL, headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=60
    ) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length") or 0)
        raw = _ResponseReader(response)
        lines = io.TextIOWrapper(gzip.GzipFile(fileobj=io.BufferedReader(raw)), encoding="utf-8")
        rows = read_rows(lines)
        with partial.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=rows.fieldnames, delimiter="\t", quoting=csv.QUOTE_NONE,
                escapechar="\\",
            )
            writer.writeheader()
            for row in romanian_rows(rows):
                writer.writerow(row)
                kept += 1
                if kept % 2000 == 0:
                    done = f"{raw.read_bytes / total:.0%}" if total else f"{raw.read_bytes >> 20} MB"
                    print(f"  {kept} Romanian products so far ({done} downloaded)", flush=True)

    partial.replace(out)
    print(f"\nSaved {kept} products sold in Romania to {out}")
    return 0


def cmd_import(args: argparse.Namespace) -> int:
    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"error: {path} not found; run `import_openfoodfacts.py download` first")

    seen = created = enriched = taken = flagged = skipped = 0
    rejected: Counter[str] = Counter()
    with path.open(encoding="utf-8", newline="") as handle, SessionLocal() as db:
        for row in read_rows(handle):
            if args.limit is not None and seen >= args.limit:
                break
            seen += 1
            raw = row_to_raw(row)
            if raw is None:
                skipped += 1
                continue
            try:
                normalized = normalize_food(raw)
            except NormalizationError as exc:
                rejected[str(exc).split(":")[0]] += 1
                continue
            if args.dry_run:
                created += 1
                continue

            outcome = upsert_food(
                db,
                normalized,
                source_url=product_url(row["code"]),
                raw_extraction=raw,
                barcode=barcode(row["code"]),
            )
            if outcome.created:
                created += 1
            elif outcome.name_taken:
                taken += 1
            else:
                enriched += 1
            flagged += bool(outcome.similar)
            if seen % COMMIT_EVERY == 0:
                db.commit()
                print(f"  {seen} read, {created} new", flush=True)
        if not args.dry_run:
            db.commit()

    verb = "would be saved" if args.dry_run else "created"
    print(f"\n{seen} products read: {created} {verb}, {enriched} already stored, "
          f"{taken} same name as another product, {skipped} without a name or nutrition, "
          f"{sum(rejected.values())} rejected, {flagged} flagged for review")
    for reason, count in rejected.most_common(6):
        print(f"  {count:6}  {reason}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    download = sub.add_parser("download", help="fetch the export, keeping Romania's products")
    download.add_argument("--file", default=str(DEFAULT_FILE), help="where to save them (default: %(default)s)")
    download.set_defaults(func=cmd_download)

    imp = sub.add_parser("import", help="save the downloaded products as foods")
    imp.add_argument("--file", default=str(DEFAULT_FILE), help="the downloaded file (default: %(default)s)")
    imp.add_argument("--limit", type=int, default=None, help="stop after N products")
    imp.add_argument("--dry-run", action="store_true", help="count what would be saved, write nothing")
    imp.set_defaults(func=cmd_import)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
