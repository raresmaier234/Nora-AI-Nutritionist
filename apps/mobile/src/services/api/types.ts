export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'http_client_error'
  | 'http_server_error'
  | 'invalid_response';

export interface HealthResponse {
  status: string;
}

/** Energy and macros per 100 g, as the API sends them (plain numbers). */
export interface Per100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** GET /foods?q= — one food from the database. */
export interface FoodSearchResult {
  id: number;
  name: string;
  per_100g: Per100g;
}

/** How much of one nutrient 100 g contains, e.g. { key: 'vitamin_c', unit: 'mg', amount: 8.7 }. */
export interface NutrientAmount {
  key: string;
  unit: 'g' | 'mg' | 'ug';
  amount: number;
}

/**
 * GET /foods/{id} — a food's full nutrient profile, per 100 g. `per_100g` is null when the food
 * lacks calories or a macro; `nutrients` leaves out anything without data.
 */
export interface FoodDetail {
  id: number;
  name: string;
  per_100g: Per100g | null;
  nutrients: NutrientAmount[];
}

export type MealSlug = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type FoodLogSource = 'database' | 'custom' | 'barcode' | 'photo' | 'recipe';

/** One logged food, as returned by /meals/entries. */
export interface FoodLogEntry {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  meal: MealSlug;
  food_id: number | null;
  source: FoodLogSource;
  name: string;
  per_100g: Per100g;
  amount: number;
  unit: string;
  grams: number;
  /** When it was eaten — ISO 8601 with a UTC offset. */
  logged_at: string;
}

/**
 * POST /meals/entries. Either `food_id` (a database food — the server copies its name and
 * values), or `name` + `per_100g` for foods not in the database.
 *
 * `logged_at` is when it was eaten; the server files the entry under that day, and under the
 * meal for that hour unless `meal` is sent.
 */
export type FoodLogEntryCreate = {
  logged_at: string;
  meal?: MealSlug;
  amount: number;
  unit: string;
  grams: number;
} & (
  | { food_id: number; source?: 'database' }
  | { name: string; per_100g: Per100g; source: Exclude<FoodLogSource, 'database'> }
);

/** PATCH /meals/entries/{id} — omitted fields are left unchanged. */
export interface FoodLogEntryUpdate {
  /** Moves the entry to that time (and day). */
  logged_at?: string;
  meal?: MealSlug;
  amount?: number;
  unit?: string;
  grams?: number;
}

export type Plan = 'basic' | 'premium';

/** The user's daily targets: calories, then grams of each macro and of fibre. */
export interface DailyTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

/**
 * Which daily targets the app shows: `default` (the starting targets: a basic account, or a
 * premium one with no plan yet), `plan` (from the active nutrition plan) or `none` — "log
 * without targets", for people a calorie plan isn't safe for. In `none`, `targets` is null and
 * the app hides every target, "remaining" and "% of goal".
 */
export type TargetsMode = 'default' | 'plan' | 'none';

/**
 * GET /users/me — the signed-in user's profile. The API creates it on the first request with a
 * new user's token, from the name, email and picture Google or Apple gave.
 */
export interface UserProfile {
  /** The Supabase user id. */
  id: string;
  /** May be an Apple private-relay address. */
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Already expiry-aware: an expired premium comes back as basic. */
  plan: Plan;
  /** ISO 8601; null means no expiry. */
  plan_expires_at: string | null;
  /** Null when `targets_mode` is `none`. */
  targets: DailyTargets | null;
  targets_mode: TargetsMode;
  /** True while this week's check-in is due (weekly check-ins: a later phase; false for now). */
  check_in_due: boolean;
  /** The IANA time zone the app last sent, e.g. 'Europe/Bucharest'; null or absent until then. */
  timezone?: string | null;
}

/**
 * PATCH /users/me — omitted fields are left unchanged. Targets can't be set here: they change
 * only by building a nutrition plan (see nutrition-plan.ts).
 */
export interface UserProfileUpdate {
  display_name?: string;
  /** The device's IANA time zone (check-ins are due on Mondays, local time). */
  timezone?: string;
}

// ---- Nutrition plan (apps/api/docs/plans/ai-nutrition-plan.md) ------------------------------

/** Goals, plans and plan previews are ids the API assigns; treated as opaque. */
export type NutritionId = number | string;

/** `recomp` is "Lose fat and build muscle": a small deficit with strength training. */
export type NutritionGoalKind = 'lose_fat' | 'recomp' | 'build_muscle' | 'maintain';
export type Sex = 'female' | 'male' | 'unspecified';
/** Health answers (Q6). `none` and `prefer_not` are exclusive; pregnant/breastfeeding aren't asked of men. */
export type HealthCondition =
  | 'pregnant'
  | 'breastfeeding'
  | 'diabetes'
  | 'kidney'
  | 'eating_disorder'
  | 'glp1'
  | 'bariatric'
  | 'other_diet_condition'
  | 'none'
  | 'prefer_not';
export type DiabetesHypoRisk = 'yes' | 'no' | 'not_sure';
export type EatingDisorderStatus = 'current' | 'past' | 'prefer_not';
export type ActivityLevel = 'mostly_sitting' | 'some_walking' | 'on_feet' | 'physical_work';
export type LiftingExperience = 'none' | 'lt_1y' | '1_3y' | 'gt_3y';
/** The three suggested paces; `custom` is "I have a date in mind" (`target_date`). */
export type PaceOptionKey = 'gentle' | 'steady' | 'faster';
export type PlanPace = PaceOptionKey | 'custom';
export type EatingStyle = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';
export type Allergen = 'milk' | 'gluten' | 'eggs' | 'peanuts' | 'tree_nuts' | 'soy' | 'fish' | 'shellfish' | 'sesame';
export type MeasurementUnits = 'metric' | 'imperial';
/** The language plan texts are written in. */
export type PlanLanguage = 'en' | 'ro';

