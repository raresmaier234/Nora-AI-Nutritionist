/* Nutrition reference data for the Food Details screen — per 100 g.
   Plain script (no JSX). Swap NUTRITION / SERVINGS for the food API. */
(() => {
// ---- Nutrient schema --------------------------------------------------------
// level: 1 summary · 2 key detail (open by default) · 3 advanced (collapsed sections)
const DV = { vitA: 900, vitC: 90, vitD: 20, vitE: 15, vitK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, b6: 1.7, folate: 400, b12: 2.4, choline: 550, pantothenic: 5, calcium: 1300, iron: 18, magnesium: 420, phosphorus: 1250, potassium: 4700, sodium: 2300, zinc: 11, copper: 0.9, manganese: 2.3, selenium: 55, fiber: 28, saturated: 20, cholesterol: 300 };
const SECTIONS = [
  { id: 'macros', label: 'Macronutrients', open: true, rows: [
    ['protein', 'Protein', 'g'], ['carbs', 'Carbohydrates', 'g'], ['sugar', 'Sugars', 'g', 1], ['fiber', 'Fiber', 'g', 1],
    ['fat', 'Fat', 'g'], ['saturated', 'Saturated', 'g', 1], ['unsaturated', 'Unsaturated', 'g', 1], ['water', 'Water', 'g'],
  ] },
  { id: 'sugars', label: 'Sugars', rows: [
    ['sugar', 'Total sugars', 'g'], ['starch', 'Starch', 'g'], ['sucrose', 'Sucrose', 'g'], ['glucose', 'Glucose', 'g'], ['fructose', 'Fructose', 'g'],
    ['lactose', 'Lactose', 'g'], ['maltose', 'Maltose', 'g'], ['galactose', 'Galactose', 'g'],
  ] },
  { id: 'fats', label: 'Fats & Fatty Acids', rows: [
    ['fat', 'Total fat', 'g'], ['saturated', 'Saturated', 'g'], ['mono', 'Monounsaturated', 'g'], ['poly', 'Polyunsaturated', 'g'], ['trans', 'Trans', 'g'],
    ['cholesterol', 'Cholesterol', 'mg'], ['omega3', 'Omega-3', 'g', 0, 'Fatty acids'], ['ala', 'ALA', 'g', 1], ['epa', 'EPA', 'g', 1], ['dha', 'DHA', 'g', 1], ['dpa', 'DPA', 'g', 1], ['omega6', 'Omega-6', 'g'],
  ] },
  { id: 'amino', label: 'Amino Acids', rows: [
    ['tryptophan', 'Tryptophan', 'g', 0, 'Essential'], ['threonine', 'Threonine', 'g'], ['isoleucine', 'Isoleucine', 'g'], ['leucine', 'Leucine', 'g'], ['lysine', 'Lysine', 'g'],
    ['methionine', 'Methionine', 'g'], ['phenylalanine', 'Phenylalanine', 'g'], ['valine', 'Valine', 'g'], ['histidine', 'Histidine', 'g'],
    ['cystine', 'Cystine', 'g', 0, 'Non-essential'], ['tyrosine', 'Tyrosine', 'g'], ['arginine', 'Arginine', 'g'], ['alanine', 'Alanine', 'g'], ['aspartic', 'Aspartic acid', 'g'],
    ['glutamic', 'Glutamic acid', 'g'], ['glycine', 'Glycine', 'g'], ['proline', 'Proline', 'g'], ['serine', 'Serine', 'g'],
  ] },
  { id: 'vitamins', label: 'Vitamins', rows: [
    ['vitA', 'Vitamin A', 'µg'], ['vitC', 'Vitamin C', 'mg'], ['vitD', 'Vitamin D', 'µg'], ['vitE', 'Vitamin E', 'mg'], ['vitK', 'Vitamin K', 'µg'],
    ['thiamin', 'Thiamin (B1)', 'mg'], ['riboflavin', 'Riboflavin (B2)', 'mg'], ['niacin', 'Niacin (B3)', 'mg'], ['pantothenic', 'Pantothenic acid (B5)', 'mg'],
    ['b6', 'Vitamin B6', 'mg'], ['folate', 'Folate (B9)', 'µg'], ['b12', 'Vitamin B12', 'µg'], ['choline', 'Choline', 'mg'],
  ] },
  { id: 'minerals', label: 'Minerals', rows: [
    ['calcium', 'Calcium', 'mg'], ['iron', 'Iron', 'mg'], ['magnesium', 'Magnesium', 'mg'], ['phosphorus', 'Phosphorus', 'mg'], ['potassium', 'Potassium', 'mg'],
    ['sodium', 'Sodium', 'mg'], ['zinc', 'Zinc', 'mg'], ['copper', 'Copper', 'mg'], ['manganese', 'Manganese', 'mg'], ['selenium', 'Selenium', 'µg'],
  ] },
  { id: 'other', label: 'Other Compounds', rows: [
    ['water', 'Water', 'g'], ['alcohol', 'Alcohol', 'g'], ['caffeine', 'Caffeine', 'mg'], ['theobromine', 'Theobromine', 'mg'],
  ] },
];

// ---- Per-100 g profiles (USDA-style approximations; swap for the food API) ----
const NUTRITION = {
  chicken: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, water: 65.3, sugar: 0, saturated: 1.01, mono: 1.24, poly: 0.77, trans: 0.03, cholesterol: 85, omega3: 0.07, ala: 0.03, epa: 0.01, dha: 0.02, dpa: 0.01, omega6: 0.59,
    tryptophan: 0.36, threonine: 1.31, isoleucine: 1.64, leucine: 2.33, lysine: 2.64, methionine: 0.86, cystine: 0.4, phenylalanine: 1.23, tyrosine: 1.05, valine: 1.54, arginine: 1.87, histidine: 0.96, alanine: 1.69, aspartic: 2.76, glutamic: 4.63, glycine: 1.53, proline: 1.28, serine: 1.06,
    vitA: 6, vitC: 0, vitD: 0.1, vitE: 0.27, vitK: 0.3, thiamin: 0.07, riboflavin: 0.11, niacin: 13.7, b6: 0.6, folate: 4, b12: 0.34, choline: 85, pantothenic: 0.97,
    calcium: 15, iron: 1.04, magnesium: 29, phosphorus: 228, potassium: 256, sodium: 74, zinc: 1, copper: 0.05, manganese: 0.02, selenium: 27.6, alcohol: 0, caffeine: 0, theobromine: 0 },
  salmon: { kcal: 206, protein: 22.1, carbs: 0, fat: 12.4, fiber: 0, water: 64.8, sugar: 0, saturated: 2.5, mono: 4.4, poly: 4.5, cholesterol: 63, omega3: 2.55, ala: 0.11, epa: 0.69, dha: 1.46, dpa: 0.29, omega6: 0.66,
    tryptophan: 0.25, threonine: 0.97, isoleucine: 1.02, leucine: 1.8, lysine: 2.03, methionine: 0.65, cystine: 0.24, phenylalanine: 0.86, tyrosine: 0.75, valine: 1.14, arginine: 1.32, histidine: 0.65, alanine: 1.34, aspartic: 2.26, glutamic: 3.3, glycine: 1.06, proline: 0.78, serine: 0.9,
    vitA: 15, vitC: 3.7, vitD: 13.1, thiamin: 0.34, riboflavin: 0.14, niacin: 8, b6: 0.65, folate: 34, b12: 2.8, choline: 95, pantothenic: 1.55,
    calcium: 15, iron: 0.34, magnesium: 30, phosphorus: 252, potassium: 384, sodium: 61, zinc: 0.43, copper: 0.05, manganese: 0.01, selenium: 41.4, alcohol: 0, caffeine: 0 },
  yogurt: { kcal: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fiber: 0, water: 85.1, sugar: 3.24, saturated: 0.12, mono: 0.05, poly: 0.01, cholesterol: 5,
    leucine: 1.03, lysine: 0.87, valine: 0.65, isoleucine: 0.52, threonine: 0.42, phenylalanine: 0.5, methionine: 0.25, tryptophan: 0.14, histidine: 0.25, glutamic: 1.9, proline: 1.05,
    vitA: 1, riboflavin: 0.28, b6: 0.06, b12: 0.75, folate: 7, choline: 15.1, pantothenic: 0.33,
    calcium: 110, magnesium: 11, phosphorus: 135, potassium: 141, sodium: 36, zinc: 0.52, selenium: 9.7, caffeine: 0 },
  banana: { kcal: 89, protein: 1.09, carbs: 22.8, fat: 0.33, fiber: 2.6, water: 74.9, sugar: 12.2, starch: 5.38, sucrose: 2.39, glucose: 4.98, fructose: 4.85, lactose: 0, maltose: 0.01, galactose: 0,
    saturated: 0.11, mono: 0.03, poly: 0.07, cholesterol: 0, omega3: 0.03, omega6: 0.05,
    tryptophan: 0.01, threonine: 0.03, isoleucine: 0.03, leucine: 0.07, lysine: 0.05, histidine: 0.08, valine: 0.05, arginine: 0.05, glutamic: 0.15, aspartic: 0.12,
    vitA: 3, vitC: 8.7, vitE: 0.1, vitK: 0.5, thiamin: 0.03, riboflavin: 0.07, niacin: 0.67, pantothenic: 0.33, b6: 0.37, folate: 20, choline: 9.8,
    calcium: 5, iron: 0.26, magnesium: 27, phosphorus: 22, potassium: 358, sodium: 1, zinc: 0.15, copper: 0.08, manganese: 0.27, selenium: 1, alcohol: 0, caffeine: 0, theobromine: 0 },
  almonds: { kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, water: 4.4, sugar: 4.35, starch: 0.72, sucrose: 3.95, glucose: 0.17, fructose: 0.11, lactose: 0, maltose: 0.04, galactose: 0.07,
    saturated: 3.8, mono: 31.6, poly: 12.3, trans: 0.02, cholesterol: 0, omega6: 12.3,
    tryptophan: 0.21, threonine: 0.6, isoleucine: 0.75, leucine: 1.47, lysine: 0.58, methionine: 0.16, cystine: 0.19, phenylalanine: 1.12, tyrosine: 0.45, valine: 0.86, arginine: 2.45, histidine: 0.56, alanine: 1.03, aspartic: 2.64, glutamic: 6.21, glycine: 1.43, proline: 0.97, serine: 0.95,
    vitE: 25.6, thiamin: 0.21, riboflavin: 1.14, niacin: 3.62, pantothenic: 0.47, b6: 0.14, folate: 44, choline: 52.1,
    calcium: 269, iron: 3.71, magnesium: 270, phosphorus: 481, potassium: 733, sodium: 1, zinc: 3.12, copper: 1.03, manganese: 2.18, selenium: 4.1, caffeine: 0, theobromine: 0 },
  egg: { kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, water: 74.6, sugar: 1.1, saturated: 3.27, mono: 4.08, poly: 1.41, trans: 0.04, cholesterol: 373, omega3: 0.07, dha: 0.04, omega6: 1.19,
    tryptophan: 0.15, threonine: 0.6, isoleucine: 0.69, leucine: 1.08, lysine: 0.91, methionine: 0.39, phenylalanine: 0.67, valine: 0.77, histidine: 0.3, arginine: 0.76, glutamic: 1.64,
    vitA: 149, vitD: 2.2, vitE: 1.03, riboflavin: 0.51, b6: 0.12, folate: 44, b12: 1.11, choline: 294, pantothenic: 1.4,
    calcium: 50, iron: 1.19, magnesium: 10, phosphorus: 172, potassium: 126, sodium: 124, zinc: 1.05, selenium: 30.8 },
  coffee: { kcal: 1, protein: 0.12, carbs: 0, fat: 0.02, water: 99.4, riboflavin: 0.08, niacin: 0.19, magnesium: 3, potassium: 49, sodium: 2, caffeine: 40, theobromine: 0, alcohol: 0 },
  chocolate: { kcal: 598, protein: 7.8, carbs: 45.9, fat: 42.6, fiber: 10.9, water: 1.4, sugar: 24, sucrose: 23.4, lactose: 0, saturated: 24.5, mono: 12.8, poly: 1.26, trans: 0.03, cholesterol: 3,
    vitK: 7.3, vitE: 0.59, iron: 11.9, magnesium: 228, phosphorus: 308, potassium: 715, zinc: 3.31, copper: 1.77, manganese: 1.95, selenium: 6.8, calcium: 73, sodium: 20, caffeine: 80, theobromine: 802 },
  wine: { kcal: 85, protein: 0.07, carbs: 2.6, fat: 0, water: 86.5, sugar: 0.62, glucose: 0.3, fructose: 0.32, alcohol: 10.6, potassium: 127, magnesium: 12, iron: 0.46, sodium: 4, caffeine: 0 },
};
const SERVINGS = {
  chicken: [['1 breast', 172], ['1 cup diced', 140]], salmon: [['1 fillet', 154]], yogurt: [['1 cup', 227], ['1 pot', 170]],
  banana: [['1 medium', 118], ['1 large', 136]], almonds: [['1 handful', 28], ['10 almonds', 12]], egg: [['1 large', 50], ['1 medium', 44]],
  coffee: [['1 cup', 237], ['1 mug', 350]], chocolate: [['1 square', 10], ['1 bar', 100]], wine: [['1 glass', 150]],
  rice: [['1 cup cooked', 158]], apple: [['1 medium', 182]], oats: [['1 bowl', 234]],
};
// ---- Daily targets ------------------------------------------------------------
// Only nutrients with an established reference value get a bar. kind: 'goal' (aim to reach) or 'limit' (stay under).
// Sources: FDA Daily Values (2,000 kcal), IOM Adequate Intakes (omega-3/6, ALA), WHO essential amino-acid
// requirements at 70 kg (individual acids only — methionine/phenylalanine are combined requirements, so no bar).
// Anything absent here (individual sugars, mono/poly, EPA/DHA/DPA, non-essential aminos, water, alcohol,
// theobromine…) shows its value only.
const TARGETS = {
  fiber: { v: 28, kind: 'goal' }, saturated: { v: 20, kind: 'limit' }, cholesterol: { v: 300, kind: 'limit' },
  omega3: { v: 1.6, kind: 'goal' }, ala: { v: 1.6, kind: 'goal' }, omega6: { v: 17, kind: 'goal' },
  histidine: { v: 0.7, kind: 'goal' }, isoleucine: { v: 1.4, kind: 'goal' }, leucine: { v: 2.73, kind: 'goal' }, lysine: { v: 2.1, kind: 'goal' },
  threonine: { v: 1.05, kind: 'goal' }, tryptophan: { v: 0.28, kind: 'goal' }, valine: { v: 1.82, kind: 'goal' },
  sodium: { v: 2300, kind: 'limit' }, caffeine: { v: 400, kind: 'limit' },
};
for (const k in DV) if (!TARGETS[k]) TARGETS[k] = { v: DV[k], kind: 'goal' };
// Full nutrient profile of one logged entry (grams already resolved by the caller).
function profileFor(id, grams, per100) {
  const base = { ...(NUTRITION[id] || {}) };
  if (per100) for (const k of ['kcal', 'protein', 'carbs', 'fat']) if (base[k] == null && per100[k] != null) base[k] = per100[k];
  const f = grams / 100, out = {};
  for (const k in base) if (base[k] != null) out[k] = base[k] * f;
  return out;
}
window.NoraNutrition = { DV, SECTIONS, NUTRITION, SERVINGS, TARGETS, profileFor };
window.NORA_NUTRITION = NUTRITION;
})();
