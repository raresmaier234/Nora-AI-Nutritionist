# Nutrition-expert review of the adaptive nutrition plan (2026-10-30)

Review of `ai-nutrition-plan.md` (v2), written with the `nutrition-expert` agent role
(`apps/api/.claude/agents/nutrition-expert.md`). Read-only review; nothing was implemented.

**Labels:**
- **[E]** = an estimate.
- **[C]** = a reasonable convention rather than hard evidence.
- **PW** = protein weight = `min(current weight, 25 × height_m²)` (issue 16).

**Verdict on the v2 draft: Needs Review.** The overall structure is sound: formula, safety caps,
then adaptive check-ins. The problems are in the details:
- Several safety cases get a plan when they should get a referral: pregnancy, a current eating
  disorder, kidney disease.
- Insulin-treated diabetes and breastfeeding need specific rules.
- The target weight is never validated.
- The plan's dates ignore its own calorie limits.
- The check-in rules would act on water-weight noise.

## 1. The questionnaire

### 1.1 Overview (in screen order)

| # | Screen | Wording | Answer type and validation | Required | Shown for | Feeds |
|---|---|---|---|---|---|---|
| 0 | Consent | "Nora uses your answers, including health information, to build and adjust your plan." | Checkbox "I agree" + privacy link | Yes | All | GDPR Art. 9 consent, `consented_at` |
| 1 | Goal | "What's your main goal right now?" | `lose_fat` "Lose fat" · `build_muscle` "Build muscle" · `maintain` "Maintain my weight" | Yes | All | Energy direction, macro table, pattern `goal`, branching |
| 2 | Birth | "When were you born?" | Month + year. Age is computed as the **youngest possible** (last day of that month). Allowed 16–100 | Yes | All | BMR age term; gates (<16 stop, 16–17 maintain only, ≥65 rules) |
| 3 | Sex | "Which should we use for your energy estimate?" | `female` · `male` · `unspecified` "Prefer not to say" | Yes | All | BMR constant (−161 / +5 / −78), calorie floor (1,200 / 1,500 / 1,350), which health chips show |
| 4 | Height | "How tall are you?" | Whole cm, 120–230; ask to confirm if <140 or >210; ft/in toggle | Yes | All | BMR, BMI, PW |
| 5 | Weight | "What do you weigh now?" | kg to 0.1, 30–300; confirm if <40 or >200; lb toggle | Yes | All | BMR, BMI gates, rate as % of body weight, PW. **Saved as the first `weight_entries` row** |
| 6 | Health | "Does any of these apply to you?" | Multi-select chips (§2). "None of these" and "Prefer not to say" are exclusive | Yes | All | Safety gates |
| 6a | Diabetes follow-up | "Do you take insulin, or tablets that can cause low blood sugar (hypos), such as gliclazide or glimepiride?" | Yes · No · Not sure | If 6 includes diabetes | — | Hypo-risk rules |
| 6b | ED follow-up | "Thanks for telling us. Is it something you're dealing with now?" | "Yes, or I'm still recovering" · "No, it's in the past" · "Prefer not to say" | If 6 includes ED | — | Stop vs maintain-only |
| — | Gate screen | Shown only if age, BMI or health changes the goal (§2) | "Continue with Maintain" / "Back", or a stop screen | — | — | — |
| 7 | Daily activity | "Outside of workouts, how active is a normal day?" | 4 levels with step and job anchors (§4) | Yes | All | Daily-movement (NEAT) multiplier |
| 8 | Exercise | "In a normal week, how many days do you do…" | Two steppers, 0–7 each: "Strength training" and "Cardio or sport, 30+ min". Confirm if the total is >10 | Yes (0 is valid) | All | Exercise add-on to TDEE; the "trains" flag for protein; pattern training |
| 9 | Lifting experience | "How long have you been strength training regularly?" | "Not yet" · "Less than 1 year" · "1–3 years" · "More than 3 years" | Yes | Strength days ≥ 1, or goal = Build muscle | Bulk rate band, protein rule, pattern `training` |
| 10 | Target | "What weight would you like to reach?" | Lose fat: ≤ current − 1 kg and target BMI ≥ 18.5. Build muscle: ≥ current + 1 kg, or "No target, just build steadily" (the default) | Lose fat: yes. Build muscle: optional | Lose fat, Build muscle (after the gates) | Total change, goal date, final-stretch phase |
| 11 | Pace | "How fast would you like to go?" | 3 options, each showing kg/week and the date **after calorie clamps**, plus "I have a date in mind" (date picker: 4–104 weeks for a cut, 8–52 for a bulk) | Yes | Lose fat, Build muscle | Rate; rate band for the pattern |
| 12 | Food (optional, Skip) | "Anything we should know about how you eat?" | Eating style (single choice); allergies (multi-select chips); meals per day 2–6 (default 3). No free text | No | All | Add-on paragraphs, food-idea filtering, protein-per-meal text |
| — | Review | Plan, safe-date proposal, notes | | | | |

