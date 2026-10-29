#!/usr/bin/env python
"""Rebuild the food search index (Elasticsearch) from the foods table.

    python scripts/index_foods.py

Builds a fresh index and switches search over to it in one step, so it is safe to run while
the API is serving. Run it after setting up Elasticsearch, after editing the synonyms in
app/services/food_synonyms.py or the analyzers in app/services/food_index.py, or whenever
the index may have drifted from PostgreSQL. The ingest pipeline keeps it current otherwise.
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

# Allow running as a plain script from the repo root, without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal  # noqa: E402
from app.services.food_index import get_food_index, rebuild  # noqa: E402


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    index = get_food_index()
    if index is None:
        print("ELASTICSEARCH_URL is not set — nothing to index. See docs/development.md.")
        return 1

    started = time.monotonic()
    with SessionLocal() as db:
        count = rebuild(db, index)
    print(f"Indexed {count} foods into '{index.alias}' in {time.monotonic() - started:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
