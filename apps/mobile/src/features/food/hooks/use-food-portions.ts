import { useEffect, useState } from 'react';

import { FoodPortions, getPortions } from '@/services/api';

const NONE: FoodPortions = { usual: null, last: null };

/**
 * How much of a database food the user usually logs and logged last time, for Food Details'
 * portion buttons. Fetched each time the screen opens — unlike the food itself, this changes
 * with every entry. Non-database foods (a saved recipe) and a failed request give no portions:
 * the buttons are a shortcut, so they simply don't show.
 */
export function useFoodPortions(foodId: string): FoodPortions {
  const id = /^\d+$/.test(foodId) ? Number(foodId) : null;
  const [loaded, setLoaded] = useState<{ id: number; portions: FoodPortions } | null>(null);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    getPortions(id).then(
      (portions) => {
        if (!cancelled) setLoaded({ id, portions });
      },
      () => {
        if (!cancelled) setLoaded({ id, portions: NONE });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  return loaded?.id === id ? loaded.portions : NONE;
}