Activity, exercise and experience (7–9) come **before** target and pace (10–11): the pace screen
needs TDEE and the calorie limits to show honest weekly rates and dates (issue 2).

**Suggested `answers` JSONB** (store every answer, with the version):

```json
{"questionnaire_version":2,"goal":"lose_fat","birth_year":1994,"birth_month":5,"sex":"female",
 "height_cm":165,"weight_kg":72.4,"health":["diabetes"],"diabetes_hypo_risk":"no","ed_status":null,
 "diabetes_team_ack":false,"activity":"some_walking","strength_days":3,"cardio_days":1,
 "lifting_experience":"lt_1y","target_weight_kg":65.0,"pace":"steady","target_date":null,
 "eating_style":"omnivore","religious_fasting":false,"allergies":["milk"],"meals_per_day":3,"units":"metric"}
```

### 1.2 Notes per question

- **Q0 Consent.**
  - Wording: "Your answers are stored only in Nora, used to build and adjust your plan, and you
    can delete them any time."
  - It comes before any health question.
  - If declined: no plan, and the default targets stay.
  - Store the consent text version.
- **Q1 Goal.**
  - Helper: "You can change this any time."
  - Subtitles: Lose fat, "Lose weight slowly while keeping muscle"; Build muscle, "Gain slowly
    while you strength train"; Maintain, "Stay about where you are and eat well".
- **Q2 Birth month + year.**
  - The month is needed: with the year alone, someone born in 2010 is 15 or 16 today.
  - Under 16: stop screen, and **don't store** the answers.
  - Recompute age at every plan build and review.
  - Mifflin–St Jeor was built on adults aged 19–78; for 16–17 it's an acceptable starting
    estimate [C].
- **Q3 Sex.**
  - Helper: "Energy formulas differ by sex. On hormone therapy? Choose what fits your body now,
    or Prefer not to say."
  - −78 for unspecified is a convention [C]. Its worst-case error is about ±83 kcal, small next
    to the formula's own ±10%.
- **Q4 Height.** Self-reported height runs 1–2 cm high: about 6–12 kcal of BMR, negligible.
- **Q5 Weight.**
  - Helper: "If you can, weigh yourself this morning: after the toilet, before eating or
    drinking."
  - Save it as the first weigh-in.
  - Don't show BMI or BMI labels to the user.
- **Q8 Exercise.**
  - Helper: "Count a typical week from the last month, not your best week. Walking belongs in
    the previous question."
  - The draft only counted strength training; cardio and sport were invisible.
  - People overreport exercise (e.g. NHANES, Troiano 2008), so the add-ons are conservative.
- **Q9 Lifting experience.**
  - Helper: "Count only time when you trained at least twice a week. Coming back after a long
    break? Choose 'Less than 1 year'."
  - Bands: not yet or <1 year → beginner; 1–3 years → intermediate; 3+ years → advanced.
    Pattern `training`: none (0 strength days) / beginner / trained.
  - **Build muscle with 0 strength days** gets an interstitial: "Muscle is built by strength
    training; extra food alone mostly adds fat. Will you train at least 2 days a week?" Yes →
    beginner band, with TDEE still using 0 days. No → offer Maintain.
  - Evidence: muscle gain slows as people near their genetic ceiling; untrained people gain lean
    mass several times faster. The exact bands are coaching models [C]. Iraki 2019 suggests
    about 0.25–0.5% of body weight a week for novice and intermediate.
