import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { FoodIcon, foodIllustration } from '@/components/log/food-icon';
import { FoodIconPicker } from '@/components/log/food-icon-picker';
import type { FoodTint } from '@/features/food/food-icons';
import { ArrowRightIcon, ChevronDownIcon, CloseIcon, PencilIcon, TrashIcon } from '@/components/log/icons';
import { Fill, GoodSourceTile, MacroTargetBar, NutrientSectionCard, fmt } from '@/components/log/nutrition-parts';
import { Palette, Scheme, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, trackWide, useColors, useStyles, useTheme } from '@/theme';
import { NutrientFamily, foodColors, useFoodColors } from '@/features/food/theme';
import { Food, Macro, brandAndStore } from '@/features/food/data/mock-data';
import { formatAmount, parseAmount, typedAmount } from '@/features/food/amount';
import { useFoodNutrients } from '@/features/food/hooks/use-food-nutrients';
import { useFoodPortions } from '@/features/food/hooks/use-food-portions';
import { useTargets } from '@/features/food/hooks/use-targets';
import {
  NUTRIENT_SECTIONS,
  NutrientSectionId,
  NutrientValues,
  goodSources,
  nutrientValues,
} from '@/features/food/nutrients';

/** A recipe's own serving: [label, grams], e.g. ["1 serving", 350]. */
export type Serving = [string, number];

/** One unit the amount can be in, and what one of it weighs. */
type UnitOption = { unit: string; label: string; grams: number; estimated?: boolean };

/** Every food can be weighed; its own units (cup, slice…) come after these. */
const WEIGHTS: UnitOption[] = [
  { unit: 'g', label: 'grams', grams: 1 },
  { unit: 'oz', label: 'ounces', grams: 28.35 },
];
/** The most one entry may weigh — the API's limit too (MAX_GRAMS in app/schemas/meal.py). */
const MAX_GRAMS = 5000;
/** How far the footer's text follows the system text size before the row would overflow. */
const FOOTER_TEXT_SCALE = 1.3;
const isWeight = (unit: string) => WEIGHTS.some((w) => w.unit === unit);
/** Kitchen measures come right after the weights, so they're always in the row. */
const KITCHEN_UNITS = ['cup', 'tbsp', 'tsp', 'ml'];
/** The in-app keypad, row by row. "⌫" deletes; " " separates a whole number from a fraction. */
const KEYS = [
  ['1', '2', '3', '/'],
  ['4', '5', '6', ' '],
  ['7', '8', '9', '⌫'],
] as const;

/** Hero wash behind the food's icon, and the icon tile's glow, per tint. */
const HERO: Record<Scheme, Record<FoodTint, [string, string]>> = {
  light: {
    amber: ['#FFF4E4', '#FFDDB0'],
    green: ['#EAF9F0', '#BFEFD2'],
    indigo: ['#EFF0FF', '#D3D8FF'],
    neutral: ['#F3F5F9', '#DDE3EC'],
  },
  dark: {
    amber: ['rgba(227,188,107,0.13)', 'rgba(0,0,0,0.35)'],
    green: ['rgba(127,209,160,0.12)', 'rgba(0,0,0,0.35)'],
    indigo: ['rgba(155,164,242,0.13)', 'rgba(0,0,0,0.35)'],
    neutral: ['rgba(123,132,148,0.12)', 'rgba(0,0,0,0.35)'],
  },
};
const ZERO: Macro = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** `amount` of `unit` ("1.5" "cup"), and the grams that weighs. */
export type FoodDetailsResult = { time: string; amount: number; unit: string; grams: number };

type FoodDetailsScreenProps = {
  food: Food;
  mode: 'add' | 'edit';
  /** "HH:MM" eaten. */
  time: string;
  /** Edit mode: the entry's current weight, and the amount and unit it was logged in. */
  initialGrams?: number;
  initialAmount?: number;
  initialUnit?: string;
  /** Extra servings this food has (recipes: "1 serving", "whole recipe"). */
  servings?: Serving[];
  /** The day so far — in edit mode, excluding this entry. */
  consumed: Macro;
  onClose: () => void;
  onAdd?: (result: FoodDetailsResult) => void;
  onSave?: (result: FoodDetailsResult) => void;
  onDelete?: () => void;
};

