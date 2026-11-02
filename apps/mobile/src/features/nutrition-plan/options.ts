import type {
  ActivityLevel,
  Allergen,
  DiabetesHypoRisk,
  EatingDisorderStatus,
  EatingStyle,
  HealthCondition,
  LiftingExperience,
  NutritionGoalKind,
  PaceOptionKey,
  Sex,
} from '@/services/api';

import type { Section } from './questionnaire';

/*
 * The questionnaire's answer labels, worded as in the nutrition-expert review
 * (apps/api/docs/plans/ai-nutrition-plan-expert-review.md §1–§4): kind and plain, "now or in
 * the past" rather than diagnoses, and never "underweight" or "obese".
 */

export type Option<K extends string> = { value: K; label: string; description?: string };

/** Named by what happens to the weight: "Gain muscle" is the one where it goes up. */
export const GOAL_OPTIONS: Option<NutritionGoalKind>[] = [
  { value: 'lose_fat', label: 'Lose fat', description: 'Lose weight slowly while keeping muscle' },
  { value: 'recomp', label: 'Lose fat and build muscle', description: 'Lose fat slowly while you strength train' },
  { value: 'build_muscle', label: 'Gain muscle', description: 'Eat a little more and gain weight slowly while you train' },
  { value: 'maintain', label: 'Maintain my weight', description: 'Stay about where you are and eat well' },
];

export const goalLabel = (goal: NutritionGoalKind) => GOAL_OPTIONS.find((o) => o.value === goal)?.label ?? goal;

export const SEX_OPTIONS: Option<Sex>[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unspecified', label: 'Prefer not to say' },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Q6. Pregnant and breastfeeding aren't shown to men. `none` and `prefer_not` are exclusive. */
export const HEALTH_OPTIONS: (Option<HealthCondition> & { notForMale?: boolean; exclusive?: boolean })[] = [
  { value: 'pregnant', label: 'I’m pregnant, or might be', notForMale: true },
  { value: 'breastfeeding', label: 'I’m breastfeeding', notForMale: true },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'kidney', label: 'Kidney disease (CKD, dialysis or a transplant)' },
  { value: 'eating_disorder', label: 'An eating disorder, now or in the past' },
  { value: 'glp1', label: 'I take a weight-loss medicine (e.g. Wegovy, Ozempic, Mounjaro)' },
  { value: 'bariatric', label: 'Weight-loss surgery in the last 2 years' },
  { value: 'other_diet_condition', label: 'Another condition my doctor manages with diet' },
  { value: 'none', label: 'None of these', exclusive: true },
  { value: 'prefer_not', label: 'Prefer not to say', exclusive: true },
];

export const HYPO_RISK_OPTIONS: Option<DiabetesHypoRisk>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

export const ED_STATUS_OPTIONS: Option<EatingDisorderStatus>[] = [
  { value: 'current', label: 'Yes, or I’m still recovering' },
  { value: 'past', label: 'No, it’s in the past' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

/** After "it's in the past": numbers can unsettle recovery, so no targets is the default. */
export const TARGETS_WANTED_OPTIONS: Option<'no' | 'yes'>[] = [
  { value: 'no', label: 'Log without targets', description: 'See what you eat and its nutrients, with no calorie or macro numbers to hit. Recommended.' },
  { value: 'yes', label: 'Show me a plan with targets', description: 'Targets to keep your weight steady, focused on eating regularly and well.' },
];

/** Q7 (review §4): described by steps and job type, because vague labels get overestimated. */
export const ACTIVITY_OPTIONS: Option<ActivityLevel>[] = [
  { value: 'mostly_sitting', label: 'Mostly sitting', description: 'Desk job, studying or driving; under ~5,000 steps' },
  { value: 'some_walking', label: 'Some walking', description: 'Sitting job, but walking to work, errands, the dog; ~5,000–8,000 steps' },
  { value: 'on_feet', label: 'On my feet most of the day', description: 'Shop, café, nursing, teaching, small children; ~8,000–12,000 steps' },
  { value: 'physical_work', label: 'Physically hard work', description: 'Construction, farming, warehouse, cleaning, delivery; over 12,000 steps' },
];

export const LIFTING_OPTIONS: Option<LiftingExperience>[] = [
  { value: 'none', label: 'Not yet' },
  { value: 'lt_1y', label: 'Less than 1 year' },
  { value: '1_3y', label: '1–3 years' },
  { value: 'gt_3y', label: 'More than 3 years' },
];

export const PACE_LABELS: Record<PaceOptionKey, string> = { gentle: 'Gentle', steady: 'Steady', faster: 'Faster' };

export const EATING_STYLE_OPTIONS: Option<EatingStyle>[] = [
  { value: 'omnivore', label: 'I eat everything' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
];

export const ALLERGEN_OPTIONS: Option<Allergen>[] = [
  { value: 'milk', label: 'Milk / lactose' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'tree_nuts', label: 'Tree nuts' },
  { value: 'soy', label: 'Soy' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'sesame', label: 'Sesame' },
];

/** "What would you like to change?" — `all` is "Start over" (exclusive). */
export const CHANGE_OPTIONS: (Option<Section | 'all'> & { exclusive?: boolean })[] = [
  { value: 'goal', label: 'Goal & pace', description: 'Your goal, target weight and how fast' },
  { value: 'body', label: 'Body', description: 'Weight, height, birth date and sex' },
  { value: 'activity', label: 'Activity & exercise', description: 'How active your days are, and your workouts' },
  { value: 'health', label: 'Health', description: 'Anything that changes what’s safe for you' },
  { value: 'food', label: 'Food', description: 'How you eat, allergies and meals per day' },
  { value: 'all', label: 'Start over', description: 'Answer every question again', exclusive: true },
];
