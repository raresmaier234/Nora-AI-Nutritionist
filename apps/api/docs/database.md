# Database

## Stack

- **PostgreSQL** — the only supported database.
- **SQLAlchemy** (2.x, declarative) — ORM / query layer.
- **Alembic** — schema migrations.

## Current setup

- `app/db/database.py` creates a single SQLAlchemy `engine` from `settings.database_url` and
  defines `Base`, the declarative base class every model will inherit from.
- `app/db/session.py` defines `get_db()`, a FastAPI dependency that yields a `Session` for the
  lifetime of a single request and always closes it:

  ```python
  from fastapi import Depends
  from sqlalchemy.orm import Session
  from app.db.session import get_db

  @router.get("/example")
  def example(db: Session = Depends(get_db)):
      ...
  ```

- Models live in `app/db/models/`, one file per table, each registered in
  `app/db/models/__init__.py`. There is no `User` model yet — see "Tables" below.

## Tables

| Table | Model | Holds |
|---|---|---|
| `foods` | `Food` | The food database, per 100g: the core label (calories, protein, fat, carbs, fibre, sugar, saturated fat, sodium) plus 70 optional full-profile columns (carbohydrate/fat/protein breakdowns, vitamins, minerals, water, alcohol, caffeine). Filled by the ingestion pipeline. `name_normalized` is unique (the dedup key) and has a trigram index for search. |
| `ingest_jobs` | `IngestJob` | The crawl queue: one row per page to ingest, with its site (`source`), status (`pending`/`done`/`failed`) and last error. |
| `food_log_entries` | `FoodLogEntry` | The food log behind the app's Log Food screen: one row per food logged to a meal on a day. Keeps its own copy of the food's name and per-100g macros. No `user_id` until accounts exist. |
| `recipes`, `recipe_ingredients` | `Recipe`, `RecipeIngredient` | Scraped recipes and their ingredient lines, optionally matched to a `Food`. |

The full-profile nutrient columns are listed once, in `app/services/ingest/nutrients.py`; the
unit is part of each column name (`leucine_per_100g` is grams, `vitamin_c_mg_per_100g`
milligrams, `folate_ug_per_100g` micrograms).

## Connection string

Set via the `DATABASE_URL` environment variable (see `.env.example`):

```
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/dbname
```

The `+psycopg` driver suffix tells SQLAlchemy to use `psycopg` (v3), which is already a
project dependency.

## Adding a model

1. Create `app/db/models/<name>.py` with a class inheriting from `Base`.
2. Import it in `app/db/models/__init__.py` so Alembic's autogenerate can discover it.
3. Run `alembic revision --autogenerate -m "add <name> table"`.
4. Review the generated migration in `alembic/versions/` — autogenerate is a starting point,
   not something to trust blindly.
5. Run `alembic upgrade head`.

## Migrations

Alembic is configured (`alembic.ini`, `alembic/env.py`) to read the database URL from the same
`Settings` object as the app, and to use `Base.metadata` for autogenerate. Migrations live in
`alembic/versions/`; `alembic check` confirms the models and the database agree.

```bash
alembic revision --autogenerate -m "message"
alembic upgrade head
```

## Local PostgreSQL

Any local PostgreSQL install works, as long as `DATABASE_URL` points at it. If you'd rather not
install PostgreSQL directly, `docker-compose.yml` in the repo root starts a local instance:

```bash
docker compose up -d
```

Compose reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from your `.env` file (see
`.env.example`) — there is no hardcoded fallback, so `.env` must be set up first.

### pgAdmin

`docker compose up -d` also starts [pgAdmin](https://www.pgadmin.org/), a web UI for browsing the
local Postgres database, at http://localhost:5050. Log in with the `PGADMIN_DEFAULT_EMAIL` /
`PGADMIN_DEFAULT_PASSWORD` values from your `.env` file.

pgAdmin doesn't come pre-connected to the `db` container. As a one-time manual step, register it
yourself: in the pgAdmin UI, right-click **Servers** > **Register** > **Server**, give it any name,
then on the **Connection** tab set host `db`, port `5432`, and the `POSTGRES_USER` /
`POSTGRES_PASSWORD` / `POSTGRES_DB` values from your `.env` file.
