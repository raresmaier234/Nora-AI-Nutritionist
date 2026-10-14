# API

## Versioning

Every application endpoint is served under `/api/v1/`. There is no unversioned API surface —
`app/api/router.py` mounts all route modules under that single prefix, so this is enforced in
one place rather than repeated per route.

If a breaking change is ever needed, a new prefix (`/api/v2/`) would be added alongside `v1`,
not by mutating `v1` in place. That's not needed yet — just noted here so the convention is
clear before it matters.

## Endpoint organization

Each resource gets its own module in `app/api/routes/` and its own Swagger tag:

| Module                         | Prefix              | Tag              |
| ------------------------------- | -------------------- | ---------------- |
| `app/api/routes/health.py`     | `/api/v1/health`    | `Health`         |
| `app/api/routes/auth.py`       | `/api/v1/auth`      | `Authentication` |
| `app/api/routes/users.py`      | `/api/v1/users`     | `Users`          |
| `app/api/routes/foods.py`      | `/api/v1/foods`     | `Foods`          |
| `app/api/routes/barcodes.py`   | `/api/v1/barcodes`  | `Barcodes`       |
| `app/api/routes/meals.py`      | `/api/v1/meals`     | `Meals`          |
| `app/api/routes/nutrition.py`  | `/api/v1/nutrition` | `Nutrition`      |

`app/api/router.py` is the only place that wires a new route module into the app — it
`include_router()`s each module under the shared `/api/v1` prefix.

Tag descriptions (shown at the top of each Swagger group) live in `tags_metadata` in
`app/main.py`, next to the `FastAPI(...)` app instance.

## Implemented

### `GET /api/v1/health`

- **Tag:** Health
- **Summary:** Health check
- **Description:** Returns the current API health status.
- **Response model:** `HealthResponse` (`app/schemas/health.py`)

```json
{
  "status": "ok"
}
```

Used as a liveness check. No auth, no dependencies.

### `GET /api/v1/foods?q=milk&limit=20`

- **Tag:** Foods
- **Summary:** Search foods
- **Response model:** `list[FoodSearchResult]` (`app/schemas/food.py`)

Foods whose name contains `q` or closely resembles it (trigram similarity), best match first:
exact name, then names starting with `q`, then by similarity. Case, accents and punctuation
are ignored ("creme-fraiche" finds "Crème Fraîche"). Only foods with calories, protein, carbs
and fat are returned. `q` is required (1–100 characters); `limit` defaults to 20, at most 50.
Logic lives in `app/services/food_search.py`.

```json
[
  {"id": 812, "name": "Whole milk", "per_100g": {"kcal": 61.0, "protein": 3.15, "carbs": 4.8, "fat": 3.25}}
]
```

### Food log — `/api/v1/meals/entries`

- **Tag:** Meals
- **Schemas:** `FoodLogEntryCreate`, `FoodLogEntryUpdate`, `FoodLogEntryRead`, `CopyDayRequest`
  (`app/schemas/meal.py`); logic in `app/services/food_log.py`.

A **single shared log** for now: there are no user accounts yet, so every caller sees the same
entries. Once authentication exists, entries gain a `user_id` and every query filters on it.

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/v1/meals/entries?date=YYYY-MM-DD` | That day's entries in the order eaten (`logged_at`). `date` defaults to today. |
| `POST` | `/api/v1/meals/entries` | Log a food. `201` with the new entry. |
| `PATCH` | `/api/v1/meals/entries/{id}` | Change `amount`, `unit`, `grams`, `logged_at` or `meal`. Omitted fields are kept. `404` if missing. |
| `DELETE` | `/api/v1/meals/entries/{id}` | Remove an entry. `204`, or `404` if missing. |
| `POST` | `/api/v1/meals/entries/copy` | `{"from_date", "to_date"}`: copy a whole day, keeping each entry's time of day. `201` with the new entries. |

Logging a food — either a database food:

```json
{"logged_at": "2026-10-05T08:10:00+03:00", "food_id": 812, "amount": 250, "unit": "g", "grams": 250}
```

or one that is not in the database (custom, barcode, photo, recipe):

```json
{"date": "2026-10-05", "meal": "dinner", "source": "custom", "name": "Grandma's pancakes",
 "per_100g": {"kcal": 227, "protein": 6.4, "carbs": 28.3, "fat": 9.7},
 "amount": 2, "unit": "piece", "grams": 100}