- **Q10 Target weight.**
  - Lose fat with a target BMI < 18.5 is blocked: "The lowest target we can set for your height
    is {x} kg."
  - Build muscle with a target BMI > 27 gets a warning (not a block).
  - "No target" for Build muscle means a 16-week block, then "what next?".
  - Optional: if the planned loss is > 15% of body weight, offer a first milestone at 10% [C].
- **Q11 Pace.**

  | Goal | Gentle | Steady (default) | Faster |
  |---|---|---|---|
  | Lose fat | 0.3% body weight a week | 0.5% (0.75% if BMI ≥ 30) | The person's maximum (issue 13). Hidden if it isn't above Steady |
  | Build muscle | Bottom of the band | Middle of the band | Top of the band |

  - A custom date that's too fast gets the nearest safe date.
  - A date slower than Gentle is **accepted**, because slower is never unsafe. If the deficit is
    then under ~150 kcal a day, say it's close to maintenance.
- **Q12 Food (optional).**
  - Eating style: "I eat everything" · "Pescatarian" · "Vegetarian" · "Vegan". Optional toggle:
    "I follow religious fasting periods (e.g. Orthodox fasts)".
  - Allergies and intolerances: Milk/lactose · Gluten · Eggs · Peanuts · Tree nuts · Soy · Fish
    · Shellfish · Sesame.
  - Meals per day: 2–6.
  - **Drop the free-text "foods to avoid":** with no AI per user, nothing reads it.
  - Macros don't change with any of this. Allergies filter any food examples.
  - Vegan: keep the same g/kg of protein (Hevia-Larraín 2021).

**Time:** about 2 minutes for Lose fat or Build muscle (13–14 screens), about 1.5 minutes for
Maintain.

## 2. Safety screening

### 2.1 Health chips (Q6)

- Title: "Does any of these apply to you?"
- Helper: "We ask so your plan is safe. Your answers stay private in Nora."

| Key | Chip label | Shown when |
|---|---|---|
| `pregnant` | "I'm pregnant, or might be" | sex ≠ male |
| `breastfeeding` | "I'm breastfeeding" | sex ≠ male |
| `diabetes` | "Diabetes" (→ 6a) | always |
| `kidney` | "Kidney disease (CKD, dialysis or a transplant)" | always |
| `eating_disorder` | "An eating disorder, now or in the past" (→ 6b) | always |
| `glp1` | "I take a weight-loss medicine (e.g. Wegovy, Ozempic, Mounjaro)" | always |
| `bariatric` | "Weight-loss surgery in the last 2 years" | always |
| `other_diet_condition` | "Another condition my doctor manages with diet" | always |
| `none` | "None of these" (exclusive) | always |
| `prefer_not` | "Prefer not to say" (exclusive) | always |

### 2.2 What each answer does

**STOP** = no plan; a kind screen pointing to a professional; food logging stays available.

