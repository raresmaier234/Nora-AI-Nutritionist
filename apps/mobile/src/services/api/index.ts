export { apiRequest, ApiError, describeError } from './client';
export type { ApiRequestOptions } from './client';
export { API_BASE_URL, API_VERSION_PREFIX } from './config';
export type {
  ActivityLevel,
  Allergen,
  ApiErrorKind,
  DailyTargets,
  DiabetesHypoRisk,
  EatingDisorderStatus,
  EatingStyle,
  FoodDetail,
  FoodLogEntry,
  FoodLogEntryCreate,
  FoodLogEntryUpdate,
  FoodLogSource,
  FoodSearchResult,
  GoalAnswers,
  HealthCondition,
  HealthResponse,
  LiftingExperience,
  MealSlug,
  MeasurementUnits,
  NutrientAmount,
  NutritionGoal,
  NutritionGoalCreate,
  NutritionGoalKind,
  NutritionGoalNotStored,
  NutritionId,
  NutritionPlan,
  PaceOption,
  PaceOptionKey,
  Per100g,
  Plan,
  PlanGate,
  PlanLanguage,
  PlanMessage,
  PlanPace,
  PlanPreview,
  PlanTexts,
  Sex,
  TargetsMode,
  UserProfile,
  UserProfileUpdate,
} from './types';
export { getHealth } from './health';
export { getFood, searchFoods } from './foods';
export { copyDay, createEntry, deleteEntry, listEntries, updateEntry } from './meals';
export { deleteMe, getMe, updateMe } from './users';
export { activatePlan, createPlanDraft, gateFromError, getActivePlan, getLatestGoals, previewPlan, saveGoals } from './nutrition-plan';
