export { apiRequest, ApiError } from './client';
export type { ApiRequestOptions } from './client';
export { API_BASE_URL, API_VERSION_PREFIX } from './config';
export type {
  ApiErrorKind,
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
} from './types';
export { getHealth } from './health';
export { getFood, searchFoods } from './foods';
export { copyDay, createEntry, deleteEntry, listEntries, updateEntry } from './meals';
