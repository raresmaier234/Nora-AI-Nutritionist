import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';
import { NutrientFamily, useFoodColors } from '@/features/food/theme';
import { Targets } from '@/features/food/data/mock-data';
import { isOnTarget } from '@/features/dashboard/stats';
import type { DayTotals } from '@/services/api';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROWS: { key: 'kcal' | 'protein' | 'carbs' | 'fat'; family: NutrientFamily; unit: string; short: string }[] = [
  { key: 'kcal', family: 'kcal', unit: 'kcal', short: 'kcal' },
  { key: 'protein', family: 'protein', unit: 'g', short: 'protein' },
  { key: 'carbs', family: 'carbs', unit: 'g', short: 'carbs' },
  { key: 'fat', family: 'fat', unit: 'g', short: 'fat' },
];
const BAR_HEIGHT = 34;

/**
 * This week at a glance: a bar for each day's calories, protein, carbs and fat against the daily
 * target — tap a day for its numbers beside the grid, or Week for the week's totals. "Left"
 * shows what's still to eat instead. Below, in words: how many days landed on target.
 */
export function WeekCard({ week, today, targets }: { week: DayTotals[]; today: string; targets: Targets | null }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const { nu } = useFoodColors();
  const todayIndex = Math.max(0, week.findIndex((d) => d.date === today));
  const [selected, setSelected] = useState<number | 'week'>(todayIndex);
  const [mode, setMode] = useState<'eaten' | 'left'>('eaten');
  const showLeft = mode === 'left' && targets !== null;

  // Without targets the bars compare the days with each other: the week's highest is full.
  const scale = (key: (typeof ROWS)[number]['key']) => targets?.[key] ?? Math.max(1, ...week.map((d) => d[key]));
  const past = (i: number) => i <= todayIndex;

  const summary = (key: (typeof ROWS)[number]['key']) => {
    const days = selected === 'week' ? week : [week[selected]];
    const eaten = days.reduce((sum, d) => sum + d[key], 0);
    const goal = targets ? targets[key] * days.length : null;
    return { eaten: Math.round(eaten), goal: goal === null ? null : Math.round(goal) };
  };

  const logged = week.filter((d, i) => past(i) && d.entries > 0);
  const onTarget = targets ? logged.filter((d) => isOnTarget(d.kcal, targets.kcal)).length : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>This week</Text>
      <View style={styles.body}>
        <View style={styles.grid}>
          {ROWS.map((row, r) => (
            <View key={row.key} style={[styles.gridRow, r > 0 && styles.rowDivider]}>
              {week.map((d, i) => {
                const target = scale(row.key);
                const eaten = d[row.key];
                const share = showLeft ? Math.max(0, target - eaten) / target : Math.min(1, eaten / target);
                const over = !showLeft && targets !== null && eaten > target * 1.1;
                return (
                  <Pressable key={d.date} onPress={() => setSelected(i)} accessibilityRole="button" style={styles.cell}>
                    <View style={[styles.track, !past(i) && styles.trackFuture]}>
                      {past(i) && share > 0 ? (
                        <View style={[styles.fill, { height: `${share * 100}%`, backgroundColor: nu[row.family].base }]} />
                      ) : null}
                      {over ? <View style={[styles.overCap, { backgroundColor: colors.errorText }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={styles.gridRow}>
            {week.map((d, i) => (
              <Pressable
                key={d.date}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === i }}
                accessibilityLabel={`Show ${d.date}`}
                style={styles.cell}>
                <Text style={[styles.dayLetter, i === todayIndex && styles.dayToday, selected === i && styles.daySelected]}>{DAY_LETTERS[i]}</Text>
              </Pressable>
            ))}
          </View>
          {/* The chosen day, outlined across the whole column */}
          {selected !== 'week' ? <View pointerEvents="none" style={[styles.outline, { left: `${(selected / 7) * 100}%` }]} /> : null}
        </View>

        <View style={styles.side}>
          {ROWS.map((row, r) => {
            const { eaten, goal } = summary(row.key);
            const value = showLeft && goal !== null ? Math.max(0, goal - eaten) : eaten;
            return (
              <View key={row.key} style={[styles.sideCell, r > 0 && styles.sideDivider]}>
                <Text style={[styles.sideValue, { color: nu[row.family].ink }]} numberOfLines={1}>
                  {value.toLocaleString()}
                  <Text style={styles.sideUnit}> {row.key === 'kcal' ? 'kcal' : `g ${row.short[0].toUpperCase()}`}</Text>
                </Text>
                <Text style={styles.sideOf} numberOfLines={1}>
                  {goal !== null ? `${showLeft ? 'left of' : 'of'} ${goal.toLocaleString()}` : row.short}
                </Text>
              </View>
            );
          })}
          <Pressable
            onPress={() => setSelected('week')}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === 'week' }}
            style={[styles.weekChip, selected === 'week' && styles.weekChipOn]}>
            <Text style={[styles.weekChipText, selected === 'week' && styles.weekChipTextOn]}>Week</Text>
          </Pressable>
        </View>
      </View>

      {targets ? (
        <View style={styles.toggle} accessibilityRole="tablist">
          {(
            [
              ['eaten', 'Eaten'],
              ['left', 'Left'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setMode(key)} accessibilityRole="tab" accessibilityState={{ selected: mode === key }} style={[styles.toggleItem, mode === key && styles.toggleOn]}>
              <Text style={[styles.toggleText, mode === key && styles.toggleTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.note}>
        {logged.length === 0
          ? 'Nothing logged yet this week.'
          : targets
            ? `On target ${onTarget} of ${logged.length} day${logged.length === 1 ? '' : 's'} so far (within 10% of your calories).`
            : `Logged ${logged.length} of ${todayIndex + 1} days so far.`}
      </Text>
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.bgSurfaceSolid, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.borderSubtle },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginBottom: spacing.md },
    body: { flexDirection: 'row', gap: spacing.md },
    grid: { flex: 1 },
    gridRow: { flexDirection: 'row', paddingVertical: 5 },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
    cell: { flex: 1, alignItems: 'center' },
    track: { width: 14, height: BAR_HEIGHT, borderRadius: 5, backgroundColor: colors.trackEmpty, overflow: 'hidden', justifyContent: 'flex-end' },
    trackFuture: { opacity: 0.45 },
    fill: { width: '100%', borderRadius: 5 },
    overCap: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    dayLetter: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
    dayToday: { color: colors.textPrimary, fontFamily: fontFamily.extrabold },
    daySelected: { color: colors.brandPrimary },
    outline: { position: 'absolute', top: -4, bottom: -2, width: `${100 / 7}%`, borderRadius: 12, borderWidth: 2, borderColor: colors.brandPrimary },
    side: { width: 92 },
    sideCell: { height: BAR_HEIGHT + 10, justifyContent: 'center' },
    sideDivider: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
    sideValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.body, ...num },
    sideUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro },
    sideOf: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, ...num },
    weekChip: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    weekChipOn: { backgroundColor: colors.brandPrimary },
    weekChipText: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textSecondary },
    weekChipTextOn: { color: colors.white },
    toggle: { flexDirection: 'row', alignSelf: 'center', marginTop: spacing.lg, padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    toggleItem: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: radius.pill },
    toggleOn: { backgroundColor: colors.bgSurfaceSolid, boxShadow: colors.shadowSm },
    toggleText: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textSecondary },
    toggleTextOn: { color: colors.textPrimary, fontFamily: fontFamily.bold },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  });
