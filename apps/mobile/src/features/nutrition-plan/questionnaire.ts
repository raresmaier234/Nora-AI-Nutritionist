import type {
  GoalAnswers,
  NutritionGoalKind,
  PaceOptionKey,
  PlanLanguage,
  PlanPreview,
  MeasurementUnits,
} from '@/services/api';

/*
 * The plan questionnaire (v2) as data: which screens there are, in what order, which ones a
 * given set of answers needs, and what each screen accepts — matching the API's validation.
 * Spec: apps/api/docs/plans/ai-nutrition-plan.md (v3); wording and reasons: review §1–§4.
 * Pure functions only: the screens live in src/components/nutrition-plan/plan-builder/.
 */

export const QUESTIONNAIRE_VERSION = 2 as const;
/** The version of the consent text on the consent screen; stored with the answers. */
export const CONSENT_VERSION = '2026-10-30';

/** Answers so far. Heights and weights are always metric here; `units` is only for display. */
export type Draft = Partial<GoalAnswers>;

/** What "Change plan" can ask again. */
export type Section = 'goal' | 'body' | 'activity' | 'health' | 'food';
export const ALL_SECTIONS: readonly Section[] = ['goal', 'body', 'activity', 'health', 'food'];

export type StepId =
  | 'consent'
  | 'change'
  | 'goal'
  | 'birth'
  | 'sex'
  | 'height'
  | 'weight'
  | 'health'
  | 'diabetes'
  | 'eatingDisorder'
  | 'targets'
  | 'activity'
  | 'exercise'
  | 'willTrain'
  | 'lifting'
  | 'target'
  | 'pace'
  | 'food';

/** Every screen, in the spec's order. The review follows the last one shown. */
export const STEP_ORDER: readonly StepId[] = [
  'consent',
  'change',
  'goal',
  'birth',
  'sex',
  'height',
  'weight',
  'health',
  'diabetes',
  'eatingDisorder',
  'targets',
  'activity',
  'exercise',
  'willTrain',
  'lifting',
  'target',
  'pace',
  'food',
];

/**
 * The screens whose answers the safety gates read (age, body, health). Leaving them for a later
 * screen — or for the review — runs the gate check (POST …/nutrition-plans/preview).
 */
const GATE_STEPS = new Set<StepId>(['consent', 'change', 'goal', 'birth', 'sex', 'height', 'weight', 'health', 'diabetes', 'eatingDisorder', 'targets']);
export const isGateStep = (step: StepId) => GATE_STEPS.has(step);

/** Section label, for progress ("About you", …) and the "What would you like to change?" screen. */
export const STEP_SECTION: Record<StepId, string> = {
  consent: 'Before we start',
  change: 'Change plan',
  goal: 'Your goal',
  birth: 'About you',
  sex: 'About you',
  height: 'About you',
  weight: 'About you',
  health: 'Health',
  diabetes: 'Health',
  eatingDisorder: 'Health',
  targets: 'Health',
  activity: 'Activity',
  exercise: 'Activity',
  willTrain: 'Activity',
  lifting: 'Activity',
  target: 'Your goal',
  pace: 'Your goal',
  food: 'Food',
};

export type FlowContext = {
  draft: Draft;
  /**
   * The answers the flow started from. A screen asked because its answer was missing then stays
   * in the flow after it's filled in (or defaulted), so Back and Next keep finding it.
   */
  initial: Draft;
  /** The sections being asked (all of them when building a plan from scratch). */
  sections: ReadonlySet<Section>;
  /** No consented answers yet: the consent screen comes first. */
  needsConsent: boolean;
  /** "Change plan": "What would you like to change?" comes first. */
  changeFirst: boolean;
  /** The goal the flow started with; a different one (e.g. from a gate) re-asks target and pace. */
  initialGoal: NutritionGoalKind | undefined;
};

const missing = (v: unknown) => v === undefined || v === null;
type AnswerKey = keyof GoalAnswers;

/** Strength training counts from this many days a week (as in the API). */
export const TRAINING_DAYS = 2;

