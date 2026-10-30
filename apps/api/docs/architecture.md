# Architecture

## Overall architecture

```
Expo Mobile App ---- sign in, refresh tokens ----> Supabase Auth (Google, Apple)
       |                                                 |
       | HTTPS + Supabase access token                   | public signing keys (JWKS)
       v                                                 |
    FastAPI  <-------------------------------------------+
       |
       +---- PostgreSQL       (source of truth: users, food log, foods)
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
- **`app/api/routes/`** — one file per route group (`health.py`, `users.py`, `foods.py`,
  `barcodes.py`, `meals.py`, `nutrition.py`). `barcodes.py` and `nutrition.py` are still
  placeholders (see [api.md](api.md)). Route handlers should stay focused on HTTP concerns:
  parsing input, calling a service or the DB, returning a schema.
- **`app/core/config.py`** — a single `Settings` object (pydantic-settings) loaded from
  environment variables / `.env`. Anything configurable (database URL, CORS origins, secrets)
  goes here, not scattered `os.environ` calls.
- **`app/db/database.py`** — the SQLAlchemy `engine` and declarative `Base` that models inherit
  from.
- **`app/db/session.py`** — `get_db()`, a FastAPI dependency that yields a `Session` per
  request and closes it afterwards.
- **`app/db/models/`** — SQLAlchemy models (`User`, `Food`, `FoodLogEntry`, …), one file per
  model, imported into `models/__init__.py` so Alembic's autogenerate can find them. See
  [database.md](database.md).
- **`app/schemas/`** — Pydantic request/response schemas. Schemas are kept separate from
  SQLAlchemy models on purpose — a database row and an API response are different shapes with
  different concerns (e.g. never sending internal columns).
- **`app/services/`** — business logic that doesn't fit cleanly in a route handler
  (multi-step operations, calls to external APIs, orchestration): sign-in (`auth.py`), users
  and plans, the Supabase admin client, the food log, food search and its index, the
  ingestion pipeline, scraping.
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

## Authentication

Signing in is **Supabase Auth**, with Google and Apple. Supabase runs the sign-in flows, issues
and refreshes tokens and keeps the sign-in records (`auth.users`, in Supabase's database). This
API only **verifies** the access tokens; everything about the person as a Nora user — profile,
plan, daily targets, food log — is in our PostgreSQL. Supabase's database is not used for app
data. The decisions behind this are in [plans/auth-and-user-profiles.md](plans/auth-and-user-profiles.md).

- **One id.** The Supabase user id (the token's `sub`) **is** `users.id`. There is no foreign
  key to `auth.users`; the two live in different databases.
- **Token verification** (`app/services/auth.py`, dependency `get_current_user`): the
  `Authorization: Bearer` token is checked with PyJWT against the project's public keys,
  fetched from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` by one `PyJWKClient` per
  process, which caches them and refetches on expiry or when a token names an unknown key
  (rotation). Only `ES256` and `RS256` are accepted — never `HS256`, the legacy shared secret.
  The token must have `iss` = `<SUPABASE_URL>/auth/v1`, `aud` = `authenticated`, an unexpired
  `exp` (30 s of clock skew allowed), `role` = `authenticated`, a UUID `sub`, and must not be
  an anonymous session (`is_anonymous`). Any failure is `401`. No Supabase secret is needed to
  verify; the API only needs `SUPABASE_URL` and internet access to fetch the keys once.
- **Fail closed.** Without `SUPABASE_URL`, `get_current_user` answers `503` to every request;
  there is no anonymous mode. If the keys can't be fetched it is also `503` rather than `401`,
  which would sign the user out over a network blip.
- **The user row is created on first sight** (`app/services/users.py`, `get_or_create`).
  There is no sign-up step: the first valid token for a new `sub` creates the row from the
  token's email, name and avatar (`INSERT … ON CONFLICT DO NOTHING`, since the app's first
  requests arrive together). Afterwards it writes only when something changed — the email in
  the token, a name or avatar the row lacks — or when `last_seen_at` is over an hour old, so
  most requests are one primary-key `SELECT`.
- **Plans.** `users.plan` is `basic` (default) or `premium`, kept in our database next to the
  data it unlocks; payments will set it later (`plan_expires_at` is reserved for that). A
  plan past its `plan_expires_at` counts as `basic`. `require_plan("premium")` is the
  dependency for gated endpoints (`403` otherwise); nothing uses it yet. Until payments exist,
  `scripts/set_plan.py` sets a plan by hand.
- **Account deletion** (`DELETE /api/v1/users/me`) calls Supabase's admin API
  (`app/services/supabase_admin.py`, with `SUPABASE_SECRET_KEY`) to delete the Supabase user
  first, then deletes the `users` row; the food log goes with it (`ON DELETE CASCADE`). If
  Supabase fails, nothing is deleted.
- **Tests never call Supabase.** They make an ES256 key pair, override `get_token_verifier`
  with its public key and a test issuer, and sign their own tokens (`tests/auth_tokens.py`).

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
- Food logging (`/api/v1/meals/entries`), one log per user
- Authentication: Supabase Auth access tokens, required by every endpoint except health (see
  [Authentication](#authentication))
- User profiles (`/api/v1/users/me`): name, avatar, daily targets, basic/premium plan, and
  account deletion
- Placeholder routers for barcodes/nutrition (each returns `501 Not Implemented`)

**Not implemented yet (planned):**

- From [plans/auth-and-user-profiles.md](plans/auth-and-user-profiles.md): making
  `food_log_entries.user_id` NOT NULL once the shared log is claimed everywhere (see
  [database.md](database.md)); Apple token revocation on account deletion, if Supabase doesn't
  do it; payments that set the plan
- Barcode lookup
- Calorie and macronutrient tracking
- Daily nutrition summaries
- Food photo uploads
- AI food recognition
- AI nutrition estimation
- An AI-built nutrition plan from the user's answers about their goals, proposed in
  [plans/ai-nutrition-plan.md](plans/ai-nutrition-plan.md)
- A Valkey cache of the foods in front of PostgreSQL. Decided, with the steps written down, in
  [plans/food-cache.md](plans/food-cache.md)

Do not assume any of the "planned" items exist in the code — check `app/api/routes/` and
`app/db/models/` for what's actually there.
