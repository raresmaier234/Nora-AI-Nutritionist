# Plan: adaptive nutrition plan (formula + pattern library + weekly check-ins)

**Status:** v3.1. Phases 1–2 (API and app) implemented 2026-10-30; v3.1 changes 2026-10-31.
- v1: an AI request per plan.
- v2: algorithm + pattern library.
- v3: the nutrition-expert review folded in.
- v3.1: a fourth goal, Lose fat and build muscle; the nutrition-expert review of the
  implementation folded in (see *Changes in v3.1* at the end).

**This file is the spec to build from.** The reasons and evidence behind its numbers are in
[`ai-nutrition-plan-expert-review.md`](ai-nutrition-plan-expert-review.md) ("review §n" below).

**Depends on:** accounts and daily targets (`auth-and-user-profiles.md`), which are implemented.
**Scope:** API (`apps/api`), mobile app (`apps/mobile`).

## Goal

A **premium** user answers a short questionnaire: goal, body, activity, target and pace. A
deterministic **algorithm** builds their nutrition plan (calories, protein, carbs, fat, fibre),
with texts from a reviewed pattern library.

Every **Monday** they do a check-in (weight plus a few taps). The algorithm compares the real
trend with the plan and **proposes** updates, which the user accepts or not. The aim is
progress at a safe pace while protecting muscle. People for whom a calorie plan isn't safe are
pointed to a professional instead of getting one.

Targets are **never typed in by hand**. They change only by building a plan or applying a
proposed update.

## Decisions (accepted 2026-10-30)

| # | Decision |
|---|---|
| 1 | Four goals: **Lose fat · Lose fat and build muscle (`recomp`) · Gain muscle (`build_muscle`) · Maintain**. Named by what the weight does: Gain muscle is the one where it goes up |
| 2 | **Only the algorithm** decides the numbers; no AI at runtime |
| 3 | **AI writes the pattern library once, offline** (`scripts/generate_patterns.py`, Claude). The nutrition-expert agent and a person review it before it's committed |
| 4 | Target weight + **pace** (options showing real dates, or "I have a date in mind"). Unsafe paces are clamped and the nearest safe date shown; slower paces are always accepted |
| 5 | **A weekly check-in every Monday** (local time), doable any day that week. Decisions use a **28-day trend** (see *Check-ins*) |
| 6 | Updates are **proposed and accepted** by the user, never silent |
| 7 | **Adaptive TDEE** from the food log when logging is consistent |
| 8 | **Everything here is premium:** the questionnaire, the plan, Change plan, check-ins, updates, adaptive TDEE. Basic users keep the default targets and see "Build my plan · Premium". Premium is set by hand until payments exist |
| 9 | Minimum age **16**; 16–17: maintain only |
| 10 | Explicit **consent** (GDPR Art. 9) before any health question. No per-user data goes to an AI provider |
| 11 | **Stop and refer** where a calorie plan isn't safe (pregnancy, a current eating disorder, kidney disease, recent weight-loss surgery, BMI < 17.5, under 16). Those users get **"log without targets"**: food logging works, but no calorie or macro targets are shown, not even the defaults. People with an eating disorder **in the past** get it **by default**, and can ask for a Maintain plan instead |
| 12 | The nutrition-expert review's must-fix and should-fix items are adopted, as written into the sections below |

If a premium user goes back to basic, the active plan is archived, and their targets return to
the defaults (or stay hidden if they were stopped). Subscribing again restores the last plan.

## User journey (premium)

1. **First sign-in** → "Build my plan" (or Not now).
2. **Questionnaire** (about 2 minutes; see below). Gate screens show when age, BMI or health
   changes the goal: "Continue with Maintain", or a stop screen.
3. **Review**, instant:
   - the targets (rounded, "~"), the goal date from the effective pace, the explanation and
     guidance;
   - safety notes, and "general guidance, not medical advice".
   - **Use this plan** → active everywhere.
