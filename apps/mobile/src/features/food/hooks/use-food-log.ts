import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  FoodLogEntry,
  FoodLogEntryCreate,
  copyDay,
  createEntry,
  deleteEntry,
  listEntries,
  updateEntry as patchEntry,
} from '@/services/api';
import { Entry, Food, Macro, TARGETS, entryMacros, sumMacros, toGrams } from '@/features/food/data/mock-data';
import { byTime, timeOf, toLoggedAt } from '@/features/food/time';

export type NotifyKind = 'success' | 'info';
export type Notify = (kind: NotifyKind, message: string) => void;

export type DetectedItem = Food & { amount: number; unit: string; confidence: number; on: boolean };
export type ScannedProduct = { code: string; name: string; per100: Macro; amount: number; unit: string };
export type CustomFoodForm = {
  name: string;
  amount: number | string;
  unit: string;
  kcal: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
};
/** What the Food Details screen can change about a logged entry. */
export type EntryChange = { amount: number; unit: string; time: string };

export type LoadState = 'loading' | 'ready' | 'error';

/** The API's entry, in the shape the Log screen renders. `uid` is the server's id. */
function toEntry(e: FoodLogEntry): Entry {
  return {
    uid: e.id,
    id: e.food_id !== null ? String(e.food_id) : `${e.source}-${e.id}`,
    name: e.name,
    per100: e.per_100g,
    amount: e.amount,
    unit: e.unit,
    time: timeOf(e.logged_at),
  };
}

/** `date` (YYYY-MM-DD) moved by `days`, computed in local time so it never slips a day. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

export function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A user-facing sentence for a failed request. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'network' || err.kind === 'timeout') return "Can't reach the server. Is the backend running?";
    const detail = err.message.split(': ').slice(1).join(': ');
    return detail || `The server returned an error (${err.status ?? 'unknown'}).`;
  }
  return 'Something went wrong.';
}

/**
 * Owns the food log for one day, backed by the API: every add, edit and delete goes to the
 * server, and what the server returns is what the screen shows. The day is one timeline —
 * entries sorted by the time they were eaten. UI-only state (which screen is open, search
 * query, etc.) lives in the screen instead.
 */
