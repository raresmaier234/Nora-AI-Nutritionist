import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { FoodIcon, foodIllustration } from '@/components/log/food-icon';
import { FoodIconPicker } from '@/components/log/food-icon-picker';
import type { FoodTint } from '@/features/food/food-icons';
import { ArrowRightIcon, CloseIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon } from '@/components/log/icons';
import { Fill, GoodSourceTile, MacroTargetBar, NutrientSectionCard, fmt } from '@/components/log/nutrition-parts';
import { WhenPicker } from '@/components/log/when-picker';
import { Palette, Scheme, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, trackWide, useColors, useStyles, useTheme } from '@/theme';
import { NutrientFamily, foodColors, useFoodColors } from '@/features/food/theme';
import { Food, Macro, TARGETS } from '@/features/food/data/mock-data';
import { useFoodNutrients } from '@/features/food/hooks/use-food-nutrients';
import {
  NUTRIENT_SECTIONS,
  NUTRIENT_TARGETS,
  NutrientSectionId,
  NutrientValues,
  goodSources,
  nutrientValues,
} from '@/features/food/nutrients';

/** Grams, then 100 g, then the food's own servings: [label, grams]. */
export type Serving = [string, number];

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

export type FoodDetailsResult = { time: string; amount: number; unit: string };

