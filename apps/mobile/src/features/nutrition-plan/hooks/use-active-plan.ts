import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { MeasurementUnits, NutritionPlan, describeError, getActivePlan, getLatestGoals } from '@/services/api';

type Loaded = { key: string; userId: string; plan: NutritionPlan | null; units: MeasurementUnits; error: string | null };

/**
 * The signed-in user's active nutrition plan (with its texts), for the Strategy tab — and the
 * units their answers use, to show weights the way they entered them. Only fetched while
 * `enabled` (a premium account whose `targets_mode` is `plan`); fetched again whenever `version`
 * changes (a plan was activated). While it reloads, the previous plan stays on screen.
 */
export function useActivePlan(enabled: boolean, version: number) {
  const userId = useAuth().user?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [retries, setRetries] = useState(0);
  const key = `${userId}:${version}:${retries}`;

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    Promise.all([getActivePlan(), getLatestGoals().catch(() => null)])
      .then(([plan, goal]) => {
        if (!cancelled) setLoaded({ key, userId, plan, units: goal?.answers?.units ?? 'metric', error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A failed reload keeps the plan already on screen.
        setLoaded((prev) => ({
          key,
          userId,
          plan: prev?.userId === userId ? prev.plan : null,
          units: prev?.units ?? 'metric',
          error: describeError(err),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, userId]);

  const current = enabled && loaded?.userId === userId ? loaded : null;
  return {
    plan: current?.plan ?? null,
    units: current?.units ?? ('metric' as MeasurementUnits),
    loading: enabled && loaded?.key !== key,
    error: current?.error ?? null,
    retry: () => setRetries((n) => n + 1),
  };
}
