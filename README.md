# Nora AI Nutritionist API

Backend API for the Nora AI Nutritionist mobile application (Expo / React Native).

## What this is

A FastAPI service that will eventually sit between the mobile app and PostgreSQL / external
APIs / AI services. The mobile app never talks to the database or private API keys directly —
everything goes through this API.

```
Expo Mobile App
       |
       | HTTPS
       v
    FastAPI  ---- PostgreSQL
       |
       +------- External APIs
       |
       +------- AI services
```

Right now this is a skeleton: one real endpoint (`/api/v1/health`), a database foundation
(SQLAlchemy + Alembic) with no models yet, and placeholder route groups for the features
described in [docs/architecture.md](docs/architecture.md).

## Technology stack

- Python 3.11+
- FastAPI
- Pydantic / pydantic-settings
- SQLAlchemy
- PostgreSQL
- Alembic
- pytest / httpx
- uvicorn

## Project structure

```
app/
├── main.py             FastAPI app instance, middleware, router registration
├── api/
│   ├── router.py        combines all route modules under /api/v1
│   └── routes/          one file per route group (health, auth, users, foods, ...)
├── core/
│   └── config.py        Settings (env vars) via pydantic-settings
├── db/
│   ├── database.py       SQLAlchemy engine + declarative Base
│   ├── session.py        get_db() FastAPI dependency
│   └── models/           SQLAlchemy models (empty so far)
├── schemas/              Pydantic request/response schemas (empty so far)
└── services/              business logic that doesn't belong in a route (empty so far)

tests/                    pytest tests
alembic/                  Alembic migration environment
docs/                     architecture, API, database, and dev docs
```

See [docs/architecture.md](docs/architecture.md) for what each folder is responsible for.

## Local setup

### 1. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -e .
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at least `DATABASE_URL` to point at your local PostgreSQL instance.
See [docs/database.md](docs/database.md) for setup notes.

## Running the server

Either of these works — both start the same app:

```bash
uvicorn app.main:app --reload
```

```bash
python -m app.main
```

Use the `uvicorn` CLI form day-to-day (auto-reload is explicit and it's the standard way to run
FastAPI). `python -m app.main` is there for running the API without remembering the `uvicorn`
invocation — host/port/reload for that path come from `APP_HOST` / `APP_PORT` / `DEBUG` in
`.env`. Note it must be run as a module (`python -m app.main`, not `python app/main.py`), since
the latter breaks the `app.*` imports.

Swagger:
http://127.0.0.1:8000/docs

ReDoc:
http://127.0.0.1:8000/redoc

OpenAPI:
http://127.0.0.1:8000/openapi.json

Health check: http://127.0.0.1:8000/api/v1/health

All three are generated automatically by FastAPI from the route definitions — no separate
Swagger package, setup, or hand-maintained spec file is required. See
[docs/api.md](docs/api.md) for how endpoints are organized and documented.

## Running tests

```bash
pytest
```

## Database migrations (Alembic)

```bash
# generate a migration from model changes
alembic revision --autogenerate -m "message"

# apply migrations
alembic upgrade head
```

See [docs/development.md](docs/development.md) for the full day-to-day workflow (adding
routes, schemas, models, etc.).

## Documentation

- [docs/architecture.md](docs/architecture.md) — current architecture and where things live
- [docs/api.md](docs/api.md) — current and planned API surface
- [docs/database.md](docs/database.md) — database setup
- [docs/development.md](docs/development.md) — day-to-day development workflow
