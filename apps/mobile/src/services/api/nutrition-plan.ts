import { ApiError, apiRequest } from './client';
import type {
  GoalAnswers,
  NutritionGoal,
  NutritionGoalCreate,
  NutritionGoalNotStored,
  NutritionId,
  NutritionPlan,
  PlanGate,
  PlanLanguage,
  PlanPreview,
} from './types';

/*
 * The nutrition plan (apps/api/docs/plans/ai-nutrition-plan.md). Every endpoint here is premium:
 * a basic account gets 403.
 */

const GOALS = '/users/me/goals';
const PLANS = '/users/me/nutrition-plans';

/** A 404 means "there isn't one" for the GETs below, not a failure. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * The gates and pace options for the answers so far; nothing is stored. Used after the health
 * questions (gate screens) and on the pace screen (each option's real weekly rate and date).
 * `language` is the one gate reasons, stop screens and notices are written in.
 */
export function previewPlan(answers: Partial<GoalAnswers>, language: PlanLanguage): Promise<PlanPreview> {
  return apiRequest<PlanPreview>(`${PLANS}/preview`, { method: 'POST', body: { answers, language } });
}

/**
 * Saves the answers, with consent. Resolves with the saved goal and its gate — or, for someone
 * under 16, `{ id: null, gate }` (a stop; nothing stored). Rejects with 422 if the goal isn't
 * allowed (the error's `detail` carries the gate: see `gateFromError`).
 */
export function saveGoals(body: NutritionGoalCreate): Promise<NutritionGoal | NutritionGoalNotStored> {
  return apiRequest<NutritionGoal | NutritionGoalNotStored>(GOALS, { method: 'POST', body });
}

/** The latest saved answers, or null if there are none. */
export function getLatestGoals(): Promise<NutritionGoal | null> {
  return orNull(apiRequest<NutritionGoal>(GOALS, { method: 'GET' }));
}

/** Builds a draft plan from saved answers, instantly. Rejects with 409 if their gate is a stop. */
export function createPlanDraft(goalId: NutritionId): Promise<NutritionPlan> {
  return apiRequest<NutritionPlan>(PLANS, { method: 'POST', body: { goal_id: goalId } });
}

/** The active plan, with its texts, or null if there is none. */
export function getActivePlan(): Promise<NutritionPlan | null> {
  return orNull(apiRequest<NutritionPlan>(`${PLANS}/active`, { method: 'GET' }));
}

/** "Use this plan": the draft becomes the active plan, and its targets the user's. */
export function activatePlan(id: NutritionId): Promise<NutritionPlan> {
  return apiRequest<NutritionPlan>(`${PLANS}/${id}/activate`, { method: 'POST' });
}

function isGate(value: unknown): value is PlanGate {
  return !!value && typeof value === 'object' && 'result' in value && 'allowed_goals' in value;
}

/** The gate a refused save carries (422 "goal not allowed"), if it has one. */
export function gateFromError(err: unknown): PlanGate | null {
  if (!(err instanceof ApiError) || !err.detail || typeof err.detail !== 'object') return null;
  if (isGate(err.detail)) return err.detail;
  const nested = (err.detail as { gate?: unknown }).gate;
  return isGate(nested) ? nested : null;
}