/**
 * Full-screen food details (FoodDetailsV3.jsx): compact hero → calories + macros (+ fibre) →
 * impact on your day → good source of → full nutrition. The sticky footer holds the amount box,
 * every unit as a pill (grams, ounces and the food's own: cup, tbsp, slice…) and an in-app
 * keypad with Add log (or Save / Delete when editing), all sized to the screen. Values scale
 * live. It logs at `time`, which the search screen's "Eaten at" sets.
 *
 * Without targets ("log without targets", `useTargets()` null) it shows the food's nutrients and
 * the day's plain totals only: no calorie ring, goal bars, "left", impact against targets or %
 * of daily values.
 *
 * Fibre, vitamins, minerals and the rest come from GET /foods/{id} once the screen opens, so
 * they appear a moment after the macros. Nutrients without data are never shown, and a section
 * left empty disappears — a food known only from its label shows just those values.
 */
export function FoodDetailsScreen({ food, mode, time, initialGrams, initialAmount, initialUnit, servings: extra, consumed, onClose, onAdd, onSave, onDelete }: FoodDetailsScreenProps) {
  const { scheme } = useTheme();
  const { nu } = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // The footer's keys scale with the screen: ~5% of its height, 36 px on a small phone to 44 on a tall one.
  const { height: screenHeight } = useWindowDimensions();
  const keyHeight = Math.round(Math.min(44, Math.max(36, screenHeight * 0.048)));
  const targets = useTargets();
  const { nutrients, servings: foodServings, packageServing, failed: nutrientsFailed, retry: retryNutrients } = useFoodNutrients(food.id);
  const { usual, last } = useFoodPortions(food.id);
  const recipeUnits = useMemo<UnitOption[]>(
    () => (extra ?? []).map(([label, grams]) => ({ unit: label.replace(/^1 /, ''), label, grams })),
    [extra],
  );
  const units = useMemo<UnitOption[]>(() => {
    const kitchen = KITCHEN_UNITS.flatMap((name) => foodServings.filter((u) => u.unit === name));
    const own = foodServings.filter((u) => !KITCHEN_UNITS.includes(u.unit));
    const list = [...WEIGHTS, ...recipeUnits, ...kitchen, ...own];
    // The unit an entry was logged in, or a portion was, stays selectable even when the food's
    // own list doesn't have it (yet, or any more).
    if (initialUnit && initialAmount && initialGrams) list.push({ unit: initialUnit, label: `1 ${initialUnit}`, grams: initialGrams / initialAmount });
    for (const p of [usual, last]) if (p && p.amount > 0) list.push({ unit: p.unit, label: `1 ${p.unit}`, grams: p.grams / p.amount });
    const seen = new Set<string>();
    return list.filter((u) => !seen.has(u.unit) && seen.add(u.unit));
  }, [recipeUnits, foodServings, initialUnit, initialAmount, initialGrams, usual, last]);
  // An entry reopens as it was logged; a recipe starts at one serving; anything else at 100 g.
  const [unitName, setUnitName] = useState(initialUnit ?? recipeUnits[0]?.unit ?? 'g');
  const [qty, setQty] = useState<string>(
    initialUnit && initialAmount ? String(initialAmount) : recipeUnits.length ? '1' : String(Math.round(initialGrams ?? 100)),
  );
  // The keypad folds away to read the page; the amount box and units stay.
  const [keypadOpen, setKeypadOpen] = useState(true);
  // The footer's height, measured: the page leaves exactly that much room under its last card,
  // on any screen and text size, and more while the keyboard lifts the footer.
  const [footerHeight, setFooterHeight] = useState(200);
  const [scrolled, setScrolled] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(false);

  const art = foodIllustration(food.name);
  const { brand, store } = brandAndStore(food);
  const hero = HERO[scheme][art.tint];
  const selected = units.find((u) => u.unit === unitName) ?? WEIGHTS[0];
  const isGrams = selected.unit === 'g';
  const amount = parseAmount(qty);
  const grams = amount * selected.grams;
  const f = grams / 100;
  const values: Macro = {
    kcal: food.per100.kcal * f,
    protein: food.per100.protein * f,
    carbs: food.per100.carbs * f,
    fat: food.per100.fat * f,
  };
  const kcal = Math.round(values.kcal);
  const beforeKcal = Math.max(0, Math.round(consumed.kcal));
  const afterKcal = beforeKcal + kcal;
  const kcalLeft = targets ? targets.kcal - afterKcal : 0;
  const pK = values.protein * 4;
  const cK = values.carbs * 4;
  const fK = values.fat * 9;
  const tK = pK + cK + fK || 1;
  const per100All = useMemo(() => nutrientValues(food.per100, nutrients), [food.per100, nutrients]);
  const all: NutrientValues = Object.fromEntries(Object.entries(per100All).map(([k, v]) => [k, v * f]));
  const sources = goodSources(all);
  const summaries: Partial<Record<NutrientSectionId, string>> = {
    macros: `${fmt(all.protein)} g protein · ${fmt(all.carbs)} g carbs · ${fmt(all.fat)} g fat`,
    sugars: all.sugar != null ? `${fmt(all.sugar)} g total sugars` : undefined,
    fats: `${fmt(all.fat)} g total${all.cholesterol != null ? ` · ${fmt(all.cholesterol)} mg cholesterol` : ''}`,
    minerals: all.sodium != null ? `${fmt(all.sodium)} mg sodium` : undefined,
    other: all.caffeine ? `${fmt(all.caffeine)} mg caffeine` : all.alcohol ? `${fmt(all.alcohol)} g alcohol` : undefined,
  };
  const split: Array<{ f: NutrientFamily; l: string; pct: number }> = [
    { f: 'protein', l: 'protein', pct: Math.round((pK / tK) * 100) },
    { f: 'carbs', l: 'carbs', pct: Math.round((cK / tK) * 100) },
    { f: 'fat', l: 'fat', pct: Math.round((fK / tK) * 100) },
  ];
  const qtyLabel = isGrams ? `${fmt(grams)} g` : `${formatAmount(amount)} ${selected.unit} · ${fmt(grams)} g`;

  // The Portions card's first rows: the package's serving, then what this user usually has and
  // had last time (the last one only when it differs from the usual).
  const sameAs = (a: { amount: number; unit: string }, b: { amount: number; unit: string }) => a.unit === b.unit && Math.abs(a.amount - b.amount) < 0.01;
  const portionButtons = [
    packageServing ? { title: 'Package', label: packageServing.label, amount: packageServing.grams, unit: 'g', grams: packageServing.grams } : null,
    usual ? { title: 'Usual', label: null, ...usual } : null,
    last && !(usual && sameAs(last, usual)) ? { title: 'Last', label: null, ...last } : null,
  ].filter((p): p is { title: string; label: string | null; amount: number; unit: string; grams: number } => p !== null);
  const portionText = (p: { amount: number; unit: string }) => (p.unit === 'g' ? `${fmt(p.amount)} g` : `${formatAmount(p.amount)} ${p.unit}`);
  const applyPortion = (p: { amount: number; unit: string }) => {
    setUnitName(p.unit);
    setQty(p.unit === 'g' ? String(Math.round(p.amount)) : typedAmount(p.amount));
  };

  // An amount past MAX_GRAMS settles on the most it may be, in whatever unit is chosen.
  const changeQty = (text: string) => {
    const most = MAX_GRAMS / selected.grams;
    setQty(parseAmount(text) > most ? String(Math.floor(most * 100) / 100) : text);
  };
  const tooMuch = grams > MAX_GRAMS;
  // One key of the in-app keypad: a digit, ".", "/", a space before a fraction, or ⌫.
  const press = (key: string) => {
    if (key === '⌫') return setQty((q) => q.slice(0, -1));
    if (key === '.' && /[./]/.test(qty.split(' ').pop() ?? '')) return;
    if (key === '/' && (qty.includes('/') || !/\d$/.test(qty))) return;
    if (key === ' ' && (qty.includes(' ') || qty.includes('/') || !/\d$/.test(qty))) return;
    changeQty(qty === '0' && /\d/.test(key) ? key : qty + key);
  };

  // Between grams and ounces the amount converts, so the portion stays the same; a unit like
  // "slice" starts at one.
  const pickUnit = (u: UnitOption) => {
    if (u.unit === selected.unit) return;
    const converted = u.unit === 'g' ? Math.round(grams) : Math.round((grams / u.grams) * 10) / 10;
    setQty(String(isWeight(u.unit) ? converted || (u.unit === 'g' ? 100 : 3.5) : 1));
    setUnitName(u.unit);
  };
  const result = (): FoodDetailsResult => ({
    time,
    // Three decimals, so ⅛ (0.125) and ⅓ (0.333) read back as fractions in the log.
    amount: isGrams ? Math.round(grams) : Math.round(amount * 1000) / 1000,
    unit: selected.unit.slice(0, 40),
    grams: Math.round(grams * 10) / 10,
  });

  return (
    <View style={styles.root}>
      {/* Floating top bar — transparent over the hero, solid once the hero scrolls away */}
      <View style={[styles.topBar, { paddingTop: 10 + insets.top }, scrolled && styles.topBarSolid]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, !scrolled && styles.closeRaised]}>
          <CloseIcon size={16} color={colors.textPrimary} strokeWidth={2.6} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.topTitle, { opacity: scrolled ? 1 : 0 }]}>
          {food.name} · <Text style={{ color: nu.kcal.ink }}>{kcal} kcal</Text>
        </Text>
        <View style={styles.close} />
      </View>

      <ScrollView
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 90)}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: footerHeight + spacing.xl }}>
        {/* Hero — compact: small icon left of the title so the details stay in view */}
        <LinearGradient colors={[hero[0], colors.bgSurfaceSolid]} style={[styles.hero, { paddingTop: 64 + insets.top }]}>
          <View style={styles.heroRow}>
            <Pressable
              onPress={() => setPickingIcon(true)}
              accessibilityRole="button"
              accessibilityLabel={`Change icon for ${food.name}`}
              style={[styles.heroIcon, { boxShadow: `0px 8px 20px ${hero[1]}` }]}>
              <FoodIcon name={food.name} size={56} />
              <View style={styles.heroEdit}>
                <PencilIcon size={11} color={colors.white} strokeWidth={2.6} />
              </View>
            </Pressable>
            <View style={styles.heroText}>
              <Text style={styles.heroName}>
                {food.name}
                {brand ? <Text style={styles.heroBrand}> {brand}</Text> : null}
              </Text>
              <Text style={styles.heroQty}>{[store, qtyLabel].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Calories ring + where the energy comes from + macro bars */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              {targets ? (
                <CalorieRing kcal={kcal} beforePct={(beforeKcal / targets.kcal) * 100} addPct={(kcal / targets.kcal) * 100} />
              ) : (
                <View style={[styles.kcalTile, { backgroundColor: nu.kcal.tint }]}>
                  <Text style={styles.ringKcal}>{kcal.toLocaleString()}</Text>
                  <Text style={styles.ringUnit}>kcal</Text>
                </View>
              )}
              <View style={styles.summaryText}>
                <Text style={styles.overline}>Your day</Text>
                <View style={styles.dayRow}>
                  <Text style={styles.dayBefore}>{beforeKcal.toLocaleString()}</Text>
                  <ArrowRightIcon size={14} color={colors.textTertiary} />
                  <Text style={[styles.dayAfter, kcalLeft < 0 && styles.dayAfterOver]}>{afterKcal.toLocaleString()}</Text>
                </View>
                {targets ? (
                  <Text style={styles.dayOf} numberOfLines={1}>
                    <Text style={styles.dayLeft}>{Math.abs(kcalLeft).toLocaleString()} kcal</Text> {kcalLeft >= 0 ? 'left' : 'over'}
                  </Text>
                ) : (
                  <Text style={styles.dayOf}>kcal eaten today</Text>
                )}
                <View style={styles.splitBar}>
                  {split.map((s) => (
                    <View key={s.f} style={{ flex: s.pct || 0.0001, backgroundColor: nu[s.f].base }} />
                  ))}
                </View>
                <View style={styles.splitLegend}>
                  {split.map((s) => (
                    <Text key={s.f} style={styles.splitText}>
                      <Text style={{ color: nu[s.f].ink, fontFamily: fontFamily.extrabold }}>{s.pct}%</Text> {s.l}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.rule} />
            {targets ? (
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { opacity: 0.35 }]} />
                  <Text style={styles.legendText}>Eaten today</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendSwatch} />
                  <Text style={styles.legendText}>This food</Text>
                </View>
                <Text style={[styles.legendText, styles.legendEnd]}>Full bar = goal</Text>
              </View>
            ) : null}
            <View style={styles.macroBars}>
              <MacroTargetBar family="protein" label="Protein" add={values.protein} before={consumed.protein} goal={targets?.protein ?? null} />
              <MacroTargetBar family="carbs" label="Carbs" add={values.carbs} before={consumed.carbs} goal={targets?.carbs ?? null} />
              <MacroTargetBar family="fat" label="Fat" add={values.fat} before={consumed.fat} goal={targets?.fat ?? null} />
              {/* The log doesn't count fibre eaten yet, so this bar shows the portion alone. */}
              {all.fiber != null ? <MacroTargetBar family="fiber" label="Fiber" add={all.fiber} before={null} goal={targets?.fiber ?? null} /> : null}
            </View>
          </View>

          {/* Impact on your day — eaten → + this portion → new total vs target. Without targets
              the summary card above already has the day's totals. */}
          {targets ? (
            <View style={styles.impactCard}>
              <Text style={styles.impactTitle}>Impact on your day</Text>
              <View style={styles.impactBars}>
                <ImpactBar family="kcal" label="Calories" unit="kcal" eaten={consumed.kcal} add={values.kcal} target={targets.kcal} />
                <ImpactBar family="protein" label="Protein" unit="g" eaten={consumed.protein} add={values.protein} target={targets.protein} />
                <ImpactBar family="carbs" label="Carbs" unit="g" eaten={consumed.carbs} add={values.carbs} target={targets.carbs} />
                <ImpactBar family="fat" label="Fat" unit="g" eaten={consumed.fat} add={values.fat} target={targets.fat} />
              </View>
            </View>
          ) : null}

          {/* Standout vitamins & minerals: at least 10% of the daily value in this portion (a
              percentage of a goal, so not shown without targets) */}
          {targets && sources.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>Good source of</Text>
              <View style={styles.sourceGrid}>
                {sources.map((m) => (
                  <GoodSourceTile key={m.key} label={m.label} pct={m.pct} family={m.family} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Every nutrient with data, by section — Macronutrients open, the rest collapsed */}
          <View>
            <Text style={styles.sectionTitle}>Full nutrition</Text>
            <View style={styles.sections}>
              {NUTRIENT_SECTIONS.map((s) => (
                <NutrientSectionCard key={s.id} section={s} values={all} summary={summaries[s.id]} />
              ))}
            </View>
            {nutrientsFailed ? (
              <Text style={styles.nutritionNote}>
                Couldn&apos;t load vitamins and minerals.{' '}
                <Text onPress={retryNutrients} accessibilityRole="button" style={styles.retry}>
                  Retry
                </Text>
              </Text>
            ) : (
              <Text style={styles.nutritionNote}>
                {targets ? '% DV based on a 2,000 kcal diet. ' : ''}Nutrients without data for this food are not shown.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <FoodIconPicker visible={pickingIcon} name={food.name} onClose={() => setPickingIcon(false)} />

      {/* Sticky footer, after MacroFactor's: the amount in one box (number left, unit right; a tap
          opens the keypad), every unit as a pill, all in view — your portions, then g · oz, then
          the food's own — and an in-app keypad
          with "/" and a space for fractions ("1 1/2"), so no system keyboard covers the page. */}
      <View onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)} style={styles.actions}>
        <View style={{ paddingBottom: 8 + insets.bottom }}>
          <View style={styles.amountRow}>
            <Pressable
              onPress={() => setKeypadOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Amount: ${qty || '0'} ${selected.unit}`}
              accessibilityHint={keypadOpen ? undefined : 'Opens the keypad'}
              style={[styles.amountBox, { height: keyHeight }, keypadOpen && styles.amountBoxActive, tooMuch && styles.amountBoxOver]}>
              <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={[styles.amountValue, !qty && styles.amountEmpty]} numberOfLines={1}>
                {qty || '0'}
              </Text>
              {isGrams ? null : (
                <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={styles.amountGrams} numberOfLines={1}>
                  {selected.estimated ? '≈ ' : ''}
                  {fmt(grams)} g
                </Text>
              )}
              <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={styles.amountUnit} numberOfLines={1}>
                {selected.unit}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setKeypadOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={keypadOpen ? 'Hide keypad' : 'Show keypad'}
              style={[styles.keypadToggle, { height: keyHeight }]}>
              <View style={keypadOpen ? null : styles.flipped}>
                <ChevronDownIcon size={18} color={colors.textSecondary} />
              </View>
            </Pressable>
          </View>

          <View style={styles.pillRow}>
            {portionButtons.map((p) => {
              const on = sameAs({ amount, unit: selected.unit }, p);
              return (
                <Pressable
                  key={p.title}
                  onPress={() => applyPortion(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.title} portion, ${portionText(p)}`}
                  style={[styles.pill, styles.pillPortion, on && styles.pillOn]}>
                  <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={[styles.pillText, on && styles.pillTextOn]}>
                    {p.title} · {portionText(p)}
                  </Text>
                </Pressable>
              );
            })}
            {units.map((u) => {
              const on = u.unit === selected.unit && !portionButtons.some((p) => sameAs({ amount, unit: selected.unit }, p));
              return (
                <Pressable
                  key={u.unit}
                  onPress={() => pickUnit(u)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={isWeight(u.unit) ? u.label : `${u.label}, ${u.estimated ? 'about ' : ''}${fmt(u.grams)} grams`}
                  style={[styles.pill, on && styles.pillOn]}>
                  <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={[styles.pillText, on && styles.pillTextOn]}>
                    {/* An estimated kitchen measure: a typical density, not weighed for this food. */}
                    {u.estimated ? '≈ ' : ''}
                    {u.unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {keypadOpen ? (
            <View style={styles.keypad}>
              {KEYS.map((row) => (
                <View key={row.join('')} style={styles.keyRow}>
                  {row.map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => press(key)}
                      accessibilityRole="button"
                      accessibilityLabel={key === '⌫' ? 'Delete' : key === ' ' ? 'Space' : key === '/' ? 'Fraction' : key}
                      style={({ pressed }) => [styles.key, { height: keyHeight }, /\d/.test(key) ? styles.keyDigit : styles.keyFn, pressed && styles.keyPressed]}>
                      <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={styles.keyText}>
                        {key === ' ' ? '␣' : key}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={styles.keyRow}>
                {(['.', '0'] as const).map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => press(key)}
                    accessibilityRole="button"
                    accessibilityLabel={key === '.' ? 'Decimal point' : key}
                    style={({ pressed }) => [styles.key, { height: keyHeight }, key === '0' ? styles.keyDigit : styles.keyFn, pressed && styles.keyPressed]}>
                    <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={styles.keyText}>
                      {key}
                    </Text>
                  </Pressable>
                ))}
                {mode === 'edit' ? (
                  <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete from log" style={[styles.key, { height: keyHeight }, styles.keyDanger]}>
                    <TrashIcon size={18} color={colors.errorText} />
                  </Pressable>
                ) : (
                  <View style={[styles.key, { height: keyHeight }, styles.keyFn]} accessible accessibilityLabel={`${kcal} kilocalories`}>
                    <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={styles.keyKcal}>
                      {kcal} kcal
                    </Text>
                  </View>
                )}
                <Pressable
                  onPress={() => (mode === 'edit' ? onSave?.(result()) : onAdd?.(result()))}
                  disabled={!grams || tooMuch}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !grams || tooMuch }}
                  style={[styles.key, { height: keyHeight }, styles.keyAdd, (!grams || tooMuch) && styles.disabled]}>
                  <LinearGradient colors={colors.gradConfirm} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
                  <Text maxFontSizeMultiplier={FOOTER_TEXT_SCALE} style={styles.keyAddText}>
                    {mode === 'edit' ? 'Save' : 'Add log'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : mode === 'edit' ? (
            <View style={styles.actionRow}>
              <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete from log" style={styles.delete}>
                <TrashIcon size={18} color={colors.errorText} />
              </Pressable>
              <PrimaryAction label="Save" disabled={!grams || tooMuch} onPress={() => onSave?.(result())} />
            </View>
          ) : (
            <PrimaryAction label="Add log" disabled={!grams || tooMuch} onPress={() => onAdd?.(result())} />
          )}
        </View>
      </View>
    </View>
  );
}

function PrimaryAction({ label, badge, disabled, onPress }: { label: string; badge?: string; disabled?: boolean; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={[styles.primary, disabled && styles.disabled]}>
      <LinearGradient colors={colors.gradConfirm} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
      <Text style={styles.primaryText} numberOfLines={1} maxFontSizeMultiplier={FOOTER_TEXT_SCALE}>
        {label}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={FOOTER_TEXT_SCALE}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CalorieRing({ kcal, beforePct, addPct }: { kcal: number; beforePct: number; addPct: number }) {
  const { nu } = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const size = 124;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const b = Math.max(0, Math.min(1, beforePct / 100));
  const n = Math.max(b, Math.min(1, (beforePct + addPct) / 100));
  const addLen = c * (n - b);
  // Past the day's target the ring turns red — track, what's eaten and this food alike — so
  // going over is unmistakable, as the "… over" beside it says in words.
  const over = beforePct + addPct > 100;
  const track = over ? colors.dangerTint : nu.kcal.tint;
  const eaten = over ? colors.stateError : nu.kcal.base;
  const [from, to] = over ? [colors.stateError, colors.errorText] : colors.gradSuccess;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          {/* This food's share: the Log page's calorie-bar gradient, so kcal looks the same on both. */}
          <SvgGradient id="kcalGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {b > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={eaten}
            strokeOpacity={0.35}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - b)}
          />
        ) : null}
        {addLen > 0.5 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#kcalGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${addLen} ${c}`}
            strokeDashoffset={-c * b}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringKcal}>{kcal.toLocaleString()}</Text>
        <Text style={[styles.ringUnit, over && { color: colors.errorText }]}>kcal</Text>
      </View>
    </View>
  );
}

/**
 * Impact bar: eaten (solid) + this food (lighter, same family) + left (tint), with a target
 * tick. Over target, the scale stretches to the new total so the tick moves left.
 */
function ImpactBar({ family, label, unit, eaten, add, target }: { family: NutrientFamily; label: string; unit: string; eaten: number; add: number; target: number }) {
  const { nu } = useFoodColors();
  const styles = useStyles(makeStyles);
  const total = eaten + add;
  const scale = Math.max(target, total) || 1;
  const over = total - target;
  const n = (v: number) => Math.round(v).toLocaleString();
  return (
    <View>
      <View style={styles.ibHead}>
        <View style={styles.mbLabelRow}>
          <View style={[styles.dot, { backgroundColor: nu[family].base }]} />
          <Text style={styles.ibLabel}>{label}</Text>
        </View>
        <Text>
          <Text style={styles.ibTotal}>{n(total)}</Text>
          <Text style={styles.ibTarget}>
            {' '}
            / {n(target)} {unit}
          </Text>
        </Text>
      </View>
      <Text style={styles.ibSplit}>
        {n(eaten)} <Text style={{ color: nu[family].ink, fontFamily: fontFamily.extrabold }}>+ {n(add)}</Text>
      </Text>
      <View style={styles.ibTrackWrap}>
        <View style={[styles.ibTrack, { backgroundColor: nu[family].tint }]}>
          <Fill pct={(eaten / scale) * 100} color={nu[family].base} />
          <Fill pct={(add / scale) * 100} color={nu[family].base} opacity={0.5} delay />
        </View>
        <View style={[styles.ibTick, { left: `${(target / scale) * 100}%` }]} />
      </View>
      <Text style={[styles.ibFoot, over > 0 && { color: nu[family].ink }]}>
        {over > 0 ? `+${n(over)} ${unit} over target` : `${n(-over)} ${unit} remaining`}
      </Text>
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette, scheme: Scheme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSurfaceSolid },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  topBarSolid: { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  closeRaised: { backgroundColor: colors.bgSurface, boxShadow: colors.shadowSm },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  hero: { paddingHorizontal: spacing.xl, paddingBottom: 46 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  heroEdit: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.bgSurfaceSolid,
    backgroundColor: colors.brandFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0 },
  heroName: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, lineHeight: 25, color: colors.textPrimary, letterSpacing: trackTight(fontSize.h1) },
  heroBrand: { fontFamily: fontFamily.medium, color: colors.textSecondary, letterSpacing: 0 },
  heroQty: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 6 },
  body: { paddingHorizontal: 18, marginTop: -30, gap: spacing.lg },
  summaryCard: {
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: 28,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    boxShadow: '0px 12px 32px rgba(17,24,39,0.08)',
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  summaryText: { flex: 1, minWidth: 0 },
  overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, letterSpacing: trackWide(fontSize.micro), textTransform: 'uppercase' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  dayBefore: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textTertiary, ...num },
  dayAfter: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: foodColors[scheme].nu.kcal.ink, letterSpacing: trackTight(fontSize.h1), ...num },
  dayOf: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 6 },
  dayAfterOver: { color: colors.errorText },
  dayLeft: { fontFamily: fontFamily.bold, color: colors.textPrimary },
  splitBar: { flexDirection: 'row', height: 8, borderRadius: radius.pill, overflow: 'hidden', gap: 2, marginTop: 14, marginBottom: spacing.sm, backgroundColor: foodColors[scheme].nu.other.tint },
  splitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  splitText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  rule: { height: 1, backgroundColor: foodColors[scheme].nu.other.tint, marginTop: 20, marginBottom: 18 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 8, borderRadius: radius.pill, backgroundColor: foodColors[scheme].nu.other.base },
  legendText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  legendEnd: { marginLeft: 'auto' },
  macroBars: { gap: spacing.lg },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  kcalTile: { width: 124, height: 124, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ringKcal: { fontFamily: fontFamily.extrabold, fontSize: 32, color: colors.textPrimary, letterSpacing: trackTight(32), ...num },
  ringUnit: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: foodColors[scheme].nu.kcal.ink, marginTop: 4 },
  mbLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  impactCard: { backgroundColor: colors.bgSurfaceSolid, borderRadius: 26, paddingTop: 18, paddingHorizontal: 18, paddingBottom: spacing.xl, borderWidth: 1, borderColor: colors.borderSubtle },
  impactTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginBottom: 18 },
  impactBars: { gap: 22 },
  ibHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  ibLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  ibTotal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: colors.textPrimary, letterSpacing: trackTight(fontSize.h1), ...num },
  ibTarget: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
  ibSplit: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary, marginBottom: 10, paddingLeft: 18, ...num },
  ibTrackWrap: { height: 14 },
  ibTrack: { ...StyleSheet.absoluteFill, flexDirection: 'row', borderRadius: radius.pill, overflow: 'hidden' },
  ibTick: { position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5, borderRadius: 2, backgroundColor: colors.textPrimary, opacity: 0.75 },
  ibFoot: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 9 },
  sectionTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginTop: 6, marginHorizontal: 2, marginBottom: spacing.md },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  sections: { gap: 10 },
  nutritionNote: { paddingTop: spacing.lg, paddingHorizontal: 4, fontFamily: fontFamily.medium, fontSize: fontSize.micro, lineHeight: 18, color: colors.textTertiary },
  retry: { fontFamily: fontFamily.bold, color: colors.brandPrimary },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingTop: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceMuted,
  },
  amountBoxActive: { borderColor: colors.textPrimary },
  amountBoxOver: { borderColor: colors.errorText },
  amountValue: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: 17, color: colors.textPrimary, ...num },
  amountEmpty: { color: colors.textTertiary },
  amountGrams: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary, ...num },
  amountUnit: { maxWidth: 140, fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  keypadToggle: { width: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  flipped: { transform: [{ rotate: '180deg' }] },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginVertical: 8 },
  pill: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  pillPortion: { borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.bgSurfaceSolid },
  pillOn: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  pillText: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textPrimary, ...num },
  pillTextOn: { color: colors.bgSurfaceSolid },
  keypad: { gap: 5 },
  keyRow: { flexDirection: 'row', gap: 5 },
  key: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  keyDigit: { backgroundColor: colors.bgSurfaceSolid, borderWidth: 1, borderColor: colors.borderSubtle },
  keyFn: { backgroundColor: colors.surfaceMuted },
  keyDanger: { backgroundColor: colors.dangerTint },
  keyPressed: { opacity: 0.6 },
  keyText: { fontFamily: fontFamily.semibold, fontSize: 17, color: colors.textPrimary },
  keyKcal: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: foodColors[scheme].nu.kcal.ink, ...num },
  keyAdd: { boxShadow: colors.glowConfirm },
  keyAddText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.white },
  delete: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  primary: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    boxShadow: colors.glowConfirm,
  },
  disabled: { opacity: 0.5 },
  primaryText: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.white, ...num },
  badge: { flexShrink: 0, paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.white, ...num },
});
