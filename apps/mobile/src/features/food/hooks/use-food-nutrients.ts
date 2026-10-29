import { useCallback, useEffect, useState } from 'react';

import { NutrientAmount, getFood } from '@/services/api';

// A food's profile doesn't change while the app runs, so each food is fetched once; reopening it
// (or a second request while the first is in flight) reuses the same promise. A failed request is
// dropped so Retry asks again.
const requests = new Map<number, Promise<NutrientAmount[]>>();

export function loadNutrients(id: number): Promise<NutrientAmount[]> {
  let request = requests.get(id);
  if (!request) {
    request = getFood(id).then((food) => food.nutrients);
    request.catch(() => requests.delete(id));
    requests.set(id, request);
  }
  return request;
}

/**
 * The full nutrient list of a database food — fibre, sugars, fats, vitamins, minerals — for Food
 * Details. Database foods have numeric ids; anything else (a saved recipe) has no profile to load.
 * `nutrients` is null while loading, for non-database foods, and when the request failed.
 *
 * The result lives in state, never read from the module cache during render: the React Compiler
 * memoizes render-time reads, so a cache filled later would never show.
 */
export function useFoodNutrients(foodId: string) {
  const id = /^\d+$/.test(foodId) ? Number(foodId) : null;
  // Null nutrients = that request failed.
  const [loaded, setLoaded] = useState<{ id: number; nutrients: NutrientAmount[] | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    loadNutrients(id).then(
      (nutrients) => {
        if (!cancelled) setLoaded({ id, nutrients });
      },
      () => {
        if (!cancelled) setLoaded({ id, nutrients: null });
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
  return { nutrients: current?.nutrients ?? null, failed: current !== null && current.nutrients === null, retry };
}
