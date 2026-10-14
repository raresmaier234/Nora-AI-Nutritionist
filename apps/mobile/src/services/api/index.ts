export { apiRequest, ApiError } from './client';
export type { ApiRequestOptions } from './client';
export { API_BASE_URL, API_VERSION_PREFIX } from './config';
export type {
  ApiErrorKind,
  FoodLogEntry,
  FoodLogEntryCreate,
  FoodLogEntryUpdate,
  FoodLogSource,
  FoodSearchResult,
  HealthResponse,
  MealSlug,
  Per100g,
} from './types';
export { getHealth } from './health';
export { searchFoods } from './foods';
export { copyDay, createEntry, deleteEntry, listEntries, updateEntry } from './meals';
