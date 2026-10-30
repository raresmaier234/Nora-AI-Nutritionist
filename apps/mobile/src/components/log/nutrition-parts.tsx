import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ChevronRightIcon, NutrientSectionIcon } from '@/components/log/icons';
import { Palette, Scheme, fontFamily, fontSize, motion, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';
import { NutrientFamily, foodColors, useFoodColors } from '@/features/food/theme';
import { useTargets } from '@/features/food/hooks/use-targets';
import { NutrientRow, NutrientSection, NutrientSectionId, NutrientValues, nutrientTarget } from '@/features/food/nutrients';

/*
 * Nutrition building blocks shared by Food Details (one portion) and Day Nutrition (the whole
 * day): target bars, "Good source of" tiles and the collapsible "Full nutrition" sections, from
 * FoodDetailsV3.jsx.
 */

/** A nutrient amount for display: "<0.1" for traces, one decimal under 10, whole above. */
export const fmt = (v: number) => {
  if (v === 0) return '0';
  if (v < 0.1) return '<0.1';
  if (v < 10) return String(Math.round(v * 10) / 10);
  return Math.round(v).toLocaleString();
};

/** A bar that grows to `pct` (0–100) on mount and follows changes. */
export function Fill({ pct, color, opacity = 1, delay = false }: { pct: number; color: string; opacity?: number; delay?: boolean }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, pct)), { duration: motion.slow + (delay ? 120 : 0) });
  }, [pct, w, delay]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[{ height: '100%', backgroundColor: color, opacity }, style]} />;
}

/**
 * Daily target bar: full width = daily goal. Faded = eaten today, solid = this food. With no
 * `before` (a nutrient the log doesn't count), it shows this food's share of the goal alone.
 */
export function MacroTargetBar({ family, label, add, before, goal }: { family: NutrientFamily; label: string; add: number; before: number | null; goal: number }) {
  const { nu } = useFoodColors();
  const styles = useStyles(makeStyles);
  const hasDay = before !== null;
  const b = Math.max(0, before ?? 0);
  const a = Math.max(0, add);
  const total = b + a;
  const bPct = Math.min(100, (b / goal) * 100);
  const nPct = Math.min(100, (total / goal) * 100);
  const aPct = a > 0 ? Math.max(nPct - bPct, bPct >= 100 ? 0 : 2) : 0;
  const left = goal - total;
  return (
    <View>
      <View style={styles.mbHead}>
        <View style={styles.mbLabelRow}>
          <View style={[styles.dot, { backgroundColor: nu[family].base }]} />
          <Text style={styles.mbLabel}>{label}</Text>
        </View>
        <Text style={[styles.mbValue, { color: nu[family].ink }]}>
          {hasDay ? '+' : ''}
          {fmt(a)}
          <Text style={styles.mbUnit}> g</Text>
        </Text>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={hasDay ? `${label}: ${fmt(b)} g eaten, plus ${fmt(a)} g, ${fmt(total)} of ${goal} g target` : `${label}: ${fmt(a)} of ${goal} g target`}
        style={[styles.mbTrack, { backgroundColor: nu[family].tint, gap: b > 0 && a > 0 && bPct < 100 ? 2 : 0 }]}>
        <Fill pct={bPct} color={nu[family].base} opacity={0.35} />
        <Fill pct={aPct} color={nu[family].base} delay />
      </View>
      <View style={styles.mbFoot}>
        <Text style={styles.mbFootText}>
          {hasDay ? `${fmt(b)} → ` : ''}
          <Text style={styles.strong}>{fmt(total)}</Text> of {goal} g
        </Text>
        {left >= 0 ? (
          <Text style={[styles.mbFootText, styles.mbLeft]}>{fmt(left)} g left</Text>
        ) : (
          <Text style={[styles.mbFootText, styles.mbOver]}>{fmt(-left)} g over</Text>
        )}
      </View>
    </View>
  );
}

/** One "Good source of" tile: % of the daily value in this portion, with a small bar. */
export function GoodSourceTile({ label, pct, family }: { label: string; pct: number; family: NutrientFamily }) {
  const { nu } = useFoodColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.sourceTile, { backgroundColor: nu[family].tint }]}>
      <Text style={[styles.sourcePct, { color: nu[family].ink }]}>{pct}%</Text>
      <Text style={styles.sourceLabel}>{label}</Text>
      <View style={styles.sourceTrack}>
        <Fill pct={pct} color={nu[family].base} />
      </View>
    </View>
  );
}

/** Each section's colour and glyph (FD_SECTION_META). */
const SECTION_FAMILY: Record<NutrientSectionId, NutrientFamily> = {
  macros: 'kcal',
  sugars: 'carbs',
  fats: 'fat',
  amino: 'protein',
  vitamins: 'vitamin',
  minerals: 'mineral',
  other: 'other',
};

/**
 * A collapsible "Full nutrition" card. Only rows with data are listed; with none, it's not shown.
 * Opens as the section says unless `defaultOpen` is given.
 */
