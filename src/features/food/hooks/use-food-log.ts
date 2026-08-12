import { useCallback, useMemo, useState } from 'react';

import {
  DayEntries,
  Entry,
  Food,
  Macro,
  MealName,
  TARGETS,
  entryMacros,
  seed,
  sumMacros,
  toGrams,
} from '@/data/log-mock-data';

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

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Owns the day's food log data and the single mutation surface for it.
 * UI-only state (which sheet is open, search query, etc.) lives in the screen instead.
 */
export function useFoodLog(onNotify?: Notify) {
  const [entries, setEntries] = useState<DayEntries>(seed);
  const [water, setWater] = useState(5);

  const totals = useMemo(() => sumMacros(Object.values(entries).flat()), [entries]);
  const remaining = Math.max(0, TARGETS.kcal - totals.kcal);
  const pct = Math.min(100, (totals.kcal / TARGETS.kcal) * 100);
  const over = totals.kcal > TARGETS.kcal;
  const entryCount = useMemo(() => Object.values(entries).flat().length, [entries]);

  const addEntry = useCallback(
    (meal: MealName, food: Food, amount = 100, unit = 'g') => {
      setEntries((s) => ({ ...s, [meal]: [...s[meal], { uid: Date.now(), ...food, amount, unit, time: timeNow() }] }));
      onNotify?.('success', `${food.name} added to ${meal}.`);
    },
    [onNotify],
  );

  const updateEntry = useCallback((meal: MealName, uid: number, patch: Partial<Entry>) => {
    setEntries((s) => ({ ...s, [meal]: s[meal].map((e) => (e.uid === uid ? { ...e, ...patch } : e)) }));
  }, []);

  const removeEntry = useCallback(
    (meal: MealName, uid: number, name: string) => {
      setEntries((s) => ({ ...s, [meal]: s[meal].filter((e) => e.uid !== uid) }));
      onNotify?.('info', `${name} removed.`);
    },
    [onNotify],
  );

  const copyYesterday = useCallback(() => {
    setEntries(seed());
    onNotify?.('success', "Yesterday's meals copied.");
  }, [onNotify]);

  const addRecipe = useCallback(
    (targetMeal: MealName, recipe: { id?: string; name: string }, recipeTotals: Macro) => {
      const per100 = { ...recipeTotals };
      setEntries((s) => ({
        ...s,
        [targetMeal]: [
          ...s[targetMeal],
          { uid: Date.now(), id: recipe.id ?? 'custom-recipe', name: recipe.name, per100, amount: 100, unit: 'g', time: timeNow() },
        ],
      }));
      onNotify?.('success', `${recipe.name} added to ${targetMeal} — ${recipeTotals.kcal} kcal.`);
    },
    [onNotify],
  );

  const addScanned = useCallback(
    (targetMeal: MealName, product: ScannedProduct) => {
      setEntries((s) => ({
        ...s,
        [targetMeal]: [
          ...s[targetMeal],
          { uid: Date.now(), id: product.code, name: product.name, per100: product.per100, amount: product.amount, unit: product.unit, time: timeNow() },
        ],
      }));
      onNotify?.('success', `${product.name} scanned into ${targetMeal}.`);
    },
    [onNotify],
  );

  const addPhotoItems = useCallback(
    (targetMeal: MealName, list: DetectedItem[]) => {
      const added = list.map((i, n) => ({ uid: Date.now() + n, id: i.id, name: i.name, per100: i.per100, amount: i.amount, unit: i.unit, time: timeNow() }));
      setEntries((s) => ({ ...s, [targetMeal]: [...s[targetMeal], ...added] }));
      const kcal = added.reduce((a, e) => a + entryMacros(e).kcal, 0);
      onNotify?.('success', `${added.length} items added to ${targetMeal} — ${kcal} kcal.`);
    },
    [onNotify],
  );

  const saveCustom = useCallback(
    (targetMeal: MealName, form: CustomFoodForm) => {
      const grams = toGrams(Number(form.amount) || 100, form.unit) || 100;
      const scale = 100 / grams;
      const per100: Macro = {
        kcal: Math.round((Number(form.kcal) || 0) * scale),
        protein: Math.round((Number(form.protein) || 0) * scale),
        carbs: Math.round((Number(form.carbs) || 0) * scale),
        fat: Math.round((Number(form.fat) || 0) * scale),
      };
      const name = String(form.name).trim();
      setEntries((s) => ({
        ...s,
        [targetMeal]: [
          ...s[targetMeal],
          { uid: Date.now(), id: 'custom-' + Date.now(), name, per100, amount: Number(form.amount) || 100, unit: form.unit, time: timeNow() },
        ],
      }));
      onNotify?.('success', `${name} saved to your foods.`);
    },
    [onNotify],
  );

  return {
    entries,
    water,
    setWater,
    totals,
    remaining,
    pct,
    over,
    entryCount,
    addEntry,
    updateEntry,
    removeEntry,
    copyYesterday,
    addRecipe,
    addScanned,
    addPhotoItems,
    saveCustom,
  };
}
