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
| `app/api/routes/users.py`      | `/api/v1/users`     | `Users`          |
| `app/api/routes/nutrition_plans.py` | `/api/v1/users/me` | `Nutrition plan` |
| `app/api/routes/foods.py`      | `/api/v1/foods`     | `Foods`          |
| `app/api/routes/barcodes.py`   | `/api/v1/barcodes`  | `Barcodes`       |
| `app/api/routes/meals.py`      | `/api/v1/meals`     | `Meals`          |
| `app/api/routes/nutrition.py`  | `/api/v1/nutrition` | `Nutrition`      |

`app/api/router.py` is the only place that wires a new route module into the app — it
`include_router()`s each module under the shared `/api/v1` prefix.

There are no `/auth` routes: signing in, signing out and refreshing tokens are Supabase Auth
endpoints, called by the app through supabase-js. See "Authentication" below.

Tag descriptions (shown at the top of each Swagger group) live in `tags_metadata` in
`app/main.py`, next to the `FastAPI(...)` app instance.

## Implemented

Every endpoint below except health needs a Supabase access token (`Authorization: Bearer
<token>`); without a valid one it answers `401`. See [Authentication](#authentication).

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

Used as a liveness check. No auth, no dependencies: the only endpoint that needs no access
token.

### Users — `/api/v1/users/me`

- **Tag:** Users
- **Schemas:** `UserRead`, `UserUpdate` (`app/schemas/user.py`); logic in
  `app/services/users.py`.

The signed-in user's own profile. Every user only ever sees and changes their own; there is no
way to address another user.

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/v1/users/me` | The profile. `200`. |
| `PATCH` | `/api/v1/users/me` | Change `display_name` and/or `timezone`. `200` with the updated profile. |
| `DELETE` | `/api/v1/users/me` | Delete the account and all its data. `204`; `502` or `503`, see below. |

There is no sign-up endpoint. The first request with a new user's access token creates their
profile from the token: `email`, the name (`user_metadata.full_name`, else `name`) and the
avatar (`user_metadata.avatar_url`, else `picture`), on the `basic` plan with default targets.
Afterwards the email follows the token, and a missing name or avatar is filled in from it
(Apple sends the name only on the first sign-in, and the app saves it to Supabase afterwards);
a name the user has set is never overwritten.

```json
{
  "id": "6f1c2a9e-5b7d-4c1e-9f3a-2d8b7e6c5a41",
  "email": "user@example.com",
  "display_name": "Rares",
  "avatar_url": null,
  "plan": "basic",
  "plan_expires_at": null,
  "timezone": "Europe/Bucharest",
  "targets_mode": "default",
  "targets": {"kcal": 2000.0, "protein_g": 150.0, "carbs_g": 220.0, "fat_g": 70.0, "fiber_g": 28.0},
  "check_in_due": false
}
```

- `id` is the Supabase user id (the token's `sub`).
- `plan` is `basic` or `premium`: the plan in force, so a premium plan whose `plan_expires_at`
  has passed reads `basic`. `plan_expires_at` is `null` for a plan that doesn't expire (every
  plan, until payments exist; `scripts/set_plan.py` sets plans by hand).
- `timezone` is the user's IANA time zone, sent by the app; `null` means UTC. It will decide
  when the Monday check-in is due.
- `targets` are daily: calories, then grams of protein, carbs, fat and fibre. Numbers are JSON
  numbers. **Targets are never typed in by hand**; where they come from is `targets_mode`:
  - `default`: the defaults, 2000 / 150 / 220 / 70 / 28. Every basic user, and premium users
    without an active nutrition plan.
  - `plan`: the active [nutrition plan](#nutrition-plan-premium)'s targets.
  - `none`: **log without targets**. A safety gate stopped the user's plan (pregnancy, kidney
    disease, …): `targets` is `null`, and the app shows no target, "remaining" or % of goal
    anywhere, only plain totals. Food logging works as usual. Leaving `none` takes a new
    questionnaire whose gates no longer stop.
- **Going back to basic** (a premium plan expired or set to basic): `targets_mode` reads
  `default` and `targets` the defaults, but nothing is deleted or changed in the database: the
  plan stays as it was, so becoming premium again brings it back. A `none` user stays `none`.
- `check_in_due` is always `false` until weekly check-ins exist (spec phase 3).

`PATCH` takes any subset, and keeps whatever isn't sent:

```json
{"display_name": "Rares", "timezone": "Europe/Bucharest"}
```

- `display_name`: 1–100 characters once trimmed. It can be changed, not removed.
- `timezone`: an IANA name exactly as spelt in the tz database (`Europe/Bucharest`, `UTC`);
  anything else is `422`.
- Anything else — `targets` (no longer accepted), an unknown field (`plan`), a value out of
  range — is `422`.

`DELETE` removes the user's Supabase user first (Supabase's admin API, with
`SUPABASE_SECRET_KEY`), then their profile and whole food log. If Supabase doesn't confirm
(an error, or unreachable), nothing is deleted and the answer is `502`: the user could still
sign in, so their data must still be there. A Supabase user that is already gone counts as
deleted, so a retry always finishes the job. Without `SUPABASE_SECRET_KEY` it is `503`. After a
`204` the app should sign out at once: the access token stays valid until it expires (about
an hour), and a request with it would create an empty profile again.

### Nutrition plan (premium) — `/api/v1/users/me/...`

- **Tag:** Nutrition plan
- **Schemas:** `app/schemas/nutrition_plan.py`; logic in `app/services/nutrition_plan/`
  (see [architecture.md](architecture.md#adaptive-nutrition-plan)). Spec:
  [plans/ai-nutrition-plan.md](plans/ai-nutrition-plan.md); phase 1 (algorithm, gates, plans)
  is implemented; weekly check-ins are not.

**Premium only.** Every endpoint needs sign-in and `require_plan("premium")`; a basic user gets
`403` with `{"detail": "Personal nutrition plans are a premium feature."}`.

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/v1/users/me/nutrition-plans/preview` | Gate + pace options for answers so far. Stores nothing. `200`. |
| `POST` | `/api/v1/users/me/goals` | Save the answers with consent. `201`, or `200` with `id: null` under 16. |
| `GET` | `/api/v1/users/me/goals` | The latest answers, with today's gate. `404` if none. |
| `POST` | `/api/v1/users/me/nutrition-plans` | `{"goal_id"}` → a **draft** plan. `201`. |
| `GET` | `/api/v1/users/me/nutrition-plans/active` | The active plan. `404` if none. |
| `POST` | `/api/v1/users/me/nutrition-plans/{id}/activate` | Use a draft: it becomes active. `200`. |

#### Answers (questionnaire v2)

Every answer is optional in a preview; a saved goal needs the ones the questionnaire showed
(below). Unknown fields are `422`.

| Field | Values |
|---|---|
| `goal` | `lose_fat` · `recomp` (Lose fat and build muscle: a small deficit with strength training) · `build_muscle` (shown as "Gain muscle") · `maintain` |
| `birth_year`, `birth_month` | year 1900–2100, month 1–12. Age is the youngest possible (born on the month's last day). Not in the future; age ≤ 100 |
| `sex` | `female` · `male` · `unspecified` |
| `height_cm` | 120–230 |
| `weight_kg` | 30–300, kept to 0.1 |
| `health` | list, at least one, of `pregnant`, `breastfeeding`, `diabetes`, `kidney`, `eating_disorder`, `glp1`, `bariatric`, `other_diet_condition`, `none`, `prefer_not`. `none` and `prefer_not` only alone; `pregnant` and `breastfeeding` not with sex `male` |
| `diabetes_hypo_risk` | `yes` · `no` · `not_sure` · null (needed with `diabetes`) |
| `diabetes_team_ack` | bool, default false ("I'll check with my diabetes team") |
| `ed_status` | `current` · `past` · `prefer_not` · null (needed with `eating_disorder`) |
| `targets_wanted` | bool or null. Only read with `ed_status: past`: `true` asks for a Maintain plan with targets; `false` or missing is log without targets (the `targets_declined` stop) |
| `activity` | `mostly_sitting` · `some_walking` · `on_feet` · `physical_work` |
| `strength_days`, `cardio_days` | 0–7 |
| `lifting_experience` | `none` · `lt_1y` · `1_3y` · `gt_3y` · null (needed with strength days ≥ 1, or `recomp` / `build_muscle`) |
| `will_train` | bool or null (needed for `recomp` and `build_muscle` with fewer than 2 strength days) |
| `target_weight_kg` | 30–300 or null. `lose_fat`: needed; `recomp`: optional (none = a 16-week block); both ≤ current − 1 kg and BMI ≥ 20 (≥ 23 from age 65). `build_muscle`: optional (none = a 16-week block), ≥ current + 1 kg |
| `pace` | `gentle` · `steady` · `faster` · `custom` · null (needed for `lose_fat`, `recomp` and `build_muscle`; `recomp` never has `faster`) |
| `target_date` | `YYYY-MM-DD` or null (needed with `custom`, which also needs a target): 4–104 weeks away for `lose_fat`, 8–104 for `recomp`, 8–52 for `build_muscle` |
| `eating_style` | `omnivore` · `pescatarian` · `vegetarian` · `vegan` · null |
| `religious_fasting` | bool, default false |
| `allergies` | list of `milk`, `gluten`, `eggs`, `peanuts`, `tree_nuts`, `soy`, `fish`, `shellfish`, `sesame` |
| `meals_per_day` | 2–6, default 3 |
| `units` | `metric` (default) · `imperial`: for display only; values are always metric |

#### The gate

Returned by the preview and with every goal:

```json
{"result": "ok", "allowed_goals": ["lose_fat", "recomp", "build_muscle", "maintain"],
 "reasons": [{"code": "age_65", "message": "As we get older, …"}], "stop": null}
```

- `result`: `stop` (no plan; log without targets), `maintain_only` (only `maintain` allowed), or
  `ok`. **`allowed_goals` is what decides**: with `ok`, some goals may still be ruled out (Build
  muscle from BMI 30; the loss goals with hypo-risk diabetes until `diabetes_team_ack`, from
  age 65 below BMI 25, or with no room above BMI 20; …). `recomp` follows every `lose_fat`
  rule, and both muscle goals need 2+ strength days or `will_train`.
- `reasons`: notes and the reasons the picked goal was ruled out, each with a `code` and a
  `message` to show. Codes: `age_16_17`, `age_65`, `age_65_loss`, `breastfeeding`,
  `bmi_17_5_18_5`, `no_room_to_lose`, `bmi_40` (loss goals only), `ed_past`,
  `diabetes_team_check`, `diabetes_hypo_risk`, `diabetes`, `glp1`, `other_diet_condition`,
  `prefer_not`, `no_strength_training` (its message is the "Will you train at least two days a
  week?" question), `bmi_30_build`.
- `stop` (only with `result: stop`): `{"code", "title", "body"}`, a warm screen with no
  numbers. Codes, one shown, in this priority: `under_16`, `pregnancy`, `ed_current`,
  `kidney`, `bariatric`, `bmi_low`, `targets_declined` (an eating disorder in the past without
  `targets_wanted: true`: the user's choice to log without targets). `reasons` is empty and
  `allowed_goals` too.
- A health follow-up not answered yet counts as its most cautious answer: `eating_disorder`
  without `ed_status` is a stop, `ed_status: past` without `targets_wanted` is
  `targets_declined`, `diabetes` without `diabetes_hypo_risk` has hypo risk. Ask the follow-up
  before previewing.

#### `POST /nutrition-plans/preview`

`{"answers": {...}, "language": "en"}` (`language` optional, `en` or `ro`). Nothing is stored.

```json
{"gate": {...},
 "pace_options": [
   {"pace": "gentle", "rate_kg_week": 0.25, "effective_rate_kg_week": 0.25, "weeks": 42,
    "goal_date": "2027-08-20", "kcal": 2280, "available": true},
   {"pace": "steady", "rate_kg_week": 0.4, "effective_rate_kg_week": 0.4, "weeks": 25,
    "goal_date": "2027-04-23", "kcal": 2100, "available": true},
   {"pace": "faster", "rate_kg_week": 0.6, "effective_rate_kg_week": 0.6, "weeks": 18,
    "goal_date": "2027-03-05", "kcal": 1910, "available": true}],
 "custom_date_range": {"min": "2026-11-27", "max": "2028-10-27"},
 "max_rate_kg_week": 0.6,
 "notices": [{"code": "pace_clamped", "message": "12 weeks is faster than we recommend. …"}]}
```

- `pace_options` is `[]` until the goal is `lose_fat`, `recomp` or `build_muscle` **and
  allowed**, and the birth, sex, height, weight, health, activity and exercise answers are in,
  plus the target (`lose_fat`) or the lifting experience (the muscle goals with strength
  days). Always the three paces, in order; `available: false` means don't offer it: Faster
  isn't at least 0.05 kg a week faster than Steady once the limits apply, a health answer
  rules it out, or the goal is `recomp`.
- `rate_kg_week` is the pace's own rate; `effective_rate_kg_week` the one the calorie limits
  allow, which `weeks` and `goal_date` come from. kg/week to 0.05. `weeks`/`goal_date` are
  `null` when no deficit is possible at all (see `tiny_deficit`); for `recomp` or
  `build_muscle` with no target they are the 16-week block.
- `custom_date_range`: what `target_date` may be (`lose_fat` 4–104 weeks, `recomp` 8–104,
  `build_muscle` 8–52). `null` with no target (a date needs one), and whenever `pace_options`
  is `[]`. A date sooner than the fastest available pace reaches is planned at that pace, so
  it gets that pace's date, with a `pace_clamped` notice; the app works this out from
  `pace_options` and says so as the date is picked.
- `max_rate_kg_week`: the fastest the user can be planned at (a custom date faster than this is
  clamped). `null` until the options are.
- `notices`: for the pace picked so far (Steady if none): `pace_clamped` (only when the shown
  rate is slower than asked), `calorie_floor`, `tiny_deficit`, `gain_block`, `recomp_block`,
  `gain_target_high`.
- Missing answers are never an error here. Invalid values are `422`: FastAPI's usual list for
  schema errors, and `{"detail": {"code", "message", ...}}` for `target_not_below`,
  `target_too_low`, `target_not_above` (with `min_target_weight_kg`, `max_target_weight_kg`),
  `target_date_out_of_range` (with `custom_date_range`) and `invalid_birth`.

#### `POST /goals`, `GET /goals`

```json
{"questionnaire_version": 2, "consent": true, "consent_version": "2026-10-30",
 "language": "en", "answers": {...}}
```

`consent` must be `true` and `questionnaire_version` `2`. Returns:

```json
{"id": 3, "questionnaire_version": 2, "language": "en", "answers": {...every answer...},
 "consented_at": "2026-10-30T09:12:00Z", "created_at": "2026-10-30T09:12:00Z", "gate": {...}}
```

Checked in this order:

1. `goal`, `birth_year`, `birth_month` are needed (`422 missing_answers`), and the birth month
   valid (`422 invalid_birth`).
2. **Under 16:** `200` with `id`, `answers`, `consented_at`, `created_at` all `null` and the
   `under_16` stop. **Nothing is stored**; the user goes to `targets_mode: none`.
3. **Any other stop** (including `targets_declined`): stored (`201`) with whatever answers led
   to it; the user goes to `targets_mode: none`, and their active plan (if any) is archived.
4. The goal must be in `allowed_goals`, else `422` with
   `{"code": "goal_not_allowed", "message", "gate": {...}}`: show the gate screen, then
   re-submit with an allowed goal (or with `will_train` / `diabetes_team_ack` answered).
5. The answers the questionnaire showed must be there: `422` with
   `{"code": "missing_answers", "fields": [...]}`.
6. The target and custom date (`422`, codes as in the preview), and `faster` when it isn't
   offered (`422 pace_not_available`).
7. Stored, `201`. A user in `none` mode whose new answers don't stop goes back to `default`.

`GET` returns the latest goal the same way, its gate recomputed for today's age; `404` if
there is none.

#### `POST /nutrition-plans`, `GET /nutrition-plans/active`, `POST /nutrition-plans/{id}/activate`

`POST /nutrition-plans` takes `{"goal_id": 3}` and builds a **draft** from that goal's
answers (with today's age):

```json
{"id": 12, "goal_id": 3, "status": "draft", "reason": "initial", "language": "en",
 "goal": "lose_fat", "pace": "custom",
 "targets": {"kcal": 1910, "protein_g": 165, "carbs_g": 190, "fat_g": 55, "fiber_g": 25},
 "rate": {"requested_kg_week": 0.85, "effective_kg_week": 0.6, "clamped": true},
 "start_weight_kg": 80, "target_weight_kg": 70, "goal_date": "2027-03-05", "weeks": 18,
 "notices": [{"code": "pace_clamped", "message": "12 weeks is faster than we recommend. …"}],
 "texts": {"summary": "…", "why": ["…"], "guidance": ["…"], "cautions": ["…",
           "General guidance, not medical advice."]},
 "pattern_key": "lose_fat.faster.trained.start",
 "created_at": "2026-10-30T09:12:05Z", "activated_at": null}
```

- `status`: `draft` · `active` · `archived`. `reason`: `initial`, or `change` when the user
  already has an active plan (`review` and `maintenance_transition` come with check-ins).
- `pace` is what was asked (`gentle`/`steady`/`faster`/`custom`), `null` for Maintain.
  `pattern_key` is `goal.pace band.training.phase` (a custom date maps to the nearest pace).
- `targets`: kcal to 10, grams to 5 (integers). `rate`: kg/week to 0.05, both `0` for Maintain;
  `clamped` when the safety limits made it slower than asked. `goal_date`/`weeks` come from the
  effective rate; `null` for Maintain (and when no deficit is possible); for `recomp` or
  `build_muscle` with no target, the end of a 16-week block (`target_weight_kg` `null`).
- `texts` are rendered from the pattern library when read, in the plan's `language` (`ro`
  falls back to English for now). The last caution is always "General guidance, not medical
  advice."
- `404` for a goal that isn't the user's. `409` with `{"code", "message"}`: `gate_stop` (the
  goal's gate is a stop), `targets_off` (the user is in `none` mode: their latest answers
  stopped the plan), `goal_not_allowed` (the gates no longer allow it).

`POST /nutrition-plans/{id}/activate` makes a draft the user's plan: the previous active plan
becomes `archived`, the draft `active` (`activated_at` set), its targets are copied to the
user's daily targets and `targets_mode` becomes `plan`. `200` with the plan. `404` for a plan
that isn't the user's; `409` `not_a_draft` (already active or archived) or `targets_off`.

`GET /nutrition-plans/active` returns the active plan in the same shape, or `404`.

### `GET /api/v1/foods?q=milk&limit=20`

- **Tag:** Foods
- **Summary:** Search foods
- **Response model:** `list[FoodSearchResult]` (`app/schemas/food.py`)
- **Needs** an access token, like every endpoint but health: it also keeps the food database
  from being scraped.

Foods whose name matches `q`, best match first. Built for search as you type:

- **Unfinished words:** "alm" finds almond butter; "piept d" finds "piept de pui".
- **Typos:** one wrong letter in words of 4–7 letters, two from 8 ("granloa", "almnds"). The
  first letter must be right.
- **English and Romanian:** the food database mixes both, so each finds the other through the
  synonyms in `app/services/food_synonyms.py` — "chicken breast" finds "piept de pui", "olive
  oil" finds "ulei de masline".
- **Word forms, case, accents:** "eggs" finds "Egg", "SMANTANA" finds "Smântână". Connecting
  words (de, cu, of, with, …) don't count toward a match.

Ranking: the exact name first, then names starting with `q`, then the best matches; a
typo-corrected match never outranks a real one. Only foods with calories, protein, carbs and
fat are returned. `q` is required (1–100 characters); `limit` defaults to 20, at most 50.

Runs on Elasticsearch when `ELASTICSEARCH_URL` is set — the query is `build_query` in
`app/services/food_search.py`, the index `app/services/food_index.py` — and the matching foods
are then loaded from PostgreSQL. Without Elasticsearch (unset, index not built yet, or not
answering) the same endpoint searches PostgreSQL instead: names containing `q` or resembling it
by trigram similarity, exact name first. The response is the same either way.

```json
[
  {"id": 812, "name": "Whole milk", "per_100g": {"kcal": 61.0, "protein": 3.15, "carbs": 4.8, "fat": 3.25}}
]
```

### `GET /api/v1/foods/{id}`

- **Tag:** Foods
- **Summary:** Get a food's full nutrition
- **Response model:** `FoodDetail` (`app/schemas/food.py`); logic in `app/services/food_details.py`.
- **Needs** an access token.

One food with its whole nutrient profile, per 100g, for the app's food details screen. Search
keeps sending only calories and macros; the app asks for this when a food is opened.

`per_100g` holds calories, protein, carbs and fat, as in search, and is `null` when the food lacks
any of them. `nutrients` lists every other nutrient the food has a value for: the label's fibre,
sugar, saturated fat and sodium first, then the full profile in the order of
`app/services/ingest/nutrients.py` (carbohydrate breakdown, fats and fatty acids, amino acids,
vitamins, minerals, other compounds). Each states its `unit` — `g`, `mg` or `ug` — matching the
`foods` column it comes from. A nutrient without data is left out, never sent as `null`; a `0`
is a measured zero. Foods known only from their nutrition label return just those values. A
missing food is a 404.

```json
{
  "id": 1755,
  "name": "Butter, salted",
  "per_100g": {"kcal": 717.0, "protein": 0.85, "carbs": 0.06, "fat": 81.11},
  "nutrients": [
    {"key": "fiber", "unit": "g", "amount": 0.0},
    {"key": "saturated_fat", "unit": "g", "amount": 51.368},
    {"key": "sodium", "unit": "mg", "amount": 643.0},
    {"key": "vitamin_a", "unit": "ug", "amount": 684.0}
  ]
}
```

### Food log — `/api/v1/meals/entries`

- **Tag:** Meals
- **Schemas:** `FoodLogEntryCreate`, `FoodLogEntryUpdate`, `FoodLogEntryRead`, `CopyDayRequest`
  (`app/schemas/meal.py`); logic in `app/services/food_log.py`.

Each user has their **own log**: every query filters on the signed-in user, and new entries are
theirs. Another user's entry answers exactly like a missing one (`404`), so entry ids reveal
nothing. Copying a day copies only the user's own entries. Entries from the shared log that
predates accounts belong to no one until `scripts/claim_shared_log.py` assigns them (see
[database.md](database.md)).

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/v1/meals/entries?date=YYYY-MM-DD` | That day's entries in the order eaten (`logged_at`). `date` defaults to today. |
| `POST` | `/api/v1/meals/entries` | Log a food. `201` with the new entry. |
| `PATCH` | `/api/v1/meals/entries/{id}` | Change `amount`, `unit`, `grams`, `logged_at` or `meal`. Omitted fields are kept. `404` if missing or not the user's. |
| `DELETE` | `/api/v1/meals/entries/{id}` | Remove an entry. `204`, or `404` if missing or not the user's. |
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

`barcodes` and `nutrition` each currently expose a single `GET` on their base path that
returns `501 Not Implemented` (to a signed-in caller; without a token it is `401`, like every
other endpoint), documented in Swagger under their tag with a summary/description explaining
what's planned. This keeps the URL structure and tag
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
  input the validator wouldn't catch, etc. A protected router passes
  `responses=AUTH_RESPONSES` (`app/services/auth.py`), which documents its `401` and `503`.

Standard FastAPI validation behavior (automatic `422` on bad input) is enough for now — no
custom exception handlers are needed until a real endpoint has an error case that standard
validation doesn't cover.

## Authentication

Sign-in is **Supabase Auth** (Google and Apple). The app signs in with supabase-js and sends
the session's access token with every request:

```
Authorization: Bearer <Supabase access token>
```

**Every endpoint except `GET /api/v1/health` needs it.** This API only verifies tokens; it
never sees passwords or refresh tokens. How tokens are checked, and how a token becomes a
`users` row, is in [architecture.md](architecture.md#authentication). In Swagger, the
**Authorize** button takes a token (see [development.md](development.md) for getting one).

| Status | When |
|---|---|
| `401` | No token, a non-Bearer `Authorization`, or a token that is invalid: expired, badly signed, `HS256`, from another Supabase project (`iss`), not for signed-in users (`aud`/`role`), or anonymous. Always with `WWW-Authenticate: Bearer`, and a `detail` naming the reason. The app refreshes its session once and retries; if that fails it signs out. |
| `403` | The user's plan is too low for the endpoint (`require_plan("premium")`): the nutrition plan endpoints, with `detail` "Personal nutrition plans are a premium feature." |
| `404` | As for any missing resource; also an entry, goal or plan that belongs to another user. |
| `502` | `DELETE /api/v1/users/me` only: Supabase didn't delete the sign-in account, so nothing was deleted. |
| `503` | Sign-in is not configured on this server (`SUPABASE_URL` unset): **every** protected endpoint refuses, there is no anonymous fallback. Also when Supabase's signing keys can't be fetched (a 401 would sign the user out over a network blip), and for `DELETE /api/v1/users/me` without `SUPABASE_SECRET_KEY`. |

To protect a new route: take `user: User = Depends(get_current_user)` in the handler, or add
`dependencies=[Depends(get_current_user)]` to its router. A route that needs a plan uses
`Depends(require_plan("premium"))`. `tests/test_auth.py` checks that every endpoint in the
OpenAPI spec except health answers `401` without a token, so a new endpoint can't be left open
by accident.
