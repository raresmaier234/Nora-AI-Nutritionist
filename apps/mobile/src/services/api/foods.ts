import { apiRequest } from './client';
import type { FoodDetail, FoodSearchResult } from './types';

/** Foods whose name contains or resembles `query`, best match first. */
export function searchFoods(query: string, limit = 20): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiRequest<FoodSearchResult[]>(`/foods?${params}`, { method: 'GET' });
}

/** One database food with its full nutrient profile: fibre, sugars, fats, vitamins, minerals… */
export function getFood(id: number): Promise<FoodDetail> {
  return apiRequest<FoodDetail>(`/foods/${id}`, { method: 'GET' });
}
