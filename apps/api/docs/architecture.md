# Architecture

## Overall architecture

```
Expo Mobile App
       |
       | HTTPS
       v
    FastAPI
       |
       +---- PostgreSQL       (source of truth)
       |
       +---- Elasticsearch    (food search index, derived from PostgreSQL)
       |
       +---- External APIs   (planned)
       |
       +---- AI services     (planned)
```

The mobile app (a separate Expo/React Native/TypeScript repository) never talks to PostgreSQL
or holds private API keys. It only ever calls this API over HTTPS.

This is a simple modular monolith, not a microservice architecture. There is one deployable
service. Business logic is split into route handlers and (when a route grows non-trivial
logic) services — nothing more layered than that.

## Request flow

```
route  ->  (service, only if the logic warrants one)  ->  database / external API / AI service
```

Most routes today are placeholders and don't need a service at all — the route handler is the
whole implementation. Add a service module only once a route's logic is more than "validate
input, call the DB, return a schema."

## Folder responsibilities (current implementation)

- **`app/main.py`** — creates the FastAPI app, configures CORS, registers `api_router`. This is
  the process entrypoint (`uvicorn app.main:app`).
- **`app/api/router.py`** — combines every route module in `app/api/routes/` under the
  `/api/v1` prefix. This is the only place that needs to change when a new route group is
  added.
- **`app/api/routes/`** — one file per route group (`health.py`, `auth.py`, `users.py`,
  `foods.py`, `barcodes.py`, `meals.py`, `nutrition.py`). Only `health.py` is fully
  implemented; the rest are placeholders (see [api.md](api.md)). Route handlers should stay
  focused on HTTP concerns: parsing input, calling a service or the DB, returning a schema.
- **`app/core/config.py`** — a single `Settings` object (pydantic-settings) loaded from
  environment variables / `.env`. Anything configurable (database URL, CORS origins, secrets)
  goes here, not scattered `os.environ` calls.
- **`app/db/database.py`** — the SQLAlchemy `engine` and declarative `Base` that models inherit
  from.
- **`app/db/session.py`** — `get_db()`, a FastAPI dependency that yields a `Session` per
  request and closes it afterwards.
- **`app/db/models/`** — empty right now. Future SQLAlchemy models (`User`, `Food`, `Meal`,
  etc.) go here, one file per model, imported into `models/__init__.py` so Alembic's
  autogenerate can find them.
- **`app/schemas/`** — empty right now. Future Pydantic request/response schemas go here.
  Schemas are kept separate from SQLAlchemy models on purpose — a database row and an API
  response are different shapes with different concerns (e.g. hiding a password hash).
- **`app/services/`** — business logic that doesn't fit cleanly in a route handler
  (multi-step operations, calls to external APIs, orchestration): the food log, food search
  and its index, the ingestion pipeline, scraping.
- **`tests/`** — pytest tests using FastAPI's `TestClient`.
- **`alembic/`** — the Alembic migration environment, pointed at `app.db.database.Base`.

## Food search

`GET /api/v1/foods` runs on an Elasticsearch index of the `foods` table
(`app/services/food_index.py`); PostgreSQL stays the source of truth.

- **Derived, disposable.** The index can be deleted and rebuilt from PostgreSQL at any time
  with `python scripts/index_foods.py`. Search only takes matching ids from it and loads the
  foods from PostgreSQL, so a stale document can never show stale values.
- **Zero-downtime rebuilds.** Search reads the `foods` alias. A rebuild fills a new
  timestamped index, then moves the alias onto it in one step and deletes the old one.
- **Kept current by ingestion.** `scripts/ingest_foods.py run` indexes each page's new and
  changed foods once they are committed. If Elasticsearch is down it carries on, and the next
  rebuild catches up.
- **Optional.** Without `ELASTICSEARCH_URL`, or when the index doesn't answer, search runs on
  PostgreSQL (trigram matching) with the same response, so nothing else depends on it.
- **One document per food:** its name, analyzed several ways (as written, Romanian and
  English word forms, synonyms in the other language, prefixes for as-you-type), and its
  macros per 100 g. Synonyms (`app/services/food_synonyms.py`) are applied while indexing, so
  editing them needs a rebuild.

## Where future integrations should live

- **External APIs** (e.g. a barcode/nutrition database lookup) — a small client module under
  `app/services/`, called from the relevant route (e.g. `barcodes.py`). Don't build a generic
  "external API client" abstraction until there's a second integration that actually needs to
  share code with the first.
- **AI services** (food photo recognition, nutrition estimation) — same pattern: a service
  module under `app/services/` that the `nutrition`/`foods` routes call into. Model calls,
  prompt construction, etc. belong there, not in the route handler.

## Current implementation vs. future intent

**Implemented now:**

- `GET /api/v1/health`
- FastAPI app with CORS
- SQLAlchemy models and Alembic migrations (see [database.md](database.md))
- Food database, filled by the ingestion pipeline (`scripts/ingest_foods.py`)
- Food search (`GET /api/v1/foods`) on Elasticsearch, with PostgreSQL as fallback
- Food logging (`/api/v1/meals/entries`)
- Placeholder routers for auth/users/barcodes/nutrition (each returns `501 Not Implemented`)

**Not implemented yet (planned):**

- Authentication
- User profiles
- Barcode lookup
- Calorie and macronutrient tracking
- Daily nutrition summaries
- Food photo uploads
- AI food recognition
- AI nutrition estimation

Do not assume any of the "planned" items exist in the code — check `app/api/routes/` and
`app/db/models/` for what's actually there.