/** The goals with a calorie deficit: Lose fat, and Lose fat and build muscle. */
export const isLossGoal = (goal: NutritionGoalKind | null | undefined) => goal === 'lose_fat' || goal === 'recomp';
/** The goals that build muscle, so need strength training. */
export const isMuscleGoal = (goal: NutritionGoalKind | null | undefined) => goal === 'recomp' || goal === 'build_muscle';
export const hasWeightGoal = (d: Draft) => isLossGoal(d.goal) || d.goal === 'build_muscle';
/** Lifting experience matters with any strength training, and always for the muscle goals. */
export const liftingApplies = (d: Draft) => (d.strength_days ?? 0) >= 1 || isMuscleGoal(d.goal);
/** A muscle goal with under 2 strength days: "Will you train at least 2 days a week?" */
export const willTrainApplies = (d: Draft) => isMuscleGoal(d.goal) && d.strength_days != null && d.strength_days < TRAINING_DAYS;
/** An eating disorder in the past: "How would you like to use Nora?" (targets, or none). */
export const targetsQuestionApplies = (d: Draft) => !!d.health?.includes('eating_disorder') && d.ed_status === 'past';
/** Diabetes with a hypo risk: a loss goal needs "I'll check with my diabetes team". */
export const needsDiabetesAck = (d: Draft) =>
  isLossGoal(d.goal) && (d.diabetes_hypo_risk === 'yes' || d.diabetes_hypo_risk === 'not_sure');

/**
 * Whether a screen is asked: it belongs to a section being asked, or its answer is missing (or no
 * longer valid) — so a partial set of saved answers always ends up complete.
 */
export function isStepShown(step: StepId, ctx: FlowContext): boolean {
  const { draft: d, initial, sections } = ctx;
  const m = (...keys: AnswerKey[]) => keys.some((k) => missing(d[k]) || missing(initial[k]));
  const goalAsked = sections.has('goal') || (ctx.initialGoal !== undefined && d.goal !== ctx.initialGoal);
  const body = sections.has('body');
  const activity = sections.has('activity');
  const health = sections.has('health');
  switch (step) {
    case 'consent':
      return ctx.needsConsent;
    case 'change':
      return ctx.changeFirst;
    case 'goal':
      return sections.has('goal') || m('goal');
    case 'birth':
      return body || m('birth_year', 'birth_month');
    case 'sex':
      return body || m('sex');
    case 'height':
      return body || m('height_cm');
    case 'weight':
      return body || m('weight_kg');
    case 'health':
      return health || !d.health?.length || !initial.health?.length;
    case 'diabetes':
      return !!d.health?.includes('diabetes') && (health || m('diabetes_hypo_risk') || (goalAsked && needsDiabetesAck(d)));
    case 'eatingDisorder':
      return !!d.health?.includes('eating_disorder') && (health || m('ed_status'));
    case 'targets':
      return targetsQuestionApplies(d) && (health || m('targets_wanted'));
    case 'activity':
      return activity || m('activity');
    case 'exercise':
      return activity || m('strength_days', 'cardio_days');
    case 'willTrain':
      return willTrainApplies(d) && (activity || goalAsked || m('will_train'));
    case 'lifting':
      return liftingApplies(d) && (activity || m('lifting_experience'));
    case 'target':
      return hasWeightGoal(d) && (goalAsked || initial.target_weight_kg === undefined || d.target_weight_kg === undefined || targetProblem(d) !== null);
    case 'pace':
      return hasWeightGoal(d) && (goalAsked || m('pace') || (d.pace === 'custom' && missing(d.target_date)));
    case 'food':
      return sections.has('food');
  }
}

export const visibleSteps = (ctx: FlowContext) => STEP_ORDER.filter((s) => isStepShown(s, ctx));

/** The next screen after `from` (null: the review is next). */
export function nextStep(from: StepId | null, ctx: FlowContext): StepId | null {
  const start = from === null ? 0 : STEP_ORDER.indexOf(from) + 1;
  return STEP_ORDER.slice(start).find((s) => isStepShown(s, ctx)) ?? null;
}

// ---- Dates and age ----------------------------------------------------------------------

