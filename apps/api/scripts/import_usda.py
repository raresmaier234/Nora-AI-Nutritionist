#!/usr/bin/env python
"""Import USDA FoodData Central generic foods (English, full nutrient profile).

    python scripts/import_usda.py download             # Foundation Foods + SR Legacy, ~25 MB
    python scripts/import_usda.py import --dry-run     # count, write nothing
    python scripts/import_usda.py import
    python scripts/index_foods.py                      # then rebuild the search index

Foundation Foods are imported first: where both datasets have a food of the same name, the
newer lab values are the ones kept. Safe to run again; a food already stored from the same
USDA page only gains values it was missing. See app/services/ingest/sources/usda.py.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path

import httpx

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal  # noqa: E402
from app.services.ingest.normalizer import NormalizationError, normalize_food  # noqa: E402
from app.services.ingest.sources.usda import DATASETS, food_to_raw, food_url, foods  # noqa: E402
from app.services.ingest.store import upsert_food  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "usda"


def dataset_file(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def cmd_download(args: argparse.Namespace) -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in DATASETS.items():
        response = httpx.get(url, follow_redirects=True, timeout=120)
        response.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            [member] = [m for m in archive.namelist() if m.endswith(".json")]
            dataset_file(name).write_bytes(archive.read(member))
        print(f"Saved {name} to {dataset_file(name)}")
    return 0


def cmd_import(args: argparse.Namespace) -> int:
    seen = created = enriched = taken = flagged = 0
    rejected: Counter[str] = Counter()
    with SessionLocal() as db:
        for name in DATASETS:  # Foundation first, so its values win a name clash
            path = dataset_file(name)
            if not path.exists():
                raise SystemExit(f"error: {path} not found; run `import_usda.py download` first")
            for food in foods(json.loads(path.read_text())):
                seen += 1
                raw = food_to_raw(food)
                if raw is None:
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
                    db, normalized, source_url=food_url(food["fdcId"]), raw_extraction=raw
                )
                if outcome.created:
                    created += 1
                elif outcome.name_taken:
                    taken += 1
                else:
                    enriched += 1
                flagged += bool(outcome.similar)
            if not args.dry_run:
                db.commit()
            print(f"  {name}: done ({seen} read so far)", flush=True)

    verb = "would be saved" if args.dry_run else "created"
    print(f"\n{seen} foods read: {created} {verb}, {enriched} already stored, "
          f"{taken} same name as another food, {sum(rejected.values())} rejected, "
          f"{flagged} flagged for review")
    for reason, count in rejected.most_common(6):
        print(f"  {count:6}  {reason}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("download", help="fetch both datasets").set_defaults(func=cmd_download)
    imp = sub.add_parser("import", help="save the downloaded foods")
    imp.add_argument("--dry-run", action="store_true", help="count what would be saved, write nothing")
    imp.set_defaults(func=cmd_import)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
