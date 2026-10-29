import { useCallback, useEffect, useState } from 'react';

import type { NutrientAmount } from '@/services/api';
import { Entry, toGrams } from '@/features/food/data/mock-data';
import { NutrientValues, nutrientValues } from '@/features/food/nutrients';

import { loadNutrients } from './use-food-nutrients';

const isDatabaseFood = (e: Entry) => /^\d+$/.test(e.id);

/**
 * Everything eaten in `entries`, added up: calories and macros from every entry, and fibre,
 * vitamins, minerals and the rest from each database food's profile (GET /foods/{id}, shared
 * with Food Details' cache). Custom foods, scans and recipes carry only calories and macros, so
 * `withoutProfile` counts the entries the micronutrient totals leave out.
 *
 * Until the profiles arrive — or if one fails — `values` holds the macros alone.
 */
export function useDayNutrients(entries: Entry[]) {
  const ids = [...new Set(entries.filter(isDatabaseFood).map((e) => Number(e.id)))].sort((a, b) => a - b);
  const key = ids.join(',');
  const [loaded, setLoaded] = useState<{ key: string; profiles: Map<number, NutrientAmount[]> | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) return;
    const wanted = key.split(',').map(Number);
    let cancelled = false;
    Promise.all(wanted.map(loadNutrients)).then(
      (lists) => {
        if (!cancelled) setLoaded({ key, profiles: new Map(wanted.map((id, i) => [id, lists[i]])) });
      },
      () => {
        if (!cancelled) setLoaded({ key, profiles: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    setLoaded(null);
    setAttempt((a) => a + 1);
  }, []);

  const current = loaded?.key === key ? loaded : null;
  const profiles = current?.profiles ?? null;
  const values: NutrientValues = {};
  for (const e of entries) {
    const profile = isDatabaseFood(e) ? (profiles?.get(Number(e.id)) ?? null) : null;
    const f = toGrams(e.amount, e.unit) / 100;
    for (const [k, v] of Object.entries(nutrientValues(e.per100, profile))) values[k] = (values[k] ?? 0) + v * f;
  }
  return {
    values,
    /** Entries without a full profile: everything but database foods. */
    withoutProfile: entries.filter((e) => !isDatabaseFood(e)).length,
    loading: key !== '' && current === null,
    failed: current !== null && profiles === null,
    retry,
  };
}