export function NutrientSectionCard({ section, values, summary, defaultOpen }: { section: NutrientSection; values: NutrientValues; summary?: string; defaultOpen?: boolean }) {
  const { nu } = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(defaultOpen ?? !!section.open);
  const rows = section.rows.filter((r) => values[r.key] != null);
  if (!rows.length) return null;
  const family = SECTION_FAMILY[section.id];
  return (
    <View style={styles.sectionCard}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: nu[family].tint }]}>
          <NutrientSectionIcon section={section.id} color={nu[family].ink} />
        </View>
        <View style={styles.sectionText}>
          <Text style={styles.sectionLabel}>{section.label}</Text>
          <Text style={styles.sectionSummary}>{summary ?? `${rows.length} nutrients`}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <ChevronRightIcon size={20} color={colors.textTertiary} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.sectionRows}>
          {rows.map((r, i) => (
            <View key={r.key}>
              {r.group ? <Text style={[styles.rowGroup, { color: nu[family].ink }]}>{r.group}</Text> : null}
              <NutrientRowView row={r} value={values[r.key]} family={family} first={i === 0 || !!r.group} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One nutrient. With a daily target it gets a compact bar — this portion against the target —
 * otherwise just its value. Only a limit turns red when passed; passing a goal (346% of vitamin
 * K) is good news, so it reads "goal reached".
 */
function NutrientRowView({ row, value, family, first }: { row: NutrientRow; value: number; family: NutrientFamily; first: boolean }) {
  const { nu } = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const targets = useTargets();
  const target = nutrientTarget(row.key, targets);
  const label = <Text style={[styles.rowLabel, row.sub && styles.rowLabelSub]}>{row.label}</Text>;
  if (!target) {
    return (
      <View style={[styles.rowPlain, row.sub && styles.rowSub, !first && styles.rowBorder]}>
        {label}
        <Text>
          <Text style={styles.rowValue}>{fmt(value)}</Text>
          <Text style={styles.rowUnit}> {row.unit}</Text>
        </Text>
      </View>
    );
  }
  const limit = target.kind === 'limit';
  const left = target.value - value;
  const overLimit = limit && left < 0;
  const pct = (value / target.value) * 100;
  return (
    <View style={[styles.rowTarget, row.sub && styles.rowSub, !first && styles.rowBorder]}>
      <View style={styles.rowHead}>
        {label}
        <Text style={[styles.rowAmount, { color: nu[family].ink }]}>
          {fmt(value)} {row.unit}
        </Text>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={`${row.label}: ${fmt(value)} of ${fmt(target.value)} ${row.unit} ${limit ? 'limit' : 'target'}`}
        style={[styles.rowTrack, { backgroundColor: nu[family].tint }]}>
        <Fill pct={value > 0 ? Math.max(pct, 1.5) : 0} color={overLimit ? colors.errorText : nu[family].base} />
      </View>
      <View style={styles.mbFoot}>
        <Text style={styles.mbFootText}>
          <Text style={styles.strong}>{fmt(value)}</Text> / {fmt(target.value)} {row.unit}
          {limit ? ' limit' : ''}
        </Text>
        {left >= 0 ? (
          <Text style={[styles.mbFootText, styles.mbLeft]}>
            {fmt(left)} {row.unit} left
          </Text>
        ) : overLimit ? (
          <Text style={[styles.mbFootText, styles.mbOver]}>
            {fmt(-left)} {row.unit} over
          </Text>
        ) : (
          <Text style={[styles.mbFootText, styles.mbLeft, { color: nu[family].ink }]}>Goal reached</Text>
        )}
      </View>
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette, scheme: Scheme) => StyleSheet.create({
  mbHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  mbLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  mbLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textPrimary },
  mbValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, letterSpacing: trackTight(fontSize.h2), ...num },
  mbUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
  mbTrack: { flexDirection: 'row', height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  mbFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, marginTop: 7 },
  mbFootText: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, ...num },
  strong: { fontFamily: fontFamily.extrabold, color: colors.textPrimary },
  mbLeft: { fontFamily: fontFamily.bold, color: colors.textSecondary },
  mbOver: { fontFamily: fontFamily.extrabold, color: colors.errorText },
  sourceTile: { width: '48.5%', borderRadius: 20, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 13 },
  sourcePct: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, letterSpacing: trackTight(fontSize.h1), ...num },
  sourceLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, lineHeight: 17, color: colors.textPrimary, marginTop: 6 },
  sourceTrack: {
    height: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: 10,
    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)',
  },
  sectionCard: { backgroundColor: colors.bgSurfaceSolid, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden' },
  sectionHead: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: spacing.lg },
  sectionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sectionText: { flex: 1, minWidth: 0 },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  sectionSummary: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 4, ...num },
  sectionRows: { paddingHorizontal: spacing.lg, paddingBottom: 10 },
  rowGroup: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, letterSpacing: trackWide(fontSize.micro), textTransform: 'uppercase', paddingTop: 14, paddingBottom: 6 },
  rowPlain: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTarget: { paddingVertical: spacing.md },
  rowSub: { paddingLeft: spacing.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: foodColors[scheme].nu.other.tint },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textPrimary },
  rowLabelSub: { fontFamily: fontFamily.medium, color: colors.textSecondary },
  rowValue: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary, ...num },
  rowUnit: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  rowAmount: { flexShrink: 0, fontFamily: fontFamily.extrabold, fontSize: fontSize.small, ...num },
  rowTrack: { flexDirection: 'row', height: 8, borderRadius: radius.pill, overflow: 'hidden', marginTop: 9, marginBottom: 0 },
});