4. **Every Monday:** a "Weekly check-in" card (Home and Profile) until it's done. Weight is
   required; three one-tap questions are optional. The review runs straight away:
   - **too early:** "Too early to judge: keep weighing 3+ times a week";
   - **on track:** a message, no change;
   - **off track:** a **plan update** card ("Losing slower than planned for 2 checks → ~1,810 kcal;
     protein stays 175 g to protect muscle"), with **Apply** / **Not now**.
5. **Goal reached** → offered **Maintain**. Calories rise to maintenance in 1–2 steps over ≤ 2
   weeks, with a note: expect +1–2 kg on the scale from water and glycogen, not fat.
6. **Change plan** any time: "What would you like to change?" Only those questions are asked
   again; the gates are re-run.
7. **Health re-check** every 12 weeks, and from "Something changed?" on the check-in card.

**Basic users:** the default targets, read-only, and a "Build my plan · Premium" card. No
questionnaire, plan or check-ins.

## Questionnaire (v2: the full spec is in review §1–§2)

| # | Screen | Answers | Shown for |
|---|---|---|---|
| 0 | Consent | "I agree" + privacy link. Before any health question; the consent text version is stored | All |
| 1 | Goal | Lose fat · Lose fat and build muscle · Gain muscle · Maintain my weight (with subtitles) | All |
| 2 | Birth month + year | Age = the youngest possible; 16–100. Under 16 → stop, and the answers aren't stored | All |
| 3 | Sex | Female · Male · Prefer not to say | All |
| 4 | Height | 120–230 cm (confirm if < 140 or > 210); ft/in toggle | All |
| 5 | Weight | 30–300 kg, to 0.1 (confirm if < 40 or > 200); lb toggle. **Saved as the first weigh-in** | All |
| 6 | Health (multi-select) | Pregnant or might be* · Breastfeeding* · Diabetes · Kidney disease (CKD, dialysis, transplant) · An eating disorder, now or in the past · A weight-loss medicine (Wegovy / Ozempic / Mounjaro) · Weight-loss surgery in the last 2 years · Another condition managed with diet · None · Prefer not to say (*not shown for male) | All |
| 6a | Diabetes follow-up | Insulin or tablets that can cause hypos? Yes · No · Not sure | If diabetes |
| 6b | ED follow-up | Now or recovering · In the past · Prefer not to say | If ED |
| 6c | "How would you like to use Nora?" | **Log without targets** (default, recommended) · Show me a plan with targets (Maintain) | If ED in the past |
| 7 | Daily activity outside workouts | Mostly sitting · Some walking · On my feet most of the day · Physically hard work (described by steps and job type; review §4) | All |
| 8 | Exercise per week | Strength days 0–7; cardio or sport days (30+ min) 0–7 | All |
| 9 | Lifting experience | Not yet · < 1 year · 1–3 years · 3+ years | Strength ≥ 1, or a muscle goal |
| 10 | Target weight | Lose fat: required. Lose fat and build muscle: optional ("No target" = a 16-week block). Both: ≤ current − 1 kg, target BMI ≥ 20 (≥ 23 from 65). Gain muscle: optional ("No target" = a 16-week block); ≥ current + 1 kg; warn above BMI 27. A Gain muscle target **below** the current weight offers "Switch to Lose fat and build muscle" | Lose fat, Lose fat and build muscle, Gain muscle |
| 11 | Pace | Gentle · Steady (default) · Faster, each with its **real** kg per week and date; or "I have a date in mind" (with a target only; cut 4–104 weeks, recomp 8–104, bulk 8–52). As a date is picked, the screen shows the kg per week it needs, and, if that's faster than the fastest pace on offer, the date that pace reaches instead. Lose fat and build muscle: Gentle and Steady only | Lose fat, Lose fat and build muscle, Gain muscle |
| 12 | Food (optional, skippable) | Eating style (everything · pescatarian · vegetarian · vegan); "I follow religious fasting periods" (e.g. Orthodox fasts or Ramadan); allergies (milk/lactose, gluten, eggs, peanuts, tree nuts, soy, fish, shellfish, sesame); meals per day 2–6 (default 3). No free text | All |

- **A muscle goal (Gain muscle, or Lose fat and build muscle) with fewer than 2 strength
  days:** an interstitial, "Will you train at least 2 days a week?" Yes → beginner band; TDEE
  still uses the days given. No → offer Maintain (from Gain muscle) or Lose fat (from Lose fat
  and build muscle).
- **Every answer is stored** (JSONB, with `questionnaire_version: 2`); review §1.1 has the shape.
- **Units:** metric, with imperial toggles.

## Safety gates (normative; reasons in review §2)

**STOP** = no plan; a warm stop screen with no numbers that points to a professional; the user
goes into **log without targets** (decision 11).

| Condition | Outcome |
|---|---|
| Age < 16 | STOP; answers not stored |
| Age 16–17 | Maintain only; protein 1.6 g/kg if training, else 1.2; check-ins never cut calories because of weight gain |
| Age ≥ 65 | Weight loss (both loss goals) only from **BMI 25**; target BMI ≥ **23**; loss ≤ 0.5% a week; protein ≥ 1.2 g/kg in every goal; strength-training note |
| Pregnant or might be | STOP |
| Breastfeeding | Maintain only; TDEE **+400 kcal**; floor **1,800 kcal**; protein ≥ 1.3 g/kg; check-ins never decrease; a loss ≤ 0.5 kg a week is fine, faster → +5% |
| BMI < 17.5 | STOP |
| BMI 17.5–18.49 | Maintain or Gain muscle; no deficit; "if you've lost weight without trying, or eating feels hard, talk to your doctor" |
| No target at BMI ≥ 20 at least 1 kg below the current weight (about BMI < 20.4) | The loss goals aren't offered ("no room to lose"); Maintain or Gain muscle |
| BMI ≥ 40 | Allowed; "a doctor can offer extra support" note (loss goals only) |
| ED now / recovering / prefer not to say | STOP |
| ED in the past | **Log without targets by default** (a stop the user chose: `targets_declined`). If they ask for targets: Maintain only; no weight check-ins or progress numbers |
| Diabetes, hypo risk yes / not sure | Maintain and Gain muscle allowed. The loss goals only after ticking "I'll check with my diabetes team": max 0.5% a week, no Faster, carbs **always** ≥ 130 g (the calories rise if needed), a glucose note; a fasting note with religious fasting |
| Diabetes, no hypo risk | Allowed; doctor note |
| Kidney disease | STOP ("your kidney team should set your protein") |
| Weight-loss medicine (GLP-1) | Allowed; no Faster; calories as an upper limit; emphasis on protein and strength; check-ins never propose decreases |
| Weight-loss surgery < 2 years | STOP |
| Another condition managed with diet | Allowed; doctor note; no Faster |
| Health: prefer not to say | Allowed, conservative: max 0.5% a week, no Faster, an assumption line on the review; re-asked once at the 12-week re-check |
| Gain muscle with BMI ≥ 30 | Steer to Lose fat and build muscle, Lose fat or Maintain; no surplus |
| A muscle goal with < 2 strength days | Only with "I will train at least 2 days a week" |

**Wording rules** (review §2.3):
- never "underweight" or "obese";
- "now or in the past" rather than diagnoses;
- ask once, and say why;
- stop screens show no numbers;
- local support resources only after they're verified.

## The algorithm (`app/services/nutrition_plan/`, pure functions, unit-tested)

### 1. Energy

- **BMR:** Mifflin–St Jeor: `10·kg + 6.25·cm − 5·age + s`, with s = +5 for male, −161 for
  female, −78 for unspecified.
- **TDEE** = BMR × `(base + 0.025 × strength_days + 0.035 × cardio_days)`, capped at 2.0.
  - Base: mostly sitting 1.2 · some walking 1.375 · on feet 1.5 · physically hard work 1.7.
  - Breastfeeding: +400 kcal.
- **≈ 7,700 kcal per kg** of body weight change [C]; the reviews correct it.
- **Protein weight (PW)** = `min(current weight, 25 × height_m²)`.

### 2. Calories and rate: clamp first, then the date

1. **Requested rate** comes from the pace option or custom date. Pace options:

   | | Gentle | Steady (default) | Faster |
   |---|---|---|---|
   | Lose fat | 0.3% of body weight a week | 0.5% (0.75% if BMI ≥ 30) | The person's max rate (below); hidden unless, after the calorie limits, it is at least 0.05 kg a week faster than Steady |
   | Lose fat and build muscle | 0.3% | 0.5% (0.75% if BMI ≥ 30) | Never: a bigger deficit makes building muscle much harder |

   Build muscle bands (% body weight a week), by experience:

   | Experience | Gentle | Steady | Faster |
   |---|---|---|---|
   | Beginner | 0.25 | 0.375 | 0.5 |
   | Intermediate | 0.15 | 0.2 | 0.25 |
   | Advanced | 0.1 | 0.125 | 0.15 |

   Women default to the lower half of the band.

2. **Max loss rate:**
   - **0.75%** a week if BMI < 25;
   - **1.0%** if BMI ≥ 25;
   - **0.5%** if age ≥ 65, diabetes with hypo risk, or health "prefer not to say".

   Faster requests are clamped to the max. **Slower requests are accepted.**
3. **Calories:**
   - Lose fat, and Lose fat and build muscle: `TDEE − rate × 7700/7`. Deficit capped at **25%**
     of TDEE (30% if BMI ≥ 30). Floors: **1,200 / 1,500 / 1,350 kcal** (female / male /
     unspecified), and 1,800 when breastfeeding. **No BMR floor.**
   - **Hypo-risk diabetes, every goal:** the calories never go below what fits **130 g of
     carbs** with fat at its minimum and protein at the lowest the carb floor allows:
     `max(4·P + 9·0.6·PW + 520, (4·P + 520) / 0.8)`, P = 1.6 g/kg PW with strength training or a
     muscle goal, else 1.2. That can be a little above TDEE (then no deficit at all).
   - Gain muscle: `TDEE + rate × 7700/7`, clamped to a 5–15% surplus.
   - Maintain: TDEE.
4. **Effective rate** = `|TDEE − kcal| × 7 / 7700`. **The goal date comes from the effective
   rate.** The safe-date message and all reviews use it.
5. **Tiny deficit:** if the achievable deficit is < 150 kcal a day, say honestly that food alone
   can't create a meaningful deficit safely. Suggest more daily steps, or Maintain.

### 3. Macros (allocation order: protein → fat → carbs)

| Goal | Protein (g per kg PW) |
|---|---|
| Lose fat, no training | 1.6 |
| Lose fat, training | 2.0 (2.2 if BMI < 25 or deficit ≥ 20%) |
| Lose fat and build muscle | 2.2 |
| Gain muscle | 1.8 |
| Maintain | 1.6 with training, else 1.2 |

"Training" is **2 or more strength days** a week.

- **Protein:** cap 2.4 g/kg PW and **at most 35% of kcal** (never below 1.2 g/kg PW for that);
  minimum 1.2 g/kg at age ≥ 65, 1.3 when breastfeeding.
- **Fat:** target 25% of kcal (cut), 25–30% (bulk), 30% (maintain). Minimum =
  max(0.6 g/kg PW, 20% of kcal).
- **Carbs:** the rest.
- **If carbs < 100 g** (130 with hypo-risk diabetes): lower fat toward its minimum first, then
  protein toward 1.6 g/kg PW (1.2 without strength training or a muscle goal), then accept.
  With hypo-risk diabetes the calorie floor above means it never has to accept.
- **Fibre:** 14 g per 1,000 kcal, between 25 and 45 g; the texts say to increase it gradually and
  drink water.
- **Energy check:** protein × 4 + carbs × 4 + fat × 9 within ±3% of kcal; carbs absorb the rest.
- **Rounding for display:** kcal to 10, grams to 5, kg/week to 0.05. Fat never shows below its
  minimum (it rounds up). A carb floor met before rounding stays met after it: protein gives
  way by up to 10 g. Texts use "~" and call the numbers estimates. Until check-ins exist they
  don't promise them; they point to Change plan instead.
- **"Pace clamped" notice:** only when the rate shown is slower than the one asked (both to
  0.05 kg).

### 4. Pattern selection

`pattern_key = goal × pace band (gentle · steady · faster; custom dates map to the nearest) ×
training (none = under 2 strength days · beginner · trained) × phase (start · steady · plateau
· final stretch · goal reached)`. The muscle goals are never `none`.

Add-ons are separate texts: eating style, religious fasting (and, with a hypo risk, a note to
talk to the diabetes team before fasting), allergy notes, a nutrient note at ≤ 1,400 kcal,
and safety notes (age ≥ 65, GLP-1, diabetes, breastfeeding, BMI ≥ 40 on a loss goal, prefer not
to say).

### Worked example (replaces v2's, which acted on noise)

| | Value |
|---|---|
| Person | Male, 35, 180 cm, 80 kg (BMI 24.7), some walking, 3 strength days, wants −10 kg in 12 weeks |
| BMR | 1,755 |
| TDEE | 1,755 × (1.375 + 0.075) ≈ **2,545** |
| Requested rate | 0.83 kg/week (1.04%). BMI < 25 → max 0.75% = 0.6 kg/week, which is a 660 kcal deficit |
| Deficit | 660 kcal is 26% of TDEE, so it's capped at 25% = 636 kcal |
| Calories | ~**1,910 kcal** |
| Effective rate | 0.58 kg/week → **~18 weeks**. The review shows: "12 weeks is faster than we recommend. At a safe pace you'd reach 70 kg around <date> (~18 weeks)." |
| Protein | Training, BMI < 25 → 2.2 g/kg × PW 80 = 176 g, but at most 35% of 1,910 kcal → **~165 g** |
| Fat | 25% → **~55 g** (minimum 48) |
| Carbs | **~190 g** |
| Fibre | ~25 g |
| **After 2 weeks, −1 kg on the scale** | Not enough data yet (the first 7 days are skipped, and 21 usable days are needed). "Too early to judge: most of the first week is water. Keep weighing 3+ times a week." **No change** |
| **Weeks 5 and 6** | Say the 28-day slope is 0.3 kg/week against the planned 0.58 (48% slower), the difference is clear of the noise, and adherence is "most days" at both checks. Two qualifying reviews → **propose −5%** (~1,910 → ~1,810 kcal), taken from carbs. Protein stays ~165 g. The goal date is re-forecast |

## Check-ins and reviews (premium)

**Rhythm:**
- A check-in is due every **Monday** in the user's IANA time zone, which the app sends. One per
  ISO week, doable any day that week.
- Extra weigh-ins on any day are encouraged ("weigh in 3+ times a week; morning, after the
  toilet, before eating").

**Check-in screen** (20–30 s):

| Field | Required | Notes |
|---|---|---|
| Weight | Yes | Confirm if > 2.5 kg or 3% from the trend; no prefilled value to tap through |
| "How did this week go?" | Optional | Followed my plan most days · About half · Not really |
| "How are you feeling on the plan?" | Optional | Good · Often hungry · Low energy · Too full (bulk) |
| "Anything unusual this week?" | Optional chips | Ill · Travel or holiday · Something changed (→ the health re-screen) |
| Strength sessions this week | Build muscle only | — |
| Waist | Optional, every 4 weeks | Shown only, not used in decisions; never for ED-past users |

**ED-past users** get no weight check-in; at most the "How are you feeling" question.

**The trend (review issue 1):**
- Rate = the **least-squares slope of daily weights over the last 28 days**.
- Needs ≥ 21 usable days and ≥ 8 weigh-ins.
- **Excluded days:**
  - the first 7 days of a new plan (cut or bulk);
  - 3–7 days after any change of ≥ 50 g a day in carbs, including an applied update;
  - days marked ill or travel.
- **Too few weigh-ins** (fewer than ~3 a week): no decreases, and a prompt to weigh in more.

**Acting on the trend:**
- Only when `|observed − planned| > max(25% of planned, 0.2 kg/week)` **and** the difference is
  more than **2 × the slope's standard error**.
- **Decreases** need **2 consecutive qualifying reviews**, or 1 if observed < 50% of planned.
- **Increases** for a loss that's too fast can act on **1** review.
- **At most one calorie change every 2 weeks,** except for the too-fast safety increase.

**Decision table:**

| Situation | Proposed update |
|---|---|
| Lose fat, slower (qualifying), adherence good | **−5% kcal**, taken from carbs then fat (fat ≥ its minimum); **protein unchanged** |
| Lose fat and build muscle, slower | A slower scale is expected (the muscle gained offsets some fat lost): no decrease while the waist is shrinking or lifts are rising; otherwise as Lose fat |
| Lose fat, slower, but adherence "about half" / "not really" with < 80% of days logged | **No decrease.** An adherence message instead |
| Lose fat, slower, and "often hungry" / "low energy" | Offer to **extend the date** before −5%; two weeks in a row → offer the gentler pace |
| Lose fat, 25–50% faster than planned | **+5% kcal** |
| Lose fat, > 50% faster, or > max rate | **+10% kcal**; protein at the top of its range |
| At a calorie floor and still slower | No further cut. Offer to extend the date, or add steps |
| Build muscle, gaining above the band top (qualifying) | **−100 kcal** (−150 if far above) |
| Build muscle, gaining below the band bottom, 2 reviews | **+100–150 kcal**. If training dropped, ask about training instead |
| Maintain, outside ±max(1.5 kg, 2% body weight) of the start and still moving away over 28 days | **±100–150 kcal**. 16–17: no decreases |
| Protein weight changed ≥ 5 kg, or protein would move ≥ 10 g | A **proposed** protein update; otherwise protein stays fixed |
| GLP-1 users | Never decrease. "Too fast" → +5%, plus "focus on protein, tell your prescriber" |
| Breastfeeding | Never decrease; a loss faster than 0.5 kg a week → +5% |

**Adaptive TDEE (decision 7):**
- A day counts as logged if it's marked complete, or has ≥ 60% of the kcal target and ≥ 2 meals.
- When ≥ 80% of the last **21–28 days** are logged: `TDEE_observed = average intake + (kg lost
  × 7700 / days)`.
- On first use it's clamped to ±25% of the formula's TDEE, then blended 50/50 with it. Later it
  gets more weight.

**Re-forecast:** each review re-forecasts the goal date from the effective trend. If it's > 25%
behind, the review offers to extend the date (recommended) before a stricter plan.

**Goal reached:** move to maintenance (adaptive TDEE if available) in 1–2 steps over ≤ 2 weeks.

## Log without targets (decision 11)

- `users.targets_mode`: `default` (basic, or no plan) · `plan` (an active plan) · `none`
  (stopped users, and people with an eating disorder in the past who didn't ask for targets).
- In `none`:
  - `GET /users/me` returns `targets: null`;
  - the app hides every target bar, "remaining" and % of goal, and shows plain totals;
  - food logging and food details work as usual, with nutrients shown and no "% of goal".
- Leaving `none` needs a health re-screen that no longer triggers a stop.

## The pattern library (written once with AI, reviewed, committed)

- **Files:** `app/services/nutrition_plan/patterns/en.json` and `ro.json`. They hold:
  - plan texts per `pattern_key` (summary, why[], guidance[], cautions[]), with placeholders
    (`{kcal}`, `{protein_g}`, `{rate_kg_week}`, `{goal_date}`, `{weeks_left}`, …);
  - check-in messages (too early, on track, slower, faster, floor reached, low adherence, hungry
    or tired, plateau, final stretch, goal reached);
  - add-ons;
  - **stop screens** (no numbers).
- **Generator:** `scripts/generate_patterns.py` (official `anthropic` SDK, `messages.parse`
  structured output; default model `claude-opus-5-5`). It's run by a developer, never by the
  API.
- **Checks:** every key in both languages; valid placeholders; no hard-coded numbers.
- **Review:** the nutrition-expert agent plus a person, before committing.
- **Until generated:** hand-written English texts for the main patterns, so the build doesn't wait.

## Data model

- **`users`** (existing): add `timezone` (IANA, nullable → UTC) and `targets_mode` (text,
  default `default`).
- **`nutrition_goals`**:
  - columns: `id`, `user_id` (cascade), `questionnaire_version`, `answers` (JSONB, every answer),
    `consent_version`, `consented_at`, `created_at`;
  - not stored for under-16s.
- **`nutrition_plans`**:
  - columns: `id`, `user_id`, `goal_id`, `status` (draft · active · archived; at most one
    active), `reason` (initial · review · change · maintenance_transition), `previous_plan_id`,
    `pattern_key`, `baseline` (JSONB: BMR, TDEE, PW, requested and effective rate, rules
    applied, inputs), `targets` (JSONB), `goal_date`, `language`, `created_at`, `activated_at`;
  - texts are rendered when read.
- **`weight_entries`:** `id`, `user_id`, `measured_on` (one per day; the latest replaces it),
  `weight_kg`, `excluded` (bool: ill or travel), `created_at`.
- **`check_ins`:** `id`, `user_id`, `iso_week` (unique per user), `weight_entry_id`,
  `adherence`, `feeling`, `unusual` (text[]), `strength_sessions`, `waist_cm`, `created_at`.
- **`plan_reviews`:**
  - columns: `id`, `user_id`, `plan_id`, `check_in_id`, `window_start`, `window_end`,
    `observed_rate`, `slope_se`, `planned_rate`, `usable_days`, `weigh_ins`, `tdee_estimate`,
    `logged_days_ratio`, `qualifying` (bool), `decision`, `proposed_plan_id`, `status`
    (no_change · too_early · proposed · applied · dismissed), `created_at`.

Everything cascades with the account.

## API endpoints

All are **premium** (`require_plan("premium")`, so basic users get 403) and need sign-in.

| Method and path | Purpose |
|---|---|
| `POST /users/me/goals`, `GET /users/me/goals` | Save answers (with consent) / the latest answers. Returns a **gate result** (`ok` · `maintain_only` · `stop`, with reasons) |
| `POST /users/me/nutrition-plans` `{goal_id}` | Build a draft instantly: targets, the effective rate, the goal date, the safe-date note and rendered texts |
| `GET /users/me/nutrition-plans/active` | The active plan, with rendered texts, the goal date and progress |
| `POST /users/me/nutrition-plans/{id}/activate` | Accept a draft (initial, change or review update) |
| `POST /users/me/weights` `{weight_kg, measured_on?}` | An extra weigh-in (no review) |
| `GET /users/me/weights?from=` | Weigh-ins and the trend, for the chart |
| `POST /users/me/check-ins` `{weight_kg, adherence?, feeling?, unusual?, strength_sessions?, waist_cm?}` | This week's check-in. Runs the review and returns it (too early / no change / proposed update) |
| `GET /users/me/plan-review` | The latest review, and whether this week's check-in is due |
| `POST /users/me/plan-review/{id}/dismiss` | "Not now" on a proposed update |

- **`GET /users/me` adds:** `check_in_due` (bool), `targets_mode`, and `targets: null` when
  `targets_mode = none`.
- **`PATCH /users/me`:** no `targets`; it accepts `timezone`.

## Mobile app

- **Questionnaire:** as specified above. Gate and stop screens. A review screen with the
  safe-date proposal.
- **Profile tab:**
  - basic: the default targets and the premium card;
  - premium: the plan (read-only targets, texts, goal date, progress), the weight trend chart
    (planned against actual), the check-in card, the plan-update card, Change plan, and the
    "Something changed?" re-screen;
  - Account at the bottom.
- **Home:** the Monday check-in card.
- **Log without targets:** hide targets everywhere, as described above.
- **Reminders** (a later phase): Monday push.

## Quality

- **Unit tests:**
  - BMR, TDEE, PW, rates, clamp-first dates, calories, the macro allocation order, rounding;
  - every safety gate and floor;
  - target validation; the tiny-deficit message;
  - the trend slope and its standard error; the exclusions; the qualifying rules;
  - every row of the decision table;
  - adaptive TDEE;
  - the pattern files complete in both languages.
- **Simulations:** scripted users over 16 weeks with **realistic noise** (σ 0.5–0.8 kg,
  autocorrelated, ±1–2 kg cycle swings):
  - fast, slow, stalled, under-logging, erratic weigh-ins, illness weeks;
  - checks: no limit ever broken, no see-sawing, first decrease no earlier than week ~4–5.
- **Expert review:** the nutrition-expert agent re-checks the implementation, the simulations
  and the pattern library before release.
- **Before launch:** a qualified person checks GDPR (Art. 9), the EU MDR "software as a medical
  device" boundary, and the Romanian specifics (review §2.3).

## Implementation phases

1. **Algorithm, gates and plans (API):** the questionnaire schema v2; gates; the algorithm
   (clamp-first); hand-written English pattern texts; goals and plans endpoints;
   `targets_mode`; tests.
2. **App:** the questionnaire with gates and stop screens; review; the Profile plan view;
   Change plan; log without targets; the premium card for basic users.
3. **Weekly check-ins (API and app):** weigh-ins, check-ins, the 28-day trend, reviews and the
   decision table, update proposals, the chart, the time zone, the Monday card; simulations.
4. **Pattern library:** `generate_patterns.py` with Claude, EN and RO, then nutrition-expert and
   human review.
5. **Adaptive TDEE**, Monday push reminders, the transition to maintenance.

## Out of scope

- AI calls per user request.
- Meal plans with recipes and shopping lists.
- Apple Health or Google Fit syncing; it could feed `weight_entries` later.
- Changing targets without the user accepting.
- Medical nutrition therapy; those users are stopped and referred.
- Body-fat %, photos, sleep, stress and cycle tracking (review §3, §6).

## Changes in v3.1 (2026-10-31)

The nutrition-expert agent reviewed the implementation of phases 1–2 against this spec and
current guidance. Verdict: the core matches mainstream practice. Adopted:

- **A fourth goal, Lose fat and build muscle** (`recomp`; body recomposition), asked for by a
  user who wanted to build muscle while losing weight. It's a variant of Lose fat: every loss
  gate applies, Gentle or Steady only, protein 2.2 g/kg, 2+ strength days (or the intent), and
  the target is optional. Build muscle is shown as **Gain muscle**.
- **Older adults (must fix):** from 65, weight loss only from BMI 25 and to a target BMI ≥ 23
  (GLIM counts BMI < 22 as a malnutrition criterion from 70; ESPEN advises against weight-loss
  diets in older people without obesity).
- **Hypo-risk diabetes (must fix):** carbs ≥ 130 g is now guaranteed by a calorie floor; before,
  the macro step could accept ~120 g. This resolves a contradiction between the gate table
  and the macro section.
- **Protein:** "training" now means 2+ strength days; protein is at most 35% of kcal; 1.6 g/kg
  (not 1.8) for Lose fat without training; ≥ 1.3 g/kg when breastfeeding.
- **Lowest target BMI 20** (was 18.5), leaving a margin for day-to-day swings; the 0.5% cap for
  BMI 18.5–20 and its note are gone, as no loss is planned there now.
- **Eating disorder in the past:** log without targets is the default.
- **Faster** is hidden when the limits make it no faster than Steady.
- **Texts:**
  - a fasting note for people with a hypo risk;
  - a doctor pointer at BMI 17.5–18.49 and for severe or lasting dizziness;
  - a nutrient note at ≤ 1,400 kcal;
  - the BMI ≥ 40 note only on loss goals;
  - no promises of check-ins until they exist;
  - wording fixes ("mostly from stored fat", "within the limits we use for safety").
- **Display:** fat never shows below its minimum; the "pace clamped" notice only when the shown
  rate changes.
- **"I have a date in mind"** needs a target, and says on the pace screen, as the date is
  picked, when it's sooner than a safe pace reaches and which date it will be instead.
  Before, that only showed after the plan was built, so it looked like the date was ignored.

Not adopted yet: a smaller cardio factor (0.025–0.03 a day instead of 0.035; the expert's
confidence was medium-low), and a milestone for long Gain muscle targets.
