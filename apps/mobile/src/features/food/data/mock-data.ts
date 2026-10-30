/**
 * Types and helpers for the Log Food screen, plus the mock data its not-yet-real flows still use.
 *
 * The day's log and food search come from the API (see `useFoodLog` and `searchFoods`), and the
 * daily targets from the user's profile (`useTargets`). What is still mocked here: saved recipes,
 * the barcode lookup, serving sizes, and the foods the recipe builder and photo estimate offer —
 * each marked as a swap point below.
 */

export type Macro = { kcal: number; protein: number; carbs: number; fat: number };
export type Food = { id: string; name: string; per100: Macro };
export type Unit = { label: string; grams: number };
/** One logged food. `time` is when it was eaten, "HH:MM" in local time. */
export type Entry = Food & { uid: number; amount: number; unit: string; time: string };
/** One ingredient: a FOOD_DB food (`id`) and how much of it, in grams or one of its units. */
export type RecipeItem = {
  id: string | null;
  amount: number | string;
  unit: string;
  /** Import only: how sure the reader was (0–1); under 0.7 asks the user to check. */
  confidence?: number | null;
  /** Import only: the ingredient line as written, kept while it isn't matched to a food. */
  raw?: string | null;
  imported?: boolean;
};
export type Recipe = { id: string; name: string; servings: number; source?: string | null; steps?: string[]; items: RecipeItem[] };
export type Barcode = { code: string; name: string; per100: Macro; amount: number; unit: string };

/** Daily targets: calories, and grams of protein, carbs, fat and fibre. */
export type Targets = Macro & { fiber: number };

/**
 * Default daily targets — what a new account starts with on the API too. Only a fallback, shown
 * until the signed-in user's profile has loaded: read the user's own with `useTargets()`.
 */
export const TARGETS: Targets = { kcal: 2000, protein: 150, carbs: 220, fat: 70, fiber: 28 };

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

// per-100g reference data used by the recipe builder and the photo estimate mock. Food search
// itself already uses the API's food database.
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
  { id: 'coffee', name: 'Coffee', per100: { kcal: 1, protein: 0.1, carbs: 0, fat: 0 } },
  { id: 'chocolate', name: 'Dark Chocolate', per100: { kcal: 598, protein: 7.8, carbs: 45.9, fat: 42.6 } },
  { id: 'wine', name: 'Red Wine', per100: { kcal: 85, protein: 0.1, carbs: 2.6, fat: 0 } },
  { id: 'oliveoil', name: 'Olive Oil', per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  { id: 'garlic', name: 'Garlic', per100: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5 } },
  { id: 'onion', name: 'Onion', per100: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } },
  { id: 'tomato', name: 'Tomato', per100: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 } },
  { id: 'spinach', name: 'Spinach', per100: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 } },
  { id: 'potato', name: 'Potato', per100: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 } },
  { id: 'pasta', name: 'Pasta', per100: { kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 } },
  { id: 'lemon', name: 'Lemon', per100: { kcal: 29, protein: 1.1, carbs: 9.3, fat: 0.3 } },
  { id: 'parmesan', name: 'Parmesan Cheese', per100: { kcal: 431, protein: 38, carbs: 4.1, fat: 29 } },
  { id: 'butter', name: 'Butter', per100: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 } },
  { id: 'pepper', name: 'Bell Pepper', per100: { kcal: 31, protein: 1, carbs: 6, fat: 0.3 } },
  { id: 'milk', name: 'Milk', per100: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 } },
];

/** Each food's own serving sizes, [label, grams] — from the design's nutrition-data.js. */
export const FOOD_SERVINGS: Record<string, Array<[string, number]>> = {
  chicken: [['1 breast', 172], ['1 cup diced', 140]],
  salmon: [['1 fillet', 154]],
  yogurt: [['1 cup', 227], ['1 pot', 170]],
  banana: [['1 medium', 118], ['1 large', 136]],
  almonds: [['1 handful', 28], ['10 almonds', 12]],
  egg: [['1 large', 50], ['1 medium', 44]],
  coffee: [['1 cup', 237], ['1 mug', 350]],
  chocolate: [['1 square', 10], ['1 bar', 100]],
  wine: [['1 glass', 150]],
  rice: [['1 cup cooked', 158]],
  apple: [['1 medium', 182]],
  oats: [['1 bowl', 234]],
};

// Saved recipes — swap for the user's recipe collection endpoint.
export const RECIPES: Recipe[] = [
  {
    id: 'r1',
    name: 'Chicken & Rice Bowl',
    servings: 2,
    items: [
      { id: 'chicken', amount: 300, unit: 'g' },
      { id: 'rice', amount: 360, unit: 'g' },
      { id: 'broccoli', amount: 200, unit: 'g' },
      { id: 'oliveoil', amount: 10, unit: 'g' },
    ],
  },
  {
    id: 'r2',
    name: 'Yogurt Berry Bowl',
    servings: 1,
    items: [
      { id: 'yogurt', amount: 200, unit: 'g' },
      { id: 'banana', amount: 1, unit: 'piece' },
      { id: 'almonds', amount: 20, unit: 'g' },
    ],
  },
  {
    id: 'r3',
    name: 'Salmon Dinner',
    servings: 2,
    source: 'bbcgoodfood.com',
    items: [
      { id: 'salmon', amount: 280, unit: 'g' },
      { id: 'potato', amount: 300, unit: 'g' },
      { id: 'broccoli', amount: 200, unit: 'g' },
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