/** Every questionnaire answer (questionnaire v2). Heights and weights are always metric. */
export interface GoalAnswers {
  goal: NutritionGoalKind;
  birth_year: number;
  /** 1–12 */
  birth_month: number;
  sex: Sex;
  /** Whole cm, 120–230. */
  height_cm: number;
  /** kg to one decimal, 30–300. */
  weight_kg: number;
  health: HealthCondition[];
  diabetes_hypo_risk: DiabetesHypoRisk | null;
  /** "I'll check with my diabetes team" — lets someone with a hypo risk choose Lose fat. */
  diabetes_team_ack: boolean;
  ed_status: EatingDisorderStatus | null;
  /**
   * With an eating disorder in the past: true shows a Maintain plan with targets; false (the
   * default) is "log without targets", a stop the user chose. Null otherwise.
   */
  targets_wanted: boolean | null;
  activity: ActivityLevel;
  /** 0–7 */
  strength_days: number;
  /** 0–7: cardio or sport, 30+ min. */
  cardio_days: number;
  lifting_experience: LiftingExperience | null;
  /** A muscle goal with under 2 strength days: "Will you train at least 2 days a week?" */
  will_train: boolean | null;
  /** Null for Maintain, or a muscle goal with "No target". */
  target_weight_kg: number | null;
  pace: PlanPace | null;
  /** YYYY-MM-DD, with `pace: 'custom'`. */
  target_date: string | null;
  eating_style: EatingStyle | null;
  religious_fasting: boolean;
  allergies: Allergen[];
  /** 2–6 */
  meals_per_day: number;
  units: MeasurementUnits;
}

/** A code for the app plus a sentence for the user, in the plan's language. */
export interface PlanMessage {
  code: string;
  message: string;
}

/**
 * What the safety gates make of the answers: `ok`, `maintain_only` (only `allowed_goals` can be
 * chosen) or `stop` — no plan; `stop` has a warm, number-free screen to show instead.
 */
export interface PlanGate {
  result: 'ok' | 'maintain_only' | 'stop';
  allowed_goals: NutritionGoalKind[];
  reasons: PlanMessage[];
  stop: { code: string; title: string; body: string } | null;
}

/** One pace the pace screen offers, with its real weekly rate and date after the safety limits. */
export interface PaceOption {
  pace: PaceOptionKey;
  rate_kg_week: number;
  /** What the calories actually give, after the limits — the date comes from this. */
  effective_rate_kg_week: number;
  /** Null when no meaningful change is possible at this pace. */
  weeks: number | null;
  /** YYYY-MM-DD; null with `weeks`. */
  goal_date: string | null;
  kcal: number;
  /** False when the option isn't offered (e.g. no Faster with a weight-loss medicine). */
  available: boolean;
}

/**
 * POST /users/me/nutrition-plans/preview — the gates, and the pace options, for answers so far.
 * Nothing is stored. `pace_options` is empty until the goal, body, activity, exercise and target
 * are known.
 */
export interface PlanPreview {
  gate: PlanGate;
  pace_options: PaceOption[];
  /** The dates "I have a date in mind" can pick from (YYYY-MM-DD), when a date applies. */
  custom_date_range: { min: string; max: string } | null;
  max_rate_kg_week: number | null;
  notices: PlanMessage[];
}

/** POST /users/me/goals */
export interface NutritionGoalCreate {
  questionnaire_version: 2;
  consent: true;
  consent_version: string;
  language: PlanLanguage;
  answers: GoalAnswers;
}

/**
 * POST / GET /users/me/goals — saved answers, with the gate they lead to (recomputed today). A
 * stop is saved with however few answers there were, so missing ones come back as null.
 */
export interface NutritionGoal {
  id: NutritionId;
  questionnaire_version: number;
  language: PlanLanguage;
  answers: GoalAnswers;
  consented_at: string;
  created_at: string;
  gate: PlanGate;
}

/** POST /users/me/goals for someone under 16: a stop, and nothing stored. */
export interface NutritionGoalNotStored {
  id: null;
  answers: null;
  gate: PlanGate;
}

export interface PlanTargetsRate {
  requested_kg_week: number | null;
  effective_kg_week: number | null;
  /** True when the requested pace was faster than is safe and was slowed down. */
  clamped: boolean;
}

/** Texts rendered from the reviewed pattern library, in the plan's language. */
export interface PlanTexts {
  summary: string;
  why: string[];
  guidance: string[];
  cautions: string[];
}

/** A nutrition plan: a draft from POST /users/me/nutrition-plans, or the active one. */
export interface NutritionPlan {
  id: NutritionId;
  goal_id: NutritionId;
  status: 'draft' | 'active' | 'archived';
  reason: 'initial' | 'change' | 'review' | 'maintenance_transition';
  language: PlanLanguage;
  goal: NutritionGoalKind;
  pace: PlanPace | null;
  targets: DailyTargets;
  rate: PlanTargetsRate;
  start_weight_kg: number;
  target_weight_kg: number | null;
  /** YYYY-MM-DD; null for Maintain. */
  goal_date: string | null;
  weeks: number | null;
  notices: PlanMessage[];
  texts: PlanTexts;
  pattern_key: string;
  created_at: string;
  activated_at: string | null;
}
