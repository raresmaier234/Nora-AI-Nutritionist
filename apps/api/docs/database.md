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
  `app/db/models/__init__.py`. See "Tables" below.

## Tables

| Table | Model | Holds |
|---|---|---|
| `foods` | `Food` | The food database, per 100g: the core label (calories, protein, fat, carbs, fibre, sugar, saturated fat, sodium) plus 70 optional full-profile columns (carbohydrate/fat/protein breakdowns, vitamins, minerals, water, alcohol, caffeine). Filled by the ingestion pipeline. `name` is what the product is, without brand or store ("Lapte de soia"); `brand` and `store` hold those when the source says ("Alpro", "Lidl"). Names are stored with Romanian letters repaired and a capital first letter (`clean_display_name` in `app/utils/naming.py`). `name_normalized` folds name, brand and store together; it is unique (the dedup key, so the same food from two brands is two rows) and has a trigram index for search. `servings` (JSONB) holds the food's own units with the grams one weighs (`[{"unit": "cup", "label": "1 cup", "grams": 249}]`), from USDA's portions or a product's serving size. `package_serving_label` / `package_serving_grams` hold the serving a product's package states. |
| `ingest_jobs` | `IngestJob` | The crawl queue: one row per page to ingest, with its site (`source`), status (`pending`/`done`/`failed`) and last error. |
| `users` | `User` | One row per person using Nora; see "Users" below. |
| `food_log_entries` | `FoodLogEntry` | The food log behind the app's Log Food screen: one row per food logged to a meal on a day, owned by a user (`user_id`). Keeps its own copy of the food's name and per-100g macros. |
| `nutrition_goals` | `NutritionGoal` | Each set of nutrition plan questionnaire answers a user saved, with their consent; see "Nutrition plans" below. |
| `nutrition_plans` | `NutritionPlan` | Plans built from those answers: drafts, the one active plan, and archived ones; see "Nutrition plans" below. |
| `recipes`, `recipe_ingredients` | `Recipe`, `RecipeIngredient` | Scraped recipes and their ingredient lines, optionally matched to a `Food`. |

The full-profile nutrient columns are listed once, in `app/services/ingest/nutrients.py`; the
unit is part of each column name (`leucine_per_100g` is grams, `vitamin_c_mg_per_100g`
milligrams, `folate_ug_per_100g` micrograms).

## Users

