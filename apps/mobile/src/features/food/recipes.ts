/**
 * Recipe maths, ported from the design's RecipeStudioV3.jsx. Ingredients carry
 * { id, amount, unit }; nutrition is always derived from them, never typed. Units are
 * food-aware: g, each food's own servings ("breast", "cup cooked"), then the generic units.
 *
 * A saved recipe becomes a food (`recipeFood`): per-100 g values of the finished dish plus
 * "1 serving" / "whole recipe" servings, so it opens in Food Details and logs like any food.
 *
 * Photo and link import are mocked — swap IMPORT_PHOTO / IMPORT_LINK for the real endpoints.
 */
import { FOOD_DB, FOOD_SERVINGS, Food, Macro, Recipe, RecipeItem, UNITS } from '@/features/food/data/mock-data';

export type Unit = [label: string, grams: number];
export type RecipeTotals = Macro & { grams: number };

export const recipeFoodById = (id: string | null) => (id ? FOOD_DB.find((f) => f.id === id) : undefined);

/** Units an ingredient can be measured in: grams, its own servings, then the generic units. */
export function recipeUnits(id: string | null): Unit[] {
  const own: Unit[] = (id ? (FOOD_SERVINGS[id] ?? []) : []).map(([l, g]) => [l.replace(/^1 /, ''), g]);
  const generic: Unit[] = UNITS.filter((u) => u.label !== 'g').map((u) => [u.label, u.grams]);
  return [['g', 1], ...own, ...generic.filter(([l]) => !own.some(([o]) => o === l))];
}

export function itemGrams(it: RecipeItem): number {
  const u = recipeUnits(it.id).find(([l]) => l === it.unit);
  return (Number(it.amount) || 0) * (u ? u[1] : 1);
}

export function macrosFor(food: Food, grams: number): Macro {
  const k = grams / 100;
  const p = food.per100;
  return { kcal: p.kcal * k, protein: p.protein * k, carbs: p.carbs * k, fat: p.fat * k };
}

/** Whole-recipe totals over the ingredients matched to a food; unmatched ones don't count. */
export function recipeTotals(items: RecipeItem[]): RecipeTotals {
  return items.reduce<RecipeTotals>(
    (a, it) => {
      const f = recipeFoodById(it.id);
      if (!f) return a;
      const g = itemGrams(it);
      const m = macrosFor(f, g);
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, grams: a.grams + g };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  );
}

/** A saved recipe as a food: per-100 g of the finished dish, with its servings. */
export function recipeFood(r: Recipe): { food: Food; servings: Unit[]; iconName: string } {
  const t = recipeTotals(r.items);
  const per = (v: number) => (t.grams ? (v * 100) / t.grams : 0);
  const servings = Math.max(r.servings || 1, 0.5);
  const first = r.items.map((i) => recipeFoodById(i.id)).find(Boolean);
  return {
    food: { id: `recipe-${r.id}`, name: r.name, per100: { kcal: per(t.kcal), protein: per(t.protein), carbs: per(t.carbs), fat: per(t.fat) } },
    servings: [
      ['1 serving', Math.round(t.grams / servings)],
      ['whole recipe', Math.round(t.grams)],
    ],
    iconName: first ? first.name : r.name,
  };
}

// ---- Import (mocked) ----------------------------------------------------------------

type ImportRow = [id: string | null, amount: number, unit: string, confidence?: number | null, raw?: string];
type ImportSource = { name: string; servings: number; items: ImportRow[]; steps?: string[] };

export const IMPORT_PHOTO: ImportSource = {
  name: 'Chicken & Veg Stir-fry',
  servings: 2,
  items: [
    ['chicken', 300, 'g', 0.93],
    ['rice', 1.5, 'cup cooked', 0.86],
    ['broccoli', 200, 'g', 0.81],
    ['pepper', 1, 'piece', 0.74],
    ['oliveoil', 15, 'g', 0.62],
    ['garlic', 10, 'g', 0.58],
  ],
};

export const IMPORT_LINK: ImportSource = {
  name: 'Lemon Herb Salmon with Potatoes',
  servings: 4,
  items: [
    ['salmon', 4, 'fillet'],
    ['potato', 500, 'g'],
    ['spinach', 200, 'g'],
    ['lemon', 1, 'piece'],
    ['oliveoil', 30, 'g'],
    ['garlic', 12, 'g'],
    [null, 10, 'g', null, '1 small bunch fresh dill'],
  ],
  steps: [
    'Heat the oven to 200 °C. Halve the potatoes and roast with half the oil for 20 minutes.',
    'Season the salmon with lemon zest, garlic and dill.',
    'Add the salmon to the tray and roast 12–15 minutes more.',
    'Wilt the spinach in the pan juices and serve with lemon wedges.',
  ],
};

export const importItems = (src: ImportSource): RecipeItem[] =>
  src.items.map(([id, amount, unit, confidence, raw]) => ({ id, amount, unit, confidence: confidence ?? null, raw: raw ?? null, imported: true }));

/** "www.bbcgoodfood.com/recipes/…" → "bbcgoodfood.com"; null when it isn't a link. */
export function linkHost(url: string): string | null {
  const m = /^(?:https?:\/\/)?([^/\s?#]+)/i.exec(url.trim());
  if (!m) return null;
  const host = m[1].replace(/^www\./i, '').toLowerCase();
  return host.includes('.') ? host : null;
}
