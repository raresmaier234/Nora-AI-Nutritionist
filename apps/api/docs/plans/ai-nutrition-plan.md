# Plan: AI-built nutrition plan

**Status:** proposal, waiting for review. Nothing is implemented. Written 2026-10-30.
**Depends on:** accounts and daily targets (`auth-and-user-profiles.md`), which are implemented.
**Scope:** API (`apps/api`), mobile app (`apps/mobile`).

## Goal

After someone creates an account, Nora asks a few questions about them and their goals. The API
turns the answers into a **personal nutrition plan**: daily calorie and macro targets, an
explanation of why, and practical guidance. The plan then lives on the **Profile** tab, and its
targets become the daily targets the whole app already measures against.

**Targets are never edited by hand** (decided 2026-10-30). The only way to change a plan is the
**Change plan** button, which asks what the user wants to change and rebuilds the plan.

Today the Profile tab shows the daily targets read-only (the defaults until the builder
exists), and Change plan only explains what's coming.

## Decisions to confirm before implementing

| # | Question | Recommendation |
|---|---|---|
| 1 | Who calculates the numbers (calories, protein, carbs, fat, fibre)? | **Our API, with established formulas** (below). The language model writes the explanation and guidance, and may adjust the numbers only within limits the API checks. Numbers from a formula are repeatable, testable and explainable; numbers made up by a model are none of those |
| 2 | Which language model? | **A hosted API** (for example Anthropic's Claude or OpenAI), called only from our API. A small fast model is enough for this task. The local Ollama used for food ingestion can't run on Railway at a sensible cost. Pick after testing a few personas (see *Quality*) and checking current prices |
| 3 | Basic vs premium | **One plan for everyone; regenerating is premium.** Basic users get their first plan, and can redo it once a month. Premium users can regenerate any time and get extra guidance (for example meal ideas). Uses the existing `require_plan` |
| 4 | Language of the plan | **The phone's language**, Romanian or English to start, passed to the model |
| 5 | Where the questions live | **In the app**, as a fixed questionnaire with versioned answers. A questionnaire served by the API could change without an app release, but isn't needed yet |
| 6 | Consent | **Explicit consent before the first plan.** Goals, weight and health conditions are health data, a special category under GDPR, and they're sent to a third-party AI provider. One clear checkbox that explains this |

## User journey

1. **Sign in for the first time** → a prompt offers **"Build my plan"**. Skipping it keeps the
   default targets (2,000 kcal, 150 g protein, 220 g carbs, 70 g fat, 28 g fibre) until a plan is
   built.
2. **Questions** (one per screen, about 2 minutes): see *Questionnaire*.
3. **Consent** (first time only), then **"Building your plan…"** (a few seconds).
4. **Review:**
   - the proposed targets, with a short explanation: "Why these numbers";
   - guidance, plus any safety notes;
   - **Use this plan** or **Change my answers**.
5. **Accepted:**
   - the plan becomes active and its targets become the daily targets, so Home and food
     details follow straight away;
   - the Profile tab shows the goal, the targets, the explanation and the guidance.
6. **Later: Change plan.**
   - The first screen asks **what to change**: goal, pace, weight, activity or training,
     eating pattern or allergies, health situation, or "start over".
   - Only those questions are asked again; every other answer is filled in from last time.
   - A new draft is built, reviewed and accepted the same way.

## Questionnaire

Each answer is stored with the questionnaire version it came from.

| Question | Answers | Used for |
|---|---|---|
| Main goal | lose weight · maintain · gain weight · build muscle · eat healthier | Calorie adjustment, macro split |
| Target weight and pace | kg; slow / moderate / fast (lose: ~0.25 / 0.5 / 0.75 kg a week) | Size of the deficit or surplus, capped |
| Sex | female · male · prefer not to say | The BMR formula. "Prefer not to say" uses the average of both formulas |
| Birth year | year | Age for the BMR; **under 18 → no deficit plan** (see *Safety*) |
| Height, current weight | cm, kg | BMR |
| Activity | sedentary · light · moderate · very active · athlete | Activity multiplier |
| Training | none · cardio · strength · mixed; days per week | Protein target |
| Eating pattern | no restrictions · vegetarian · vegan · pescatarian · other | Guidance, and food ideas from our database |
| Allergies, intolerances, foods to avoid | multiple choice plus free text | Guidance only, never sent as numbers |
| Health situation | pregnant · breastfeeding · diabetes · kidney disease · history of eating disorder · none · prefer not to say | Safety rules; some answers stop the plan (see *Safety*) |
| Meals per day | 2–6 | Guidance (how to spread the targets) |

## How the plan is made

```
answers ──▶ API: validate ──▶ formula baseline ──▶ safety rules ──▶ LLM: explain and personalise
                                                                     │  (structured JSON)
                                    API: validate the reply, clamp the numbers ◀──┘
                                                 │
                                                 ▼
                                  draft plan stored ──▶ user accepts ──▶ active plan,
                                                                         targets copied to users
```

### 1. Baseline, calculated by the API

- **BMR:** the Mifflin–St Jeor equation.
  - men: `10 × kg + 6.25 × cm − 5 × age + 5`
  - women: `… − 161`
- **TDEE** (energy used per day) = BMR × activity multiplier:
  - 1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 very active, 1.9 athlete.
- **Calories:**
  - TDEE ± the goal's adjustment, sized from the chosen pace: about 7,700 kcal per kg of
    body weight, spread over a week;
  - capped at roughly 25% below or 15% above TDEE.
- **Protein:** 1.6–2.2 g per kg for muscle-building or strength training, 1.2–1.6 g per kg
  otherwise. Use the target weight when the user has a lot to lose.
- **Fat:** at least 0.8 g per kg, typically 25–35% of calories.
- **Carbs:** the rest of the calories.
- **Fibre:** 14 g per 1,000 kcal, at least 25 g.

This is a single deterministic function with unit tests, in `app/services/nutrition_plan/`.

### 2. Safety rules (API, before and after the model)

- **No calorie deficit for:**
  - under-18s;
  - pregnancy or breastfeeding;
  - a history of eating disorders;
  - BMI below 18.5.

  These users get a maintenance (or medically neutral) plan and a note to talk to a doctor or
  dietitian. For a history of eating disorders, consider not showing calorie numbers
  prominently at all; that's a product decision.
- **Diabetes or kidney disease:** a plan with a prominent "check with your doctor" note. No
  high-protein recommendation for kidney disease.
- **Calorie floor:** never below commonly used floors without medical supervision (around
  1,200 kcal for women and 1,500 for men), and never below the BMR.
- **Every plan** carries "general guidance, not medical advice" on screen.

### 3. Language model: explain and personalise

- **Sent to the model:**
  - the answers;
  - the baseline numbers and the safety notes that apply;
  - the language;
  - optionally a handful of foods from our database that fit the eating pattern, so food
    ideas exist in the app.
- **Never sent:** name or email, so the model has nothing that identifies the person.
- **Asked for structured JSON**, which the API validates with a Pydantic schema:
  ```json
  {
    "targets": { "kcal": 1850, "protein_g": 130, "carbs_g": 190, "fat_g": 62, "fiber_g": 28 },
    "adjustments": [{ "field": "protein_g", "from": 120, "to": 130, "reason": "4 strength sessions a week" }],
    "summary": "A moderate deficit to reach 68 kg in about 14 weeks…",
    "why": ["…", "…"],
    "guidance": ["Spread protein over your 3 meals…", "…"],
    "cautions": ["…"]
  }
  ```
- **The model may move each number by at most about ±10% from the baseline.** The API clamps
  anything outside that, and re-applies the safety rules after the model.
- **Prompt:** versioned in code (`PROMPT_VERSION`). The system prompt sets the role (a careful
  dietitian-style coach), the constraints, the output schema and the language.
- **If the model fails** (timeout, invalid JSON twice, provider down): the API still returns the
  baseline plan with template text. The user is never left without a plan.

## Data model

**`nutrition_goals`**: one row per answered questionnaire.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `user_id` | UUID, FK → users on delete cascade | |
| `questionnaire_version` | int | |
| `answers` | JSONB | Validated by a Pydantic model per version |
| `consented_at` | timestamptz | Consent to process health data with the AI provider |
| `created_at` | timestamptz | |

**`nutrition_plans`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `user_id` | UUID, FK → users on delete cascade | |
| `goal_id` | FK → nutrition_goals | The answers it was built from |
| `status` | text: `draft` · `active` · `archived` | At most one active plan per user (partial unique index) |
| `baseline` | JSONB | The formula's numbers and inputs, for explaining and debugging |
| `targets` | JSONB | The final, validated targets |
| `summary`, `why`, `guidance`, `cautions` | text / JSONB | What the Profile tab shows |
| `source` | text: `llm` · `fallback` | |
| `model`, `prompt_version` | text | For quality tracking |
| `language` | text | |
| `created_at`, `activated_at` | timestamptz | |

Accepting a plan copies its targets into the existing `users.*_target` columns, so nothing else
in the app changes. Deleting the account removes goals and plans by cascade.

## API endpoints

All of these need sign-in.

| Method and path | Purpose |
|---|---|
| `GET /api/v1/users/me/goals` | The latest answers, to prefill "Change plan" |
| `POST /api/v1/users/me/goals` | Save new answers, including consent → the goal id |
| `POST /api/v1/users/me/nutrition-plans` | Build a draft plan from a goal id. Rate-limited (decision 3). Takes a few seconds |
| `GET /api/v1/users/me/nutrition-plans/active` | The active plan, or 404 if there isn't one |
| `POST /api/v1/users/me/nutrition-plans/{id}/activate` | Accept a draft: it becomes active, the previous one is archived, and the targets are copied |

Targets aren't edited by hand: once plans exist, `PATCH /users/me` should stop accepting
`targets` (names only), so activating a plan is the only way targets change.

## Mobile app

- **Profile tab, no plan yet:** a "Build my plan" card above the (default) daily targets.
- **Profile tab, with a plan:**
  - the goal summary and pace;
  - the targets, read-only;
  - "Why these numbers", guidance and cautions;
  - **Change plan**, which replaces today's "coming soon" sheet (`change-plan-sheet.tsx`);
  - the account section stays at the bottom.
- **Questionnaire:** a full-screen flow (one question per screen, back and next, a progress
  bar), then consent, generating, and review. Built from the existing `FullScreen` and `ui/`
  parts.
- **First sign-in prompt:** offered once after the first sign-in, and skippable.
- **API wrappers:** `src/services/api/nutrition-plan.ts`, with types in `types.ts`.

## Configuration

| Setting | Notes |
|---|---|
| `LLM_PROVIDER`, `LLM_MODEL` | For example `anthropic` and a current small model; decision 2 |
| `LLM_API_KEY` | **Secret**, API only, one per Railway environment |
| `LLM_TIMEOUT_SECONDS` | ~20 |
| `NUTRITION_PLAN_REGENERATIONS_PER_MONTH_BASIC` | 1 by default (decision 3) |

## Privacy and compliance

- **GDPR:** health data needs **explicit consent** (decision 6), a privacy-policy section naming
  the AI provider, and deletion with the account. That deletion is already handled by cascade.
- **The provider:** choose settings or an agreement where request data isn't used for training
  and is kept for as short a time as possible. Check the provider's current data policy.
- **App Store:** Apple's guidelines require health information to be accurate and not
  misleading (section 1.4). The formula baseline, the safety rules and the "not medical
  advice" note are what make the plans defensible.

## Cost

- **One plan:** about 2–3k input tokens (answers, baseline, rules, schema) and about 1k output
  tokens. That's well under a cent with a small current model; check the provider's prices
  when choosing.
- **Volume:** plans are rare (onboarding plus occasional regeneration), so even thousands of
  users cost little. Regeneration limits (decision 3) keep it bounded.
- **No caching needed.**

## Quality

- **Unit tests:** the formula; the safety rules (under-18, pregnancy, low BMI, calorie floors);
  the clamping; schema validation; the fallback when the model fails. The model client is
  faked.
- **Evaluation set:** 20–30 fixed personas (different goals, bodies, diets, edge cases) run
  against the real model before switching models or prompts. Checks:
  - targets within the limits;
  - explanation consistent with the numbers;
  - no unsafe advice;
  - correct language.

  Reviewed by a person; a script under `scripts/` runs it.
- **Tracking:** every plan stores `model` and `prompt_version`, so a bad change can be traced.

## Implementation phases

1. **Formula and safety (API):**
   - `nutrition_goals` and `nutrition_plans` tables;
   - the baseline calculator, the safety rules, and the `goals` and `nutrition-plans`
     endpoints, using **fallback text only** (no model yet);
   - tests.
2. **Questionnaire and review (app):**
   - the full-screen flow, consent and the review screen;
   - the "what to change" step;
   - the Profile tab's plan view;
   - stop sending `targets` in `PATCH /users/me`.
3. **Language model:** the provider client, the prompt, schema validation and clamping, the
   evaluation set, and the configuration in Railway.
4. **Premium and polish:** regeneration limits, the first sign-in prompt, Romanian copy.
5. **Later:** progress-based adjustments (weight check-ins every few weeks), meal ideas from our
   food database, a weekly summary.

## Out of scope

- Meal plans with recipes and shopping lists.
- Syncing weight from Apple Health or Google Fit.
- Adjusting targets automatically without the user accepting.
- Medical nutrition therapy for specific conditions; those users are pointed to a professional.