| Condition | Outcome | Rules |
|---|---|---|
| Age < 16 | **STOP** | Don't store the answers |
| Age 16–17 | Maintain only | Protein 1.6 g/kg if training, else 1.2. Check-ins never cut calories because of weight gain (that's growth) |
| Age ≥ 65 | Allowed | Loss ≤ 0.5% a week; protein ≥ 1.2 g/kg in every goal; strength-training note |
| Pregnant or might be | **STOP** | Energy needs rise (about +340 / +450 kcal in the 2nd / 3rd trimester) and weight gain is expected |
| Breastfeeding | Maintain only, plus a lactation allowance | TDEE **+400 kcal** [C]; floor 1,800 kcal [C]; check-ins never decrease calories; a slow loss ≤ 0.5 kg a week is fine |
| BMI < 17.5 | **STOP** | Possible eating disorder or medical cause [C] |
| BMI 17.5–18.49 | Maintain **or Build muscle** | No deficit; a surplus is appropriate |
| BMI 18.5–19.99 + Lose fat | Allowed with a cap | Max 0.5% a week; target BMI ≥ 18.5; a gentle note |
| BMI ≥ 40 | Allowed | Note: "A doctor can offer extra support for weight loss." |
| ED now / recovering / prefer not to say | **STOP** | "Prefer not to say" is treated as current |
| ED in the past | Maintain only | No weight check-ins or progress numbers; consider letting the user hide calories |
| Diabetes, hypo risk yes / not sure | Maintain and Build muscle allowed. Lose fat only after ticking "I'll check with my diabetes team" | Max 0.5% a week; no "Faster"; carbs ≥ 130 g a day; a glucose note |
| Diabetes, no hypo risk | Allowed | Doctor note |
| Kidney disease | **STOP**: "your kidney team should set your protein" | 0.8 g/kg is wrong for most of this group (KDOQI 2020) |
| Weight-loss medicine (GLP-1) | Allowed | No "Faster"; calories as an upper limit; stress protein and strength training; check-ins never propose decreases |
| Weight-loss surgery in the last 2 years | **STOP** (bariatric team) | — |
| Another condition managed with diet | Allowed | Doctor note; no "Faster" |
| Prefer not to say | Allowed, conservative | No "Faster"; max 0.5% a week; a review-screen line; re-ask once at the 12-week re-check |
| Build muscle with BMI ≥ 30 | Steer | Offer Lose fat or Maintain; no surplus |

### 2.3 Wording and behaviour rules

- Ask once and say why.
- Use "now or in the past", not diagnostic labels.
- Never show "underweight" or "obese".
- Stop screens are warm and short, show no numbers, and keep logging available. **Add local
  resources only after verifying them.**
- **Product gap:** stopped users fall back to the basic default targets (2,000 kcal, 150 g
  protein). That's inappropriate for kidney disease, pregnancy and ED. Recommend a "log without
  targets" mode.
- **Re-screen** every 12 weeks, and from a "Something changed?" link on the check-in card.
- **Regulatory note (not legal advice):** stopping and referring for diseases, rather than
  adjusting for them, helps keep Nora clear of EU MDR "software as a medical device" territory.
  Have a qualified person check this.

## 3. Drop, merge, add

| Item | Decision | Why |
|---|---|---|
| Target weight + date | **Split** into Target (validated) and Pace (options with computed dates; a date picker as a secondary option) | People pick unrealistic dates |
| Birth year | **Month + year** | The age gates need it |
| Activity | **Rewrite** with step and job anchors | Vague labels get overestimated |
| Strength training | **Split**: days on the Exercise screen with cardio; experience only when relevant | Saves a screen |
| Eating pattern, allergies, foods to avoid, meals per day | **Merge** into one optional screen; **drop** the free text | Nothing reads free text |
| Health | **Expand** to multi-select with 2 follow-ups | Covers the real risk groups |
| **Add:** cardio/sport days | Yes | The biggest TDEE blind spot |
| **Add:** diabetes hypo risk, ED now/past, GLP-1, bariatric surgery | Yes | Each changes the outcome |
| Steps as a number, job type, body-fat %, waist at onboarding, weight history, sleep / stress, menstrual cycle | No | No algorithm input, or too unreliable; adaptive TDEE covers it |

## 4. Activity definitions and mapping

**Screen 7.** "Outside of workouts, how active is a normal day?"

Helper: "Don't count workouts; they're next. Your phone's step count is a good guide. Between two?
Pick the lower one; your check-ins will correct it."

| Key | Label | Description | Daily-movement multiplier [E] |
|---|---|---|---|
| `mostly_sitting` | Mostly sitting | Desk job, studying or driving; under ~5,000 steps | 1.2 |
| `some_walking` | Some walking | Sitting job, but walking to work, errands, the dog; ~5,000–8,000 steps | 1.375 |
| `on_feet` | On my feet most of the day | Shop, café, nursing, teaching, small children; ~8,000–12,000 steps | 1.5 |
| `physical_work` | Physically hard work | Construction, farming, warehouse, cleaning, delivery; over 12,000 steps | 1.7 |

```
multiplier = base + 0.025 × strength_days + 0.035 × cardio_days      (cap 2.0)
TDEE = BMR × multiplier
```

- The classic 1.55 / 1.725 values already include exercise. Using them for "outside training"
  and then adding exercise counts it twice.
- Any individual can be off by ±10–20%. What makes the numbers right is the adaptive check-in
  loop, not the multiplier.

## 5. Problems in the plan's algorithm

| # | Problem | Severity | Suggested rule or value |
|---|---|---|---|
| 1 | **Check-in decisions act on noise.** Daily weight scatter is ~0.5–0.8 kg; the ±25% tolerance is smaller than the noise of a 14-day trend | **Must fix** | Rate = least-squares slope of daily weights over the **last 28 days** (min 21 usable days and ≥ 8 weigh-ins), skipping the first 7 days of a new plan. Act only when \|observed − planned\| > max(25% of planned, 0.2 kg/week) **and** > 2 × the slope's standard error. Decreases need 2 consecutive qualifying reviews (or 1 if observed < 50% of planned). "Too fast" can act on 1 review. Below ~3 weigh-ins a week: no decreases. The first possible decrease on a new cut is about week 4–5. Rewrite the worked example |
| 2 | The rate and goal date are computed **before** the deficit cap and floors, so dates are wrong | **Must fix** | Clamp the calories first; effective rate = (TDEE − kcal) × 7 / 7,700; the date comes from the effective rate |
| 3 | The target weight is never validated | **Must fix** | Lose fat: ≤ current − 1 kg and target BMI ≥ 18.5. Build muscle: ≥ current + 1 kg; warn above BMI 27 |
| 4 | Build muscle with no training is undefined | **Must fix** | Interstitial (Q9); no surplus without the intent to train ≥ 2 days a week |
| 5 | Pregnancy gets maintenance | **Must fix** | STOP |
| 6 | Breastfeeding maintenance misses ~330–400 kcal of milk production | **Must fix** | +400 kcal, floor 1,800, no decreases |
| 7 | Kidney disease → 0.8 g/kg is wrong for dialysis and for CKD 3–5 | **Must fix** | STOP and refer |
| 8 | ED history is one group; a current ED still gets calorie numbers | **Must fix** | Follow-up 6b: now / unsure → STOP; past → maintain only, no weight numbers |
| 9 | Insulin or sulfonylurea hypo risk not handled | **Must fix** | 6a + acknowledgement; max 0.5% a week; carbs ≥ 130 g; no "Faster" |
| 10 | Activity levels count exercise twice and ignore cardio | Should fix | §4 |
| 11 | "Never below BMR" caps sedentary people at ~17% deficit | Should fix | Drop the BMR floor; keep the sex floors and the 25% / 30% cap (or ≥ 0.85 × BMR [C]) |
| 12 | Tiny deficits presented as a plan | Should fix | Under 150 kcal a day: say so honestly; suggest steps or Maintain |
| 13 | 1.0% a week for everyone | Should fix | Max 0.75% if BMI < 25; 1.0% if ≥ 25; 0.5% if age ≥ 65, BMI < 20, diabetes with hypo risk, or health "prefer not to say" |
| 14 | Slower requests pushed faster | Should fix | Clamp only on the unsafe side |
| 15 | Lose fat 2.0 g/kg protein even without training | Should fix | No training: 1.6 g/kg PW (1.8 if deficit ≥ 20%). Training: 2.0; with BMI < 25 or deficit ≥ 20%: 2.2. Cap 2.4 |
| 16 | Reference-weight cliff at BMI 30 (a 0.3 kg change moves protein by 30 g) | Should fix | PW = min(weight, 25 × height_m²) for everyone |
| 17 | Fat minimum 0.6 g/kg of total weight is too high at high weights | Should fix | Fat min = max(0.6 g/kg PW, 20% of kcal) |
| 18 | No allocation order at low calories | Should fix | Protein → fat → carbs; if carbs < 100 g (130 with hypo-risk diabetes), lower fat to its minimum, then protein toward 1.6 g/kg PW |
| 19 | No rules for age ≥ 65 | Should fix | Protein ≥ 1.2 g/kg; loss ≤ 0.5% a week; strength note |
| 20 | Build muscle at BMI ≥ 30; BMI 17.5–18.5 can't build; lose fat at BMI < 20 uncapped | Should fix | As in §2 |
| 21 | Maintain has no review rules | Should fix | On track within ±max(1.5 kg, 2% body weight) of the start; outside that and still moving over 28 days → ±100–150 kcal, proposed. 16–17: no decreases |
| 22 | "Protein recalculated when it moves by ≥ 1 g" is a silent change and false precision | Should fix | Recalculate only when PW changes by ≥ 5 kg or protein by ≥ 10 g, as a proposed update |
| 23 | "+5–10%" undefined | Should fix | +5% if 25–50% faster than planned; +10% if > 50% faster or > 1% a week. Bulk: −100 / −150 kcal |
| 24 | The water/glycogen exclusion only applies to cuts | Should fix | Also the first 7 days of a bulk, and 3–7 days after any change of ≥ 50 g a day in carbs |
| 25 | "Logged day" undefined; 14 days is too noisy for adaptive TDEE | Should fix | A day counts if marked complete, or ≥ 60% of the kcal target and ≥ 2 meals; use 21–28 days; on first use, clamp to ±25% of the formula |
| 26 | The step-by-step reverse diet has weak evidence | Should fix | Move to maintenance in 1–2 steps over ≤ 2 weeks; warn about +1–2 kg of water and glycogen |
| 27 | GLP-1 users would get eat-more / eat-less proposals | Should fix | As in §2 |
| 28 | False precision ("1,847 kcal") | Should fix | Round kcal to 10, grams to 5, kg/week to 0.05; "~" in texts |
| 29 | `answers` only holds a few fields | Should fix | Store all answers and the questionnaire version |
| 30–37 | Mifflin–St Jeor; 7,700 kcal/kg; the deficit caps and floors; bulk bands; build/maintain protein; fibre; energy check; one change per 2 weeks | Fine | Optional tweaks: women default to the lower half of the bulk band; fibre cap 40–45 g with "increase gradually" |

## 6. Monday check-in

Target: 20–30 seconds.

| Question | Ask? | How it's used |
|---|---|---|
| **Weight** (required). "Morning, after the toilet, before eating." Confirm if > 2.5 kg or 3% from the trend | Yes | The trend; encourage 3+ weigh-ins a week |
| "How did this week go?" Followed my plan most days · About half · Not really | Yes (optional) | Low adherence with < 80% of days logged → **no calorie decrease**; adherence text instead. Safety increases still apply |
| "How are you feeling on the plan?" Good · Often hungry · Low energy · Too full (bulk) | Yes (optional) | Slower and hungry or tired → offer "extend the date" before "−5%"; two weeks in a row → offer the gentler pace |
| "Anything unusual this week?" Ill · Travel or holiday · Something changed | Yes (optional chips) | Ill or travel days are left out of decisions; "Something changed" opens the health re-screen |
| Strength sessions this week | Build muscle only | Slow gain with less training → ask about training instead of adding calories |
| Waist | Optional, every 4 weeks; not for ED-history users | Shown only, not used in decisions |
| Health re-check | Every 12 weeks, plus on demand | Re-runs the gates |
| Not worth asking | — | Photos, sleep, stress, mood, cycle phase, body-fat %, steps |

ED-past users have no weight check-in.

## 7. Confidence

- **High:**
  - the safety gating;
  - the check-in noise problem and the direction of the fix;
  - the date bug, target validation, the undefined no-training bulk, and the reference-weight
    cliff.
- **Medium:** the protein and fat values, the rate caps and the bulk bands.
- **Medium-low:** the activity multipliers, the BMI 17.5 stop, the breastfeeding values, and the
  28-day window and 0.2 kg/week tolerance. Validate them with simulations using realistic weight
  noise.
- **Not covered:** GDPR, EU MDR and Romanian legal specifics (for a qualified person); verified
  local support resources.