export function useFoodLog(date: string, onNotify?: Notify) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Clear straight away: the previous day's entries must not sit under the spinner looking
    // like this day's.
    setEntries([]);
    setLoadState('loading');
    setLoadError(null);
    listEntries(date)
      .then((list) => {
        if (cancelled) return;
        setEntries(list.map(toEntry).sort(byTime));
        setLoadState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(describeError(err));
        setLoadState('error');
      });
    // A slow response for a day the user has already left must not overwrite the new day.
    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const totals = useMemo(() => sumMacros(entries), [entries]);
  const remaining = Math.max(0, TARGETS.kcal - totals.kcal);
  const pct = Math.min(100, (totals.kcal / TARGETS.kcal) * 100);
  const over = totals.kcal > TARGETS.kcal;

  /** Create entries on the server and add whatever it accepted to the day. */
  const create = useCallback(
    async (bodies: FoodLogEntryCreate[]): Promise<FoodLogEntry[]> => {
      const results = await Promise.allSettled(bodies.map((body) => createEntry(body)));
      const created = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');

      // Only entries for the day on screen belong in it; the server files each by its own time.
      const shown = created.filter((e) => e.date === date);
      if (shown.length > 0) setEntries((s) => [...s, ...shown.map(toEntry)].sort(byTime));
      if (failure) {
        const lost = results.length - created.length;
        onNotify?.('info', `${lost === 1 ? 'Not saved' : `${lost} items not saved`}: ${describeError(failure.reason)}`);
      }
      return created;
    },
    [date, onNotify],
  );

  const base = useCallback(
    (time: string, amount: number, unit: string) => ({
      logged_at: toLoggedAt(date, time),
      amount,
      unit,
      grams: toGrams(amount, unit),
    }),
    [date],
  );

  /** Log a database food by id, or anything else (a saved recipe) by its name and values. */
  const addEntry = useCallback(
    async (time: string, food: Food, amount = 100, unit = 'g') => {
      const ref = /^\d+$/.test(food.id)
        ? { food_id: Number(food.id) }
        : { source: 'recipe' as const, name: food.name, per_100g: food.per100 };
      const [entry] = await create([{ ...base(time, amount, unit), ...ref }]);
      if (entry) onNotify?.('success', `${entry.name} logged at ${time}.`);
    },
    [base, create, onNotify],
  );

  const changeEntry = useCallback(
    async (uid: number, change: EntryChange) => {
      try {
        const updated = toEntry(
          await patchEntry(uid, {
            logged_at: toLoggedAt(date, change.time),
            amount: change.amount,
            unit: change.unit,
            grams: toGrams(change.amount, change.unit),
          }),
        );
        setEntries((s) => s.map((e) => (e.uid === uid ? updated : e)).sort(byTime));
        onNotify?.('success', `${updated.name} updated.`);
      } catch (err) {
        onNotify?.('info', `Change not saved: ${describeError(err)}`);
      }
    },
    [date, onNotify],
  );

  const removeEntry = useCallback(
    async (uid: number, name: string) => {
      try {
        await deleteEntry(uid);
      } catch (err) {
        onNotify?.('info', `${name} not removed: ${describeError(err)}`);
        return;
      }
      setEntries((s) => s.filter((e) => e.uid !== uid));
      onNotify?.('info', `${name} removed.`);
    },
    [onNotify],
  );

  const copyYesterday = useCallback(async () => {
    try {
      const copied = await copyDay(shiftDate(date, -1), date);
      if (copied.length === 0) {
        onNotify?.('info', 'Nothing was logged the day before.');
        return;
      }
      reload();
      onNotify?.('success', `Copied ${copied.length} item${copied.length === 1 ? '' : 's'} from the day before.`);
    } catch (err) {
      onNotify?.('info', `Not copied: ${describeError(err)}`);
    }
  }, [date, onNotify, reload]);

  const addScanned = useCallback(
    async (time: string, product: ScannedProduct) => {
      const created = await create([
        { ...base(time, product.amount, product.unit), source: 'barcode', name: product.name, per_100g: product.per100 },
      ]);
      if (created.length > 0) onNotify?.('success', `${product.name} logged at ${time}.`);
    },
    [base, create, onNotify],
  );

  const addPhotoItems = useCallback(
    async (time: string, list: DetectedItem[]) => {
      const created = await create(
        list.map((i) => ({ ...base(time, i.amount, i.unit), source: 'photo' as const, name: i.name, per_100g: i.per100 })),
      );
      if (created.length > 0) {
        const kcal = created.reduce((a, e) => a + entryMacros(toEntry(e)).kcal, 0);
        onNotify?.('success', `${created.length} items logged at ${time} — ${kcal} kcal.`);
      }
    },
    [base, create, onNotify],
  );

  const saveCustom = useCallback(
    async (time: string, form: CustomFoodForm) => {
      const amount = Number(form.amount) || 100;
      const grams = toGrams(amount, form.unit) || 100;
      const scale = 100 / grams;
      const per100: Macro = {
        kcal: Math.round((Number(form.kcal) || 0) * scale),
        protein: Math.round((Number(form.protein) || 0) * scale),
        carbs: Math.round((Number(form.carbs) || 0) * scale),
        fat: Math.round((Number(form.fat) || 0) * scale),
      };
      const name = String(form.name).trim();
      const created = await create([{ ...base(time, amount, form.unit), source: 'custom', name, per_100g: per100 }]);
      if (created.length > 0) onNotify?.('success', `${name} logged at ${time}.`);
    },
    [base, create, onNotify],
  );

  return {
    entries,
    loadState,
    loadError,
    reload,
    totals,
    remaining,
    pct,
    over,
    addEntry,
    changeEntry,
    removeEntry,
    copyYesterday,
    addScanned,
    addPhotoItems,
    saveCustom,
  };
}
