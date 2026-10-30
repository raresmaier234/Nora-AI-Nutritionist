# Plan: food cache on Valkey

**Status:** planned, not implemented. Decided in October 2026; nothing in the code uses a cache
yet. Prices and sizes below are as of 2026-10-30. Re-check them before acting on them.

## Goal

Keep the foods in PostgreSQL in an in-memory cache, so the API reads them from memory instead of
the database. PostgreSQL stays the source of truth: the cache only ever holds copies, can be
emptied at any time, and the API works exactly as today without it.

Smarter refresh (what to keep, when to reload) is deliberately left for later. For now the cache
holds every food, with a size cap so it can never grow unbounded.

## Decisions

### Valkey, not Redis

[Valkey](https://valkey.io) is the open-source continuation of Redis: BSD-licensed, run by the
Linux Foundation, same protocol and commands. Redis itself is no longer plain open source; it moved to a
tri-license that includes the AGPL. Any Redis client works with Valkey.

- **Server:** `valkey/valkey:8-alpine` (Docker image).
- **Python client:** `redis` (redis-py, MIT). It talks to Valkey unchanged. `valkey`
  (valkey-py) is a drop-in fork if we ever want to match names.

### Hosted on Railway, not Upstash

Valkey runs as one more service in the existing Railway project, next to the API and Postgres.

| | Valkey on Railway | Upstash |
|---|---|---|
| Billing | RAM and CPU used (~$10 per GB-month of RAM) | Per command: free up to 500K/month and 1 database, then $0.20 per 100K, or fixed plans from $10/month |
| Our cost now | ~$0.20–0.50/month per environment, inside the Hobby plan's $5 credit | $0 for one database. Development and production need two, so pay-as-you-go |
| As users grow | Flat: bounded by the memory cap | Grows with every request (≈$36/month at ~10,000 daily users, or the $10 fixed plan) |
| Latency | Railway's private network, same as Postgres | Leaves Railway for AWS/GCP and back, which can cost more than the Postgres read it saves |

Upstash only makes sense for a platform without a private network (serverless functions,
Vercel). Command estimate behind those numbers: opening a food is 1–2 cache commands, and each
search request is 1. Search-as-you-type sends several requests per search, so a typical user
makes ~50–60 commands a day.

## What gets cached

One key per food: **`food:{id}`**. The value is the JSON of `FoodDetail` (`app/schemas/food.py`),
the exact body `GET /api/v1/foods/{id}` returns: name, `per_100g` and the full nutrient list.
Search results are built from the same entry (`id`, `name`, `per_100g`).

### Sizes, measured on the real data (1,092 foods)

| | Stored JSON | In Valkey, with per-key overhead |
|---|---|---|
| Label-only food (82% of foods) | ~170 B | ~0.3 KB |
| Full-profile food (18%) | ~2.75 KB | ~3.5 KB |
| Average | ~640 B | ~1 KB |
| All 1,092 foods | 0.7 MB | ~1–2 MB |

Growth: `ingest_jobs` has ~142,000 pending pages, and so far ~0.87 foods come out of each page,
so finishing the queue gives roughly **125,000 foods**:

- Cache everything at today's mix: ~125 MB.
- Cache everything if most foods have full profiles: ~450 MB.
- In practice, with least-recently-used eviction, only the foods people actually search for
  and open stay in memory. That's tens of MB even with thousands of users.

### Size cap

Valkey runs with `--maxmemory 128mb --maxmemory-policy allkeys-lru` (256 MB locally). When it's
full, it evicts the least recently used foods; an evicted food is reloaded from Postgres on its
next read. Raise the cap only if the eviction count (`evicted_keys`) climbs and the hit rate
(`keyspace_hits` / `keyspace_misses`) drops. Both appear in `INFO stats`.

## Where reads go through the cache

| Path | Today | With the cache |
|---|---|---|
| `GET /api/v1/foods/{id}` (Food Details, Day Nutrition) | `get_food_detail` in `app/services/food_details.py`: `db.get(Food, id)` | Cache-aside: `GET food:{id}`. On a miss, read Postgres, build `FoodDetail`, `SET food:{id} … EX 86400`. Unknown ids stay a 404 and are not cached |
| `GET /api/v1/foods?q=` after Elasticsearch | `_load_in_order` in `app/services/food_search.py`: one `SELECT … WHERE id IN (…)` | `MGET food:{id1} food:{id2} …`. Load only the misses from Postgres, then fill them in the cache. Keep the order and the `_loggable` filter |

**Not cached, on purpose:**

- **`POST /api/v1/meals/entries` with `food_id`** (`app/services/food_log.py`): a logged entry
  copies the food's values, so it must read Postgres and never a possibly stale copy.
- **The Postgres fallback search** (`_search_postgres`): it matches names in SQL, so there is no
  list of ids to look up.

## Keeping it correct

- **Warm-up:** `python scripts/cache_foods.py` loads every food into the cache, mirroring
  `scripts/index_foods.py` (batches of ~500, pipelined `SET`s with `EX`). Run it after setting
  up Valkey, or any time the cache was emptied. It's optional: reads fill the cache anyway.
- **Ingestion:** `scripts/ingest_foods.py` already gets the ids of each page's new and changed
  foods after commit (`keep_index_current`, through `run(..., on_saved=…)` in
  `app/services/ingest/pipeline.py`). Add `DEL food:{id} …` for those ids next to the index
  update, also best effort: a cache failure must not fail the page.
- **Expiry:** every entry has a 24-hour TTL as a safety net, for anything that changes foods
  outside ingestion.
- **Down or slow cache:** use short timeouts (connect and read ~0.2 s). On any cache error,
  log a warning and read Postgres, the same way search falls back when Elasticsearch fails. The
  API must never fail because of the cache.

## Configuration

- **`CACHE_URL`**, optional, e.g. `redis://localhost:6379/0`. Added to `Settings` in
  `app/core/config.py` like `elasticsearch_url`. Unset means no cache, and the API behaves
  exactly as today.
- **Key prefix:** a constant `food:`. If the cached shape ever changes incompatibly, add a
  version (`food:v2:{id}`) rather than migrating entries.

## Implementation steps

1. **Dependency:** add `redis>=5` to `pyproject.toml`, and install it into the repo-root `.venv`
   that runs the server.
2. **Config:** `cache_url: str | None = None` in `Settings`, documented next to the
   Elasticsearch settings.
3. **`app/services/food_cache.py`:** a `FoodCache` holding the client, with `get_many(ids)`,
   `set_many(details)` and `delete(ids)`. A `get_food_cache()` dependency returns `None` when
   `CACHE_URL` is unset, following `get_food_index()` in `food_index.py`. Values are serialized
   with `FoodDetail.model_dump_json()` / `model_validate_json()`.
4. **Food details:** `get_food_detail` takes the cache and does cache-aside. The route gets the
   cache through `Depends(get_food_cache)`.
5. **Search:** `_load_in_order` (or a wrapper around it) reads through the cache. The route
   builds `FoodSearchResult` from the cached `FoodDetail` or the ORM row; both carry the same
   fields.
6. **Ingestion hook:** delete changed ids in `scripts/ingest_foods.py` next to
   `keep_index_current`.
7. **Warm-up script:** `scripts/cache_foods.py`.
8. **Local service:** a `cache` service in `docker-compose.yml`:
   ```yaml
   cache:
     image: valkey/valkey:8-alpine
     command: valkey-server --maxmemory 256mb --maxmemory-policy allkeys-lru --save "" --appendonly no
     ports:
       - "127.0.0.1:6379:6379"
   ```
   No volume and no persistence (`--save ""`, `--appendonly no`). It's a cache and refills
   from Postgres. Listening on localhost only, like Elasticsearch.
9. **Tests:** `tests/conftest.py` overrides the cache dependency to `None` by default, like
   `get_food_index`. New tests:
   - A fake in-memory `FoodCache`: a hit skips Postgres, a miss fills the cache, an unknown id
     stays a 404 and isn't cached.
   - Search: misses are filled, and the order and `_loggable` filter are kept.
   - A cache that raises on every call: both endpoints still answer from Postgres.
   - Optional, like the Elasticsearch tests: one test against a real Valkey on localhost:6379
     that skips itself when none is running.
10. **Docs:** `architecture.md` gets a "Food cache" section next to "Food search".
    `development.md` gets `docker compose up -d cache`, `CACHE_URL` and the warm-up script.
    `api.md` notes that the two endpoints read through the cache, with responses unchanged.
    Then mark this plan as done or delete it.

## Deploying on Railway

Per environment (development and production each get their own cache, like Postgres):

1. **+ Create → Docker Image →** `valkey/valkey:8-alpine`, and name the service `Valkey`.
2. **Start command:** `valkey-server --maxmemory 128mb --maxmemory-policy allkeys-lru --save "" --appendonly no`.
3. **No public domain and no volume.** It's reached only over the private network.
4. On the API service, set **`CACHE_URL=redis://${{Valkey.RAILWAY_PRIVATE_DOMAIN}}:6379`**.
5. Optionally warm it after the first deploy: run `python scripts/cache_foods.py` with
   `CACHE_URL` pointing at the cache, or just let reads fill it.

Expected cost: under $1/month per environment.

## Hosting cost context

From the same discussion (Railway pricing on 2026-10-30: about $10 per GB of RAM per month and
$20 per vCPU per month, billed on use):

- **Plan:** Hobby, $5/month including $5 of usage. The Free plan (0.5 GB RAM per service,
  3 services, 1 project) is too small for API + Postgres + cache.
- **Per environment:** API ~$2–3, Postgres ~$2–3, Valkey under $1. **Elasticsearch ~$11–16**
  is the expensive part, so leave it off until the food count needs it. Search then falls
  back to Postgres on its own.
- **Cheapest production setup:** production always on (API + Postgres + Valkey) for
  ~$5–10/month total. The development API sleeps when idle, or development happens locally
  only.

## Later (out of scope now)

- A smarter refresh policy: only hot foods, refresh-ahead, or invalidation from database
  events instead of TTL.
- Caching other data (search responses per query, per-user day summaries) once user accounts
  exist.
- Compressing entries if full-profile foods come to dominate the cache's size.
