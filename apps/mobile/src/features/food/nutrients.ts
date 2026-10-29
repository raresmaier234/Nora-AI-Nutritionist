/**
 * The nutrient reference behind Food Details' "Good source of" and "Full nutrition" sections,
 * ported from the design's nutrition-data.js: which rows each section lists, their labels and
 * units, % Daily Values and daily targets. Keys are the API's (GET /foods/{id}), per 100 g.
 */

import type { NutrientAmount } from '@/services/api';

import type { Macro } from './data/mock-data';
import type { NutrientFamily } from './theme';

/** Nutrient key → amount, in the unit its row states. Missing = no data, never zero. */
export type NutrientValues = Record<string, number>;

export type NutrientRow = {
  key: string;
  label: string;
  unit: string;
  /** Indented under the row above (Sugars under Carbohydrates). */
  sub?: boolean;
  /** Starts a labelled group within the section ("Essential"). */
  group?: string;
};
export type NutrientSectionId = 'macros' | 'sugars' | 'fats' | 'amino' | 'vitamins' | 'minerals' | 'other';
export type NutrientSection = { id: NutrientSectionId; label: string; open?: boolean; rows: NutrientRow[] };

const row = (key: string, label: string, unit = 'g', sub = false, group?: string): NutrientRow => ({ key, label, unit, sub, group });

export const NUTRIENT_SECTIONS: NutrientSection[] = [
  {
    id: 'macros',
    label: 'Macronutrients',
    open: true,
    rows: [
      row('protein', 'Protein'),
      row('carbs', 'Carbohydrates'),
      row('sugar', 'Sugars', 'g', true),
      row('fiber', 'Fiber', 'g', true),
      row('fat', 'Fat'),
      row('saturated_fat', 'Saturated', 'g', true),
      row('unsaturated_fat', 'Unsaturated', 'g', true),
      row('water', 'Water'),
    ],
  },
  {
    id: 'sugars',
    label: 'Sugars',
    rows: [
      row('sugar', 'Total sugars'),
      row('starch', 'Starch'),
      row('sucrose', 'Sucrose'),
      row('glucose', 'Glucose'),
      row('fructose', 'Fructose'),
      row('lactose', 'Lactose'),
      row('maltose', 'Maltose'),
      row('galactose', 'Galactose'),
    ],
  },
  {
    id: 'fats',
    label: 'Fats & Fatty Acids',
    rows: [
      row('fat', 'Total fat'),
      row('saturated_fat', 'Saturated'),
      row('monounsaturated_fat', 'Monounsaturated'),
      row('polyunsaturated_fat', 'Polyunsaturated'),
      row('trans_fat', 'Trans'),
      row('cholesterol', 'Cholesterol', 'mg'),
      row('omega_3', 'Omega-3', 'g', false, 'Fatty acids'),
      row('ala', 'ALA', 'g', true),
      row('epa', 'EPA', 'g', true),
      row('dha', 'DHA', 'g', true),
      row('dpa', 'DPA', 'g', true),
      row('omega_6', 'Omega-6'),
    ],
  },
  {
    id: 'amino',
    label: 'Amino Acids',
    rows: [
      row('tryptophan', 'Tryptophan', 'g', false, 'Essential'),
      row('threonine', 'Threonine'),
      row('isoleucine', 'Isoleucine'),
      row('leucine', 'Leucine'),
      row('lysine', 'Lysine'),
      row('methionine', 'Methionine'),
      row('phenylalanine', 'Phenylalanine'),
      row('valine', 'Valine'),
      row('histidine', 'Histidine'),
      row('cystine', 'Cystine', 'g', false, 'Non-essential'),
      row('tyrosine', 'Tyrosine'),
      row('arginine', 'Arginine'),
      row('alanine', 'Alanine'),
      row('aspartic_acid', 'Aspartic acid'),
      row('glutamic_acid', 'Glutamic acid'),
      row('glycine', 'Glycine'),
      row('proline', 'Proline'),
      row('serine', 'Serine'),
      row('hydroxyproline', 'Hydroxyproline'),
    ],
  },
  {
    id: 'vitamins',
    label: 'Vitamins',
    rows: [
      row('vitamin_a', 'Vitamin A', 'µg'),
      row('retinol', 'Retinol', 'µg', true),
      row('beta_carotene', 'Beta-carotene', 'µg', true),
      row('alpha_carotene', 'Alpha-carotene', 'µg', true),
      row('vitamin_c', 'Vitamin C', 'mg'),
      row('vitamin_d', 'Vitamin D', 'µg'),
      row('vitamin_d2', 'Vitamin D2', 'µg', true),
      row('vitamin_d3', 'Vitamin D3', 'µg', true),
      row('vitamin_e', 'Vitamin E', 'mg'),
      row('vitamin_k', 'Vitamin K', 'µg'),
      row('thiamin', 'Thiamin (B1)', 'mg'),
      row('riboflavin', 'Riboflavin (B2)', 'mg'),
      row('niacin', 'Niacin (B3)', 'mg'),
      row('pantothenic_acid', 'Pantothenic acid (B5)', 'mg'),
      row('vitamin_b6', 'Vitamin B6', 'mg'),
      row('folate', 'Folate (B9)', 'µg'),
      row('vitamin_b12', 'Vitamin B12', 'µg'),
      row('choline', 'Choline', 'mg'),
    ],
  },
  {
    id: 'minerals',
    label: 'Minerals',
    rows: [
      row('calcium', 'Calcium', 'mg'),
      row('iron', 'Iron', 'mg'),
      row('magnesium', 'Magnesium', 'mg'),
      row('phosphorus', 'Phosphorus', 'mg'),
      row('potassium', 'Potassium', 'mg'),
      row('sodium', 'Sodium', 'mg'),
      row('zinc', 'Zinc', 'mg'),
      row('copper', 'Copper', 'mg'),
      row('manganese', 'Manganese', 'mg'),
      row('selenium', 'Selenium', 'µg'),
      row('fluoride', 'Fluoride', 'µg'),
    ],
  },
  {
    id: 'other',
    label: 'Other Compounds',
    rows: [
      row('water', 'Water'),
      row('alcohol', 'Alcohol'),
      row('caffeine', 'Caffeine', 'mg'),
      row('theobromine', 'Theobromine', 'mg'),
      row('lycopene', 'Lycopene', 'µg'),
      row('betaine', 'Betaine', 'mg'),
    ],
  },
];