/** "2027-03-05" → a local date (midnight). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Mar 5, 2027". UI copy is English; plan texts come in the plan's own language. */
export function formatDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Age on `today` if born on the last day of that month — the youngest possible (review §1.2). */
export function youngestAge(year: number, month: number, today: Date): number {
  const born = new Date(year, month, 0);
  let age = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age -= 1;
  return age;
}

export const MIN_AGE = 16;
export const MAX_AGE = 100;

/** Why the birth answer can't be used (null: fine). Under 16 is fine here: the gate stops it. */
export function birthProblem(d: Draft, today: Date): string | null {
  if (missing(d.birth_month) || missing(d.birth_year)) return null;
  const year = d.birth_year!;
  if (year > today.getFullYear() || (year === today.getFullYear() && d.birth_month! > today.getMonth() + 1)) return 'That date is in the future. Please check the year.';
  if (youngestAge(year, d.birth_month!, today) > MAX_AGE) return 'Please check the year.';
  return null;
}

// ---- Units ------------------------------------------------------------------------------

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
/** Pounds to kg, to 0.1 kg (what the API stores). */
export const lbToKg = (lb: number) => Math.round(lb * KG_PER_LB * 10) / 10;
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), inches: total % 12 };
}
/** Feet and inches to whole cm (what the API stores). */
export const ftInToCm = (ft: number, inches: number) => Math.round((ft * 12 + inches) * CM_PER_IN);

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

/** "72.4 kg" or "159.6 lb". */
export function formatWeight(kg: number, units: MeasurementUnits | undefined): string {
  return units === 'imperial' ? `${oneDecimal(kgToLb(kg))} lb` : `${oneDecimal(kg)} kg`;
}

