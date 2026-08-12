/**
 * Mock data for the Log Food screen, ported verbatim from LogPageV3.jsx.
 * Every array here is a documented swap point for a real backend (see comments).
 */

export type Macro = { kcal: number; protein: number; carbs: number; fat: number };
export type Food = { id: string; name: string; per100: Macro };
export type Unit = { label: string; grams: number };
export type Entry = Food & { uid: number; amount: number; unit: string; time: string };
export type Recipe = { id: string; name: string; items: Array<[string, number, string]> };
export type Barcode = { code: string; name: string; per100: Macro; amount: number; unit: string };
export type MealName = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
export type DayEntries = Record<MealName, Entry[]>;

export const TARGETS: Macro = { kcal: 2000, protein: 150, carbs: 220, fat: 70 };

export const UNITS: Unit[] = [
  { label: 'g', grams: 1 },
  { label: 'oz', grams: 28.35 },
  { label: 'slice', grams: 30 },
  { label: 'piece', grams: 50 },
  { label: 'cup', grams: 150 },
  { label: 'serving', grams: 100 },
];

export const toGrams = (amount: number, unit: string) =>
  amount * (UNITS.find((u) => u.label === unit) ?? UNITS[0]).grams;

// per-100g reference data — swap for an API-backed food database.
export const FOOD_DB: Food[] = [
  { id: 'yogurt', name: 'Greek Yogurt', per100: { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 } },
  { id: 'banana', name: 'Banana', per100: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 } },
  { id: 'almonds', name: 'Almonds', per100: { kcal: 579, protein: 21, carbs: 22, fat: 50 } },
  { id: 'chicken', name: 'Chicken Breast', per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { id: 'rice', name: 'Rice', per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { id: 'salad', name: 'Salad', per100: { kcal: 60, protein: 1.4, carbs: 6.5, fat: 2.7 } },
  { id: 'salmon', name: 'Salmon', per100: { kcal: 208, protein: 20, carbs: 0, fat: 13 } },
  { id: 'broccoli', name: 'Vegetables', per100: { kcal: 50, protein: 2, carbs: 9, fat: 0.5 } },
  { id: 'apple', name: 'Apple', per100: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 } },
  { id: 'oats', name: 'Oatmeal', per100: { kcal: 68, protein: 2.4, carbs: 12, fat: 1.4 } },
  { id: 'egg', name: 'Egg', per100: { kcal: 155, protein: 13, carbs: 1.1, fat: 11 } },
  { id: 'coffee', name: 'Coffee', per100: { kcal: 2, protein: 0.1, carbs: 0, fat: 0 } },
];

export const MEALS: MealName[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

// Saved recipes — swap for the user's recipe collection endpoint.
export const RECIPES: Recipe[] = [
  {
    id: 'r1',
    name: 'Chicken & Rice Bowl',
    items: [
      ['chicken', 150, 'g'],
      ['rice', 180, 'g'],
      ['broccoli', 100, 'g'],
    ],
  },
  {
    id: 'r2',
    name: 'Yogurt Berry Bowl',
    items: [
      ['yogurt', 200, 'g'],
      ['banana', 1, 'piece'],
      ['almonds', 20, 'g'],
    ],
  },
  {
    id: 'r3',
    name: 'Salmon Dinner',
    items: [
      ['salmon', 140, 'g'],
      ['broccoli', 200, 'g'],
    ],
  },
];

// Barcode → product lookup, mocked. Swap for a real barcode/product API.
export const BARCODES: Barcode[] = [
  { code: '5901234123457', name: 'Greek Yogurt 0%', per100: { kcal: 57, protein: 10, carbs: 4, fat: 0.2 }, amount: 170, unit: 'g' },
  { code: '4006381333931', name: 'Protein Bar', per100: { kcal: 350, protein: 30, carbs: 32, fat: 9 }, amount: 60, unit: 'g' },
];

export const entryMacros = (e: { per100: Macro; amount: number; unit: string }): Macro => {
  const f = toGrams(e.amount, e.unit) / 100;
  return {
    kcal: Math.round(e.per100.kcal * f),
    protein: Math.round(e.per100.protein * f),
    carbs: Math.round(e.per100.carbs * f),
    fat: Math.round(e.per100.fat * f),
  };
};

export const sumMacros = (list: Array<{ per100: Macro; amount: number; unit: string }>): Macro =>
  list.reduce(
    (a, e) => {
      const m = entryMacros(e);
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

export const seed = (): DayEntries => ({
  Breakfast: [
    { uid: 1, ...FOOD_DB[0], amount: 150, unit: 'g', time: '08:10' },
    { uid: 2, ...FOOD_DB[1], amount: 1, unit: 'piece', time: '08:12' },
  ],
  Lunch: [
    { uid: 3, ...FOOD_DB[3], amount: 150, unit: 'g', time: '13:05' },
    { uid: 4, ...FOOD_DB[4], amount: 180, unit: 'g', time: '13:06' },
  ],
  Dinner: [{ uid: 5, ...FOOD_DB[6], amount: 120, unit: 'g', time: '19:20' }],
  Snacks: [],
});