/** FDA Daily Values (2,000 kcal diet), in each row's unit. */
export const DAILY_VALUES: NutrientValues = {
  vitamin_a: 900, vitamin_c: 90, vitamin_d: 20, vitamin_e: 15, vitamin_k: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16,
  vitamin_b6: 1.7, folate: 400, vitamin_b12: 2.4, choline: 550, pantothenic_acid: 5,
  calcium: 1300, iron: 18, magnesium: 420, phosphorus: 1250, potassium: 4700, sodium: 2300, zinc: 11, copper: 0.9,
  manganese: 2.3, selenium: 55, fiber: 28, saturated_fat: 20, cholesterol: 300,
};

export type NutrientTarget = { value: number; kind: 'goal' | 'limit' };

/**
 * Only nutrients with an established reference value get a bar: 'goal' to reach, 'limit' to stay
 * under. FDA Daily Values, IOM Adequate Intakes (omega-3/6, ALA), WHO essential amino-acid needs
 * at 70 kg. Everything else shows its value only.
 */
export const NUTRIENT_TARGETS: Record<string, NutrientTarget> = {
  ...Object.fromEntries(Object.entries(DAILY_VALUES).map(([k, v]) => [k, { value: v, kind: 'goal' as const }])),
  fiber: { value: 28, kind: 'goal' },
  saturated_fat: { value: 20, kind: 'limit' },
  cholesterol: { value: 300, kind: 'limit' },
  sodium: { value: 2300, kind: 'limit' },
  caffeine: { value: 400, kind: 'limit' },
  omega_3: { value: 1.6, kind: 'goal' },
  ala: { value: 1.6, kind: 'goal' },
  omega_6: { value: 17, kind: 'goal' },
  histidine: { value: 0.7, kind: 'goal' },
  isoleucine: { value: 1.4, kind: 'goal' },
  leucine: { value: 2.73, kind: 'goal' },
  lysine: { value: 2.1, kind: 'goal' },
  threonine: { value: 1.05, kind: 'goal' },
  tryptophan: { value: 0.28, kind: 'goal' },
  valine: { value: 1.82, kind: 'goal' },
};

const VITAMINS = ['vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k', 'thiamin', 'riboflavin', 'niacin', 'vitamin_b6', 'folate', 'vitamin_b12', 'choline', 'pantothenic_acid'];
const MINERALS = ['calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'zinc', 'copper', 'manganese', 'selenium'];
const VITAMIN_SET = new Set(VITAMINS);

/** Vitamins and minerals in the vitamin or mineral colour; other rows take their section's. */
export const microFamily = (key: string): NutrientFamily => (VITAMIN_SET.has(key) ? 'vitamin' : 'mineral');

export const nutrientLabel = (key: string) => NUTRIENT_SECTIONS.flatMap((s) => s.rows).find((r) => r.key === key)?.label ?? key;

/** The vitamins and minerals this portion gives at least 10% DV of, highest first, at most four. */
export function goodSources(values: NutrientValues) {
  return [...VITAMINS, ...MINERALS]
    .filter((k) => values[k] != null)
    .map((k) => ({ key: k, label: nutrientLabel(k), pct: Math.round((values[k] / DAILY_VALUES[k]) * 100), family: microFamily(k) }))
    .filter((m) => m.pct >= 10)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);
}

/** Per-100 g values for one food: its macros, plus the API's nutrient list when it has loaded. */
export function nutrientValues(per100: Macro, nutrients: NutrientAmount[] | null): NutrientValues {
  const values: NutrientValues = { ...per100 };
  for (const n of nutrients ?? []) values[n.key] = n.amount;
  const { monounsaturated_fat: mono, polyunsaturated_fat: poly } = values;
  if (mono != null || poly != null) values.unsaturated_fat = (mono ?? 0) + (poly ?? 0);
  return values;
}
