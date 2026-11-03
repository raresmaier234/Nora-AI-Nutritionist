import { useCallback, useEffect, useState } from 'react';

import { FoodDetail, FoodServing, NutrientAmount, PackageServing, getFood } from '@/services/api';

// A food's profile doesn't change while the app runs, so each food is fetched once; reopening it
// (or a second request while the first is in flight) reuses the same promise. A failed request is
// dropped so Retry asks again.
const requests = new Map<number, Promise<FoodDetail>>();

function loadFood(id: number): Promise<FoodDetail> {
  let request = requests.get(id);
  if (!request) {
    request = getFood(id);
    request.catch(() => requests.delete(id));
    requests.set(id, request);
  }
  return request;
}

export function loadNutrients(id: number): Promise<NutrientAmount[]> {
  return loadFood(id).then((food) => food.nutrients);
}

/**
 * The full nutrient list of a database food — fibre, sugars, fats, vitamins, minerals — and its own
 * units (cup, slice…) for Food Details. Database foods have numeric ids; anything else (a saved
 * recipe) has no profile to load. `nutrients` is null while loading, for non-database foods, and
 * when the request failed; `servings` is empty then.
 *
 * The result lives in state, never read from the module cache during render: the React Compiler
 * memoizes render-time reads, so a cache filled later would never show.
 */
const NO_SERVINGS: FoodServing[] = [];

export function useFoodNutrients(foodId: string) {
  const id = /^\d+$/.test(foodId) ? Number(foodId) : null;
  // Null nutrients = that request failed.
  const [loaded, setLoaded] = useState<{
    id: number;
    nutrients: NutrientAmount[] | null;
    servings: FoodServing[];
    packageServing: PackageServing | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    loadFood(id).then(
      (food) => {
        if (!cancelled) setLoaded({ id, nutrients: food.nutrients, servings: food.servings ?? [], packageServing: food.package_serving ?? null });
      },
      () => {
        if (!cancelled) setLoaded({ id, nutrients: null, servings: [], packageServing: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setLoaded(null);
    setAttempt((a) => a + 1);
  }, []);
  // Only this food's result counts, never one left over from another food.
  const current = loaded?.id === id ? loaded : null;
  return {
    nutrients: current?.nutrients ?? null,
    servings: current?.servings ?? NO_SERVINGS,
    packageServing: current?.packageServing ?? null,
    failed: current !== null && current.nutrients === null,
    retry,
  };
}