type FoodDetailsScreenProps = {
  food: Food;
  mode: 'add' | 'edit';
  /** "HH:MM" eaten. */
  time: string;
  /** Edit mode: the entry's current weight. */
  initialGrams?: number;
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
 * serving and quantity → impact on your day → good source of → full nutrition → sticky Add to
 * Log (or Save / Delete when editing). Values scale live with the quantity.
 *
 * Fibre, vitamins, minerals and the rest come from GET /foods/{id} once the screen opens, so
 * they appear a moment after the macros. Nutrients without data are never shown, and a section
 * left empty disappears — a food known only from its label shows just those values.
 */
export function FoodDetailsScreen({ food, mode, time: initialTime, initialGrams, servings: extra, consumed, onClose, onAdd, onSave, onDelete }: FoodDetailsScreenProps) {
  const { scheme } = useTheme();
  const { nu } = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const servings = useMemo<Serving[]>(() => [['g', 1], ['100 g', 100], ...(extra ?? [])], [extra]);
  const startIdx = initialGrams || !extra?.length ? 0 : 2;
  const [servingIdx, setServingIdx] = useState(startIdx);
  const [qty, setQty] = useState<string>(String(startIdx === 0 ? Math.round(initialGrams ?? 100) : 1));
  const [time, setTime] = useState(initialTime);
  const [scrolled, setScrolled] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(false);

  const art = foodIllustration(food.name);
  const hero = HERO[scheme][art.tint];
  const [servingLabel, servingGrams] = servings[servingIdx];
  const isGrams = servingIdx === 0;
  const step = isGrams ? 10 : 0.5;
  const grams = Math.max(0, (Number(qty) || 0) * servingGrams);
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
  const kcalLeft = TARGETS.kcal - afterKcal;
  const pK = values.protein * 4;
  const cK = values.carbs * 4;
  const fK = values.fat * 9;
  const tK = pK + cK + fK || 1;
  const { nutrients, failed: nutrientsFailed, retry: retryNutrients } = useFoodNutrients(food.id);
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
  // A gram-based unit ("100 g") is shown as plain grams — never "1 × 100 g · 100 g".
  const unitIsGrams = isGrams || /^\d+(\.\d+)?\s*g$/i.test(servingLabel);
  const unitName = servingLabel.replace(/^1 /, '');
  const qtyLabel = unitIsGrams
    ? `${fmt(grams)} g`
    : `${Number(qty) === 1 ? servingLabel : `${qty} × ${unitName}`} · ${fmt(grams)} g`;

  const pickServing = (i: number) => {
    if (i === 1) {
      setServingIdx(0);
      setQty('100');
      return;
    }
    setQty(String(i === 0 ? Math.round(grams) || 100 : 1));
    setServingIdx(i);
  };
  const stepQty = (dir: 1 | -1) => setQty((q) => String(Math.max(0, Math.round(((Number(q) || 0) + dir * step) * 10) / 10)));
  const result = (): FoodDetailsResult => ({ time, amount: Math.round(grams), unit: 'g' });

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
        contentContainerStyle={{ paddingBottom: 220 + insets.bottom }}>
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
              <Text style={styles.heroName}>{food.name}</Text>
              <Text style={styles.heroQty}>{qtyLabel}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Calories ring + where the energy comes from + macro bars */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <CalorieRing kcal={kcal} beforePct={(beforeKcal / TARGETS.kcal) * 100} addPct={(kcal / TARGETS.kcal) * 100} />
              <View style={styles.summaryText}>
                <Text style={styles.overline}>Your day</Text>
                <View style={styles.dayRow}>
                  <Text style={styles.dayBefore}>{beforeKcal.toLocaleString()}</Text>
                  <ArrowRightIcon size={14} color={colors.textTertiary} />
                  <Text style={styles.dayAfter}>{afterKcal.toLocaleString()}</Text>
                </View>
                <Text style={styles.dayOf}>
                  of {TARGETS.kcal.toLocaleString()} kcal ·{' '}
                  {kcalLeft >= 0 ? (
                    <Text style={styles.dayLeft}>{kcalLeft.toLocaleString()} left</Text>
                  ) : (
                    <Text style={styles.dayOver}>{(-kcalLeft).toLocaleString()} over</Text>
                  )}
                </Text>
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
            <View style={styles.macroBars}>
              <MacroTargetBar family="protein" label="Protein" add={values.protein} before={consumed.protein} goal={TARGETS.protein} />
              <MacroTargetBar family="carbs" label="Carbs" add={values.carbs} before={consumed.carbs} goal={TARGETS.carbs} />
              <MacroTargetBar family="fat" label="Fat" add={values.fat} before={consumed.fat} goal={TARGETS.fat} />
              {/* The log doesn't count fibre eaten yet, so this bar shows the portion alone. */}
              {all.fiber != null ? <MacroTargetBar family="fiber" label="Fiber" add={all.fiber} before={null} goal={NUTRIENT_TARGETS.fiber.value} /> : null}
            </View>
          </View>

          {/* Quantity — serving + thumb-sized stepper */}
          <View style={styles.qtyCard}>
            <Text style={styles.qtyLabel}>Serving size</Text>
            <View style={styles.chips}>
              {servings.map(([label, g], i) => {
                const on = i === 1 ? isGrams && Number(qty) === 100 : i === 0 ? isGrams && Number(qty) !== 100 : i === servingIdx;
                return (
                  <Pressable
                    key={label}
                    onPress={() => pickServing(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
                    {on ? <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} /> : null}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {label}
                      {i > 1 ? <Text style={[styles.chipGrams, on && styles.chipTextOn]}> · {g} g</Text> : null}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable onPress={() => stepQty(-1)} accessibilityRole="button" accessibilityLabel="Decrease" style={[styles.stepButton, styles.stepMinus]}>
                <MinusIcon size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.qtyField}>
                <TextInput
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Quantity"
                  style={styles.qtyInput}
                />
                <Text style={styles.qtyUnit}>{isGrams ? 'g' : unitIsGrams ? `× ${servingLabel}` : unitName}</Text>
              </View>
              <Pressable onPress={() => stepQty(1)} accessibilityRole="button" accessibilityLabel="Increase" style={[styles.stepButton, styles.stepPlus]}>
                <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
                <PlusIcon size={20} color={colors.white} strokeWidth={2.6} />
              </Pressable>
            </View>
            <View style={styles.forWrap}>
              <Text style={styles.forText}>
                All values are for <Text style={styles.forGrams}>{fmt(grams)} g</Text>
              </Text>
            </View>
          </View>

          {/* Impact on your day — eaten → + this portion → new total vs target */}
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>Impact on your day</Text>
            <View style={styles.impactBars}>
              <ImpactBar family="kcal" label="Calories" unit="kcal" eaten={consumed.kcal} add={values.kcal} target={TARGETS.kcal} />
              <ImpactBar family="protein" label="Protein" unit="g" eaten={consumed.protein} add={values.protein} target={TARGETS.protein} />
              <ImpactBar family="carbs" label="Carbs" unit="g" eaten={consumed.carbs} add={values.carbs} target={TARGETS.carbs} />
              <ImpactBar family="fat" label="Fat" unit="g" eaten={consumed.fat} add={values.fat} target={TARGETS.fat} />
            </View>
          </View>

          {/* Standout vitamins & minerals: at least 10% of the daily value in this portion */}
          {sources.length > 0 ? (
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
              <Text style={styles.nutritionNote}>% DV based on a 2,000 kcal diet. Nutrients without data for this food are not shown.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <FoodIconPicker visible={pickingIcon} name={food.name} onClose={() => setPickingIcon(false)} />

      {/* Sticky action area — always reachable, clears the home indicator */}
      <View style={[styles.actions, { paddingBottom: 14 + insets.bottom }]}>
        <WhenPicker value={time} onChange={setTime} label="Eaten at" compact />
        {mode === 'edit' ? (
          <View style={styles.actionRow}>
            <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete from log" style={styles.delete}>
              <TrashIcon size={20} color={colors.errorText} />
            </Pressable>
            <PrimaryAction label={`Save changes · ${kcal} kcal`} disabled={!grams} onPress={() => onSave?.(result())} />
          </View>
        ) : (
          <PrimaryAction label="Add to Log" badge={`${kcal} kcal`} disabled={!grams} onPress={() => onAdd?.(result())} />
        )}
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
      <Text style={styles.primaryText}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CalorieRing({ kcal, beforePct, addPct }: { kcal: number; beforePct: number; addPct: number }) {
  const { nu } = useFoodColors();
  const styles = useStyles(makeStyles);
  const size = 124;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const b = Math.max(0, Math.min(1, beforePct / 100));
  const n = Math.max(b, Math.min(1, (beforePct + addPct) / 100));
  const addLen = c * (n - b);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="kcalGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFA37F" />
            <Stop offset="100%" stopColor="#F25C3B" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={nu.kcal.tint} strokeWidth={stroke} />
        {b > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={nu.kcal.base}
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
        <Text style={styles.ringUnit}>kcal</Text>
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
  dayLeft: { fontFamily: fontFamily.bold, color: colors.textPrimary },
  dayOver: { fontFamily: fontFamily.extrabold, color: colors.errorText },
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
  ringKcal: { fontFamily: fontFamily.extrabold, fontSize: 32, color: colors.textPrimary, letterSpacing: trackTight(32), ...num },
  ringUnit: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: foodColors[scheme].nu.kcal.ink, marginTop: 4 },
  mbLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  qtyCard: { backgroundColor: colors.bgSurfaceSolid, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.borderSubtle },
  qtyLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textSecondary, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 18 },
  chip: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipOn: { boxShadow: '0px 6px 14px rgba(99,102,241,0.28)' },
  chipOff: { borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceMuted },
  chipText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  chipTextOn: { color: colors.white },
  chipGrams: { fontFamily: fontFamily.medium, color: colors.textTertiary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  stepMinus: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderSubtle },
  stepPlus: { boxShadow: colors.glowPrimary },
  qtyField: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  qtyInput: { minWidth: 56, maxWidth: 110, textAlign: 'right', fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: colors.textPrimary, padding: 0, ...num },
  qtyUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textTertiary },
  forWrap: { alignItems: 'center', marginTop: 14 },
  forText: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  forGrams: { fontFamily: fontFamily.extrabold, color: colors.textPrimary },
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  delete: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  primary: {
    flex: 1,
    height: 56,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    boxShadow: colors.glowConfirm,
  },
  disabled: { opacity: 0.5 },
  primaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.white, ...num },
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.white, ...num },
});