```

- `logged_at` is when the food was eaten, with its UTC offset (a time without one is `422`).
  It defaults to now. The entry's `date` is the day of `logged_at` in that offset; sending a
  `date` for a different day is `422`. Without `logged_at`, `date` defaults to today.
- `meal` is one of `breakfast`, `lunch`, `dinner`, `snacks`. It is optional: when omitted it
  is the meal for the hour eaten, read in `logged_at`'s own offset — 05:00–10:59 breakfast,
  11:00–14:59 lunch, 17:00–21:59 dinner, any other hour snacks. The app's timeline sends only
  `logged_at`.
- On `PATCH`, a new `logged_at` moves the entry to that day and to that hour's meal, unless
  `meal` is sent too.
- `grams` is what the macros are computed from (`> 0`, at most 5000); `amount` and `unit` are
  kept as the user entered them, for display.
- With `food_id`, the entry's name and values are **copied from the database** at logging time,
  ignoring any sent in the request. `404` if the food does not exist, `422` if it lacks a
  macro. Each entry keeps that copy, so correcting or re-farming a food never changes
  what was logged.

Every entry is returned as:

```json
{"id": 41, "date": "2026-10-05", "meal": "breakfast", "food_id": 812, "source": "database",
 "name": "Whole milk", "per_100g": {"kcal": 61.0, "protein": 3.15, "carbs": 4.8, "fat": 3.25},
 "amount": 250.0, "unit": "g", "grams": 250.0, "logged_at": "2026-10-05T08:10:00+03:00"}
```

## Placeholder route groups (planned, not implemented)

`auth`, `users`, `barcodes`, and `nutrition` each currently expose a single
`GET` on their base path that returns `501 Not Implemented`, documented in Swagger under their
tag with a summary/description explaining what's planned. This keeps the URL structure and tag
grouping stable while each feature is built out. There is no real request/response schema for
these yet, so none is documented here — see each route module's docstring for what it will
eventually cover.

When one of these is implemented for real: replace its placeholder handler, give it a real
summary/description/response model, and update this doc with its actual behavior.

## Swagger, ReDoc, and OpenAPI

FastAPI generates all three automatically from the route definitions — there is no separate
package to install or file to maintain by hand:

- **Swagger UI** (`/docs`) — interactive, lets you try requests against a running server.
- **ReDoc** (`/redoc`) — read-only, better for browsing/sharing the full spec.
- **OpenAPI JSON** (`/openapi.json`) — the raw spec Swagger UI and ReDoc are rendered from.
  Anything that reads OpenAPI specs (client generators, API testing tools) can point at this.

All three reflect the code exactly — if an endpoint isn't documented well in Swagger, that
means it isn't documented well in the route decorator, not that Swagger needs separate upkeep.

## How to add a new endpoint

1. Add the handler to the relevant module in `app/api/routes/` (or create a new module + tag
   if it's a genuinely new resource — register it in `app/api/router.py` and add its tag to
   `tags_metadata` in `app/main.py`).
2. Give the route decorator a `summary`, a `description`, and (once there's a real schema) a
   `response_model`. See "How to document an endpoint" below.
3. If the placeholder handler for that resource still exists (the `501` one), remove it — a
   real endpoint replaces the placeholder, it doesn't sit alongside it.

## How to add request/response schemas

Add a Pydantic model to `app/schemas/` — one file per resource is a reasonable default (e.g.
`app/schemas/food.py`). Schemas describe the API's request/response shape; they are not
SQLAlchemy models and should never be swapped in for one. A typical resource ends up with a
couple of small classes, e.g.:

```python
# app/schemas/food.py
from pydantic import BaseModel, Field


class FoodCreate(BaseModel):
    name: str = Field(description="Food name.")
    calories_per_100g: float


class FoodResponse(FoodCreate):
    id: int
```

Use the request schema as a route parameter (FastAPI validates the body against it
automatically) and the response schema as `response_model` (FastAPI filters/serializes the
return value against it, so internal-only fields never leak into the API response).

## How to document an endpoint

Every real endpoint should have:

```python
@router.get(
    "/{food_id}",
    response_model=FoodResponse,
    summary="Get a food by ID",
    description="Returns a single food item from the database by its ID.",
    responses={404: {"description": "Food not found."}},
)
def get_food(food_id: int, db: Session = Depends(get_db)) -> FoodResponse:
    ...
```

- **`summary`** — a few words, shown next to the route in the collapsed Swagger list.
- **`description`** — a full sentence or two, understandable to someone who has never seen the
  codebase. Not "gets a food" — say what "gets" means here (by ID, by barcode, etc.) and what
  happens when it isn't found.
- **`tags`** — inherited from the router unless the endpoint needs a different one.
- **`response_model`** — the Pydantic schema, never a raw dict or a SQLAlchemy model.
- **`responses`** — document non-200 outcomes that are actually possible for this endpoint.
  FastAPI already documents `422` automatically for any endpoint with request validation
  (query params, path params, or a request body) — you don't need to add it yourself. Add the
  ones specific to the endpoint's logic: `404` when a lookup can fail, `400` for a rejected
  input the validator wouldn't catch, `401` once auth exists, etc.

Standard FastAPI validation behavior (automatic `422` on bad input) is enough for now — no
custom exception handlers are needed until a real endpoint has an error case that standard
validation doesn't cover.

## Authentication

Not implemented yet. The plan is a Bearer JWT scheme once `auth` is built — at that point,
protected routes will take a `Depends(...)` that validates the token and Swagger will show the
"Authorize" lock automatically from that dependency's security scheme. There is no fake/lock
icon in Swagger today, on purpose — it would document a capability that doesn't exist.