Sign-in itself is Supabase Auth's (Google, Apple), recorded in Supabase's own database. The
`users` table holds the rest of what Nora knows about a person. It is created from the access
token the first time the API sees a user (see [architecture.md](architecture.md#authentication)).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, primary key | **The Supabase user id** (the token's `sub`). No foreign key: `auth.users` is in Supabase's database |
| `email` | text, nullable | From the token, kept up to date with it. May be an Apple private relay address. Not unique: Supabase owns identity |
| `display_name` | text, nullable | From Google, or Apple's first sign-in; the user can change it |
| `avatar_url` | text, nullable | Google picture |
| `plan` | text, not null, default `basic` | `basic` or `premium` (check constraint `ck_users_plan`) |
| `plan_expires_at` | timestamptz, nullable | Reserved for subscriptions; `null` = no expiry. A plan past it counts as `basic` |
| `kcal_target`, `protein_target_g`, `carbs_target_g`, `fat_target_g`, `fiber_target_g` | numeric, not null | Daily targets; defaults 2000 / 150 / 220 / 70 / 28. Activating a nutrition plan copies its targets here; they only count in `plan` mode |
| `targets_mode` | text, not null, default `default` | `default` (the defaults are shown), `plan` (the columns above, from the active plan) or `none` (log without targets: no targets at all). Check constraint `ck_users_targets_mode`. A user who isn't premium is shown `default` in place of `plan`, without this column changing |
| `timezone` | text, nullable | The user's IANA time zone, sent by the app; `null` means UTC |
| `created_at`, `updated_at` | timestamptz | |
| `last_seen_at` | timestamptz | Last request, to the hour: only written when an hour old |

**`food_log_entries.user_id`** — UUID, foreign key to `users.id` **on delete cascade** (deleting
a user deletes their log), with an index on `(user_id, logged_on)`, which is what every food
log query asks for. Every query in `app/services/food_log.py` filters on it, and every new
entry sets it.

### The shared log, and the NOT NULL still to come

Before accounts, there was one food log for everyone. Its entries have `user_id` `NULL` and
are invisible to every user. So the column is **nullable for now**, and goes NOT NULL in
three steps:

1. Migration `84b0e5747027` creates `users` and adds the nullable `user_id` (done; it runs
   with every deploy).
2. In **each environment that has entries**, the owner signs in to the app once (creating
   their `users` row), then runs `python scripts/claim_shared_log.py <their email>`, which
   assigns every entry without a user to them (see [development.md](development.md#admin-scripts)).
   Check afterwards that `SELECT count(*) FROM food_log_entries WHERE user_id IS NULL` is 0.
3. **Only then**, a follow-up migration makes `user_id` NOT NULL (and the model's
   `nullable=True` goes). It must not be merged before step 2 has run in every environment:
   deploys run `alembic upgrade head` first, and it would fail on the unclaimed entries.

## Nutrition plans

The premium nutrition plan (see [architecture.md](architecture.md#adaptive-nutrition-plan)).
Both tables belong to a user and are deleted with them (`ON DELETE CASCADE`). Migration
`5c9e2f7a1d43` creates them and adds `users.targets_mode` and `users.timezone`.

**`nutrition_goals`** — one row per set of questionnaire answers saved. Never written for
under-16s.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | |
| `user_id` | UUID, FK `users.id` on delete cascade, indexed | |
| `questionnaire_version` | integer | `2` |
| `answers` | JSONB | Every answer, as validated (`GoalAnswers` in `app/schemas/nutrition_plan.py`), missing ones as `null` |
| `language` | text | `en` or `ro`: plans built from it are written in it |
| `consent_version`, `consented_at` | text, timestamptz | The consent text version the user agreed to, and when (GDPR Art. 9) |
| `created_at` | timestamptz | The latest is the goal in force |

**`nutrition_plans`** — plans built from a goal.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | |
| `user_id` | UUID, FK `users.id` on delete cascade, indexed | |
| `goal_id` | integer, FK `nutrition_goals.id` on delete cascade, indexed | The answers it was built from |
| `status` | text, default `draft` | `draft`, `active` or `archived` (`ck_nutrition_plans_status`). **At most one active per user:** partial unique index `uq_nutrition_plans_one_active_per_user` on `user_id` where `status = 'active'` |
| `reason` | text | `initial`, `change`, and later `review` and `maintenance_transition` (`ck_nutrition_plans_reason`) |
| `previous_plan_id` | integer, FK `nutrition_plans.id` on delete set null | The plan that was active when this one replaced it |
| `goal`, `pace` | text | `lose_fat` / `build_muscle` / `maintain` (`ck_nutrition_plans_goal`); the pace asked for, `null` for Maintain |
| `pattern_key` | text | `goal.pace band.training.phase`: which texts of the pattern library it uses |
| `language` | text | The texts' language; they are rendered when the plan is read, not stored |
| `targets` | JSONB | `{"kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"}`, rounded for display |
| `rate` | JSONB | `{"requested_kg_week", "effective_kg_week", "clamped"}` |
| `notices` | JSONB | `[{"code", "template", "params"}]`, rendered into messages when read |
| `baseline` | JSONB | The unrounded working: age, BMI, BMR, activity multiplier, TDEE, protein weight, rates, macros, the carb floor, rules applied, add-on texts, and the inputs |
| `start_weight_kg`, `target_weight_kg` | numeric | Target `null` for Maintain, and for Build muscle with no target |
| `goal_date`, `weeks` | date, integer, nullable | From the effective rate; `null` for Maintain or when no deficit is possible |
| `created_at`, `activated_at` | timestamptz | `activated_at` is set when it becomes active |

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
