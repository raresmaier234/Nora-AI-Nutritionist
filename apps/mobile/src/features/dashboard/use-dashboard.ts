import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DayTotals, describeError, getSummary } from '@/services/api';
import { shiftDate, toDateString } from '@/features/food/hooks/use-food-log';

/** Days of the calorie trend, ending today. */
export const TREND_DAYS = 14;

export type DashboardData = {
  /** Monday to Sunday of this week; days still to come have nothing logged. */
  week: DayTotals[];
  /** The last TREND_DAYS days, ending today. */
  trend: DayTotals[];
  /** The plan's estimated daily burn; null without a plan. */
  maintenance: number | null;
  /** YYYY-MM-DD */
  today: string;
};

/** Monday of the week `date` is in (weeks start on Monday). */
function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday 0 … Sunday 6
  return shiftDate(date, -weekday);
}

/**
 * The dashboard's numbers: this week and the last two weeks, from one GET /meals/summary call.
 * Reloads every time the Dashboard tab comes into view, so a food logged a moment ago counts.
 */
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Loads the numbers; the returned function drops an answer that arrives after leaving.
  const load = useCallback(() => {
    const today = toDateString(new Date());
    const monday = mondayOf(today);
    const sunday = shiftDate(monday, 6);
    const trendStart = shiftDate(today, -(TREND_DAYS - 1)); // always on or before Monday
    let cancelled = false;
    getSummary(trendStart, sunday).then(
      (summary) => {
        if (cancelled) return;
        const byDate = new Map(summary.days.map((d) => [d.date, d]));
        const pick = (start: string, count: number) =>
          Array.from({ length: count }, (_, i) => byDate.get(shiftDate(start, i))).filter((d): d is DayTotals => !!d);
        setData({ week: pick(monday, 7), trend: pick(trendStart, TREND_DAYS), maintenance: summary.maintenance_kcal, today });
        setError(null);
      },
      (err: unknown) => {
        if (!cancelled) setError(describeError(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);
  return { data, error, retry: load };
}
