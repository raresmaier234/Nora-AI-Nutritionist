export { apiRequest, ApiError, describeError } from './client';
export type { ApiRequestOptions } from './client';
export { API_BASE_URL, API_VERSION_PREFIX } from './config';
export type {
  ApiErrorKind,
  DailyTargets,
  FoodDetail,
  FoodLogEntry,
  FoodLogEntryCreate,
  FoodLogEntryUpdate,
  FoodLogSource,
  FoodSearchResult,
  HealthResponse,
  MealSlug,
  NutrientAmount,
  Per100g,
  Plan,
  UserProfile,
  UserProfileUpdate,
} from './types';
export { getHealth } from './health';
export { getFood, searchFoods } from './foods';
export { copyDay, createEntry, deleteEntry, listEntries, updateEntry } from './meals';
export { deleteMe, getMe, updateMe } from './users';