export function formatHeight(cm: number, units: MeasurementUnits | undefined): string {
  if (units !== 'imperial') return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft} ft ${inches} in`;
}

/** "~0.55 kg a week" (kg to 0.05, lb to 0.1 — no false precision). */
export function formatRate(kgPerWeek: number, units: MeasurementUnits | undefined): string {
  const abs = Math.abs(kgPerWeek);
  if (units === 'imperial') return `~${oneDecimal(kgToLb(abs))} lb a week`;
  return `~${(Math.round(abs * 20) / 20).toFixed(2).replace(/0$/, '')} kg a week`;
}

// ---- Validation (matches the API) ---------------------------------------------------------

export const HEIGHT_CM = { min: 120, max: 230, confirmBelow: 140, confirmAbove: 210 } as const;
export const WEIGHT_KG = { min: 30, max: 300, confirmBelow: 40, confirmAbove: 200 } as const;
export const DAYS = { min: 0, max: 7 } as const;
export const MEALS = { min: 2, max: 6, default: 3 } as const;

export const heightOk = (cm: number | undefined | null) => cm != null && Number.isInteger(cm) && cm >= HEIGHT_CM.min && cm <= HEIGHT_CM.max;
export const weightOk = (kg: number | undefined | null) => kg != null && kg >= WEIGHT_KG.min && kg <= WEIGHT_KG.max;

/** The lowest target BMI for a loss goal; from 65, higher (as in the API's gates). */
const BMI_FLOOR = 20;
const BMI_FLOOR_OLDER = 23;
const OLDER_AGE = 65;
const BMI_BULK_WARN = 27;

/** The target-weight range a goal allows, in kg (null: no target applies). */
export function targetRange(d: Draft, today: Date = new Date()): { min: number; max: number } | null {
  if (!d.weight_kg || !d.height_cm) return null;
  const h = d.height_cm / 100;
  if (isLossGoal(d.goal)) {
    // At least 1 kg below now, and a target BMI of at least 20 (23 from 65).
    const older = d.birth_year != null && d.birth_month != null && youngestAge(d.birth_year, d.birth_month, today) >= OLDER_AGE;
    const floor = Math.ceil((older ? BMI_FLOOR_OLDER : BMI_FLOOR) * h * h * 10 - 1e-9) / 10;
    return { min: Math.max(WEIGHT_KG.min, floor), max: Math.round((d.weight_kg - 1) * 10) / 10 };
  }
  if (d.goal === 'build_muscle') return { min: Math.round((d.weight_kg + 1) * 10) / 10, max: WEIGHT_KG.max };
  return null;
}

export type TargetProblem = 'missing' | 'not_below' | 'below_floor' | 'not_above' | 'too_high';

/** Why the target can't be used (null: fine). A muscle goal with no target (null) is fine. */
export function targetProblem(d: Draft): TargetProblem | null {
  if (!hasWeightGoal(d)) return null;
  const t = d.target_weight_kg;
  if (t === undefined || (t === null && d.goal === 'lose_fat')) return 'missing';
  if (t === null) return null;
  const range = targetRange(d);
  if (!range) return null;
  if (isLossGoal(d.goal)) {
    if (t > range.max) return 'not_below';
    if (t < range.min) return 'below_floor';
  } else {
    if (t < range.min) return 'not_above';
    if (t > range.max) return 'too_high';
  }
  return null;
}

/** Build muscle aiming well above a healthy range for the height: a gentle warning, not a block. */
export function targetIsHighForHeight(d: Draft): boolean {
  if (d.goal !== 'build_muscle' || !d.target_weight_kg || !d.height_cm) return false;
  const h = d.height_cm / 100;
  return d.target_weight_kg / (h * h) > BMI_BULK_WARN;
}

/** Whether Next can be pressed on a screen. Each screen shows its own messages. */
export function stepComplete(step: StepId, d: Draft, today: Date): boolean {
  switch (step) {
    case 'consent':
    case 'change':
      return true; // these two check their own state
    case 'goal':
      return !missing(d.goal);
    case 'birth':
      return !missing(d.birth_month) && !missing(d.birth_year) && birthProblem(d, today) === null;
    case 'sex':
      return !missing(d.sex);
    case 'height':
      return heightOk(d.height_cm);
    case 'weight':
      return weightOk(d.weight_kg);
    case 'health':
      return !!d.health?.length;
    case 'diabetes':
      return !missing(d.diabetes_hypo_risk);
    case 'eatingDisorder':
      return !missing(d.ed_status);
    case 'targets':
      return typeof d.targets_wanted === 'boolean';
    case 'activity':
      return !missing(d.activity);
    case 'exercise':
      return !missing(d.strength_days) && !missing(d.cardio_days);
    case 'willTrain':
      return typeof d.will_train === 'boolean';
    case 'lifting':
      return !missing(d.lifting_experience);
    case 'target':
      return targetProblem(d) === null;
    case 'pace':
      return !missing(d.pace) && (d.pace !== 'custom' || !missing(d.target_date));
    case 'food':
      return true;
  }
}

/** A plausible-but-unusual answer to confirm before moving on ("Is 135 cm right?"), or null. */
export function unusualAnswer(step: StepId, d: Draft): string | null {
  if (step === 'height' && d.height_cm && (d.height_cm < HEIGHT_CM.confirmBelow || d.height_cm > HEIGHT_CM.confirmAbove)) {
    return `Is ${formatHeight(d.height_cm, d.units)} right?`;
  }
  if (step === 'weight' && d.weight_kg && (d.weight_kg < WEIGHT_KG.confirmBelow || d.weight_kg > WEIGHT_KG.confirmAbove)) {
    return `Is ${formatWeight(d.weight_kg, d.units)} right?`;
  }
  if (step === 'exercise' && (d.strength_days ?? 0) + (d.cardio_days ?? 0) > 10) {
    return `That's ${(d.strength_days ?? 0) + (d.cardio_days ?? 0)} training days a week. Is that a typical week?`;
  }
  return null;
}

// ---- Answers for the API ------------------------------------------------------------------

