import { apiRequest } from './client';
import type { FoodSearchResult } from './types';

/** Foods whose name contains or resembles `query`, best match first. */
export function searchFoods(query: string, limit = 20): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiRequest<FoodSearchResult[]>(`/foods?${params}`, { method: 'GET' });
}
