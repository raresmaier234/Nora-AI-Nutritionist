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

- `app/db/models/` is currently empty. There are **no models yet** — no `User`, `Food`,
  `Meal`, etc. Those are added by whoever builds each feature, not created up front.

## Connection string

Set via the `DATABASE_URL` environment variable (see `.env.example`):

```
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/dbname
```

The `+psycopg` driver suffix tells SQLAlchemy to use `psycopg` (v3), which is already a
project dependency.

## Adding a model (future work)

1. Create `app/db/models/<name>.py` with a class inheriting from `Base`.
2. Import it in `app/db/models/__init__.py` so Alembic's autogenerate can discover it.
3. Run `alembic revision --autogenerate -m "add <name> table"`.
4. Review the generated migration in `alembic/versions/` — autogenerate is a starting point,
   not something to trust blindly.
5. Run `alembic upgrade head`.

## Migrations

Alembic is configured (`alembic.ini`, `alembic/env.py`) to read the database URL from the same
`Settings` object as the app, and to use `Base.metadata` for autogenerate. There are no
migrations yet — `alembic/versions/` is empty until the first model is added.

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