/** Drops answers that no longer apply (e.g. a target after switching to Maintain). */
export function sanitize(d: Draft): Draft {
  const out: Draft = { ...d };
  if (out.health) {
    if (out.sex === 'male') out.health = out.health.filter((h) => h !== 'pregnant' && h !== 'breastfeeding');
    if (!out.health.includes('diabetes')) {
      out.diabetes_hypo_risk = null;
      out.diabetes_team_ack = false;
    } else if (!needsDiabetesAck(out)) {
      out.diabetes_team_ack = false;
    }
    if (!out.health.includes('eating_disorder')) out.ed_status = null;
    if (!targetsQuestionApplies(out)) out.targets_wanted = null;
  }
  if (out.strength_days !== undefined && !liftingApplies(out)) out.lifting_experience = null;
  if (out.strength_days !== undefined && !willTrainApplies(out)) out.will_train = null;
  if (out.goal === 'maintain') {
    out.target_weight_kg = null;
    out.pace = null;
    out.target_date = null;
  }
  if (out.pace !== undefined && out.pace !== 'custom') out.target_date = null;
  return out;
}

/**
 * Only the answers given so far — for a preview, which takes partial answers. An empty health
 * list (e.g. after sex changed to male dropped "pregnant") is unanswered: the API needs at least one.
 */
export function partialAnswers(d: Draft, omit: readonly (keyof GoalAnswers)[] = []): Partial<GoalAnswers> {
  const clean = sanitize(d);
  if (clean.health?.length === 0) delete clean.health;
  return Object.fromEntries(
    Object.entries(clean).filter(([k, v]) => v !== undefined && !omit.includes(k as keyof GoalAnswers)),
  ) as Partial<GoalAnswers>;
}

/** Every answer, with the optional ones defaulted — or null if a required one is missing. */
export function completeAnswers(d: Draft): GoalAnswers | null {
  const c = sanitize(d);
  if (
    !c.goal ||
    missing(c.birth_year) ||
    missing(c.birth_month) ||
    !c.sex ||
    missing(c.height_cm) ||
    missing(c.weight_kg) ||
    !c.health?.length ||
    !c.activity ||
    missing(c.strength_days) ||
    missing(c.cardio_days)
  ) {
    return null;
  }
  return {
    goal: c.goal,
    birth_year: c.birth_year!,
    birth_month: c.birth_month!,
    sex: c.sex,
    height_cm: c.height_cm!,
    weight_kg: c.weight_kg!,
    health: c.health,
    diabetes_hypo_risk: c.diabetes_hypo_risk ?? null,
    diabetes_team_ack: c.diabetes_team_ack ?? false,
    ed_status: c.ed_status ?? null,
    targets_wanted: targetsQuestionApplies(c) ? (c.targets_wanted ?? false) : null,
    activity: c.activity,
    strength_days: c.strength_days!,
    cardio_days: c.cardio_days!,
    lifting_experience: liftingApplies(c) ? (c.lifting_experience ?? null) : null,
    will_train: willTrainApplies(c) ? (c.will_train ?? null) : null,
    target_weight_kg: hasWeightGoal(c) ? (c.target_weight_kg ?? null) : null,
    pace: hasWeightGoal(c) ? (c.pace ?? null) : null,
    target_date: hasWeightGoal(c) && c.pace === 'custom' ? (c.target_date ?? null) : null,
    eating_style: c.eating_style ?? null,
    religious_fasting: c.religious_fasting ?? false,
    allergies: c.allergies ?? [],
    meals_per_day: c.meals_per_day ?? MEALS.default,
    units: c.units ?? 'metric',
  };
}

/** The pace to preselect: the current one if it's still offered, else Steady, else the first. */
export function defaultPace(d: Draft, preview: PlanPreview): Draft['pace'] {
  const offered = preview.pace_options.filter((o) => o.available).map((o) => o.pace);
  if (d.pace === 'custom' && preview.custom_date_range) return 'custom';
  if (d.pace && d.pace !== 'custom' && offered.includes(d.pace)) return d.pace;
  const preferred: PaceOptionKey = 'steady';
  if (offered.includes(preferred)) return preferred;
  return offered[0] ?? (preview.custom_date_range ? 'custom' : null);
}

/** Plan texts in Romanian on a Romanian phone, English otherwise. The app's own copy stays English. */
export function planLanguage(): PlanLanguage {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ro') ? 'ro' : 'en';
  } catch {
    return 'en';
  }
}
