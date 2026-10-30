import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, spacing, trackTight, useStyles } from '@/theme';
import { NutrientFamily, useFoodColors } from '@/features/food/theme';
import type { DailyTargets } from '@/services/api';

const MACROS: { key: Exclude<keyof DailyTargets, 'kcal'>; label: string; family: NutrientFamily }[] = [
  { key: 'protein_g', label: 'Protein', family: 'protein' },
  { key: 'carbs_g', label: 'Carbs', family: 'carbs' },
  { key: 'fat_g', label: 'Fat', family: 'fat' },
  { key: 'fiber_g', label: 'Fiber', family: 'fiber' },
];

/**
 * The user's nutrition plan, read-only: the daily calories and the grams of each macro the
 * whole app measures against. Plans are changed by answering questions again ("Change plan"),
 * never by typing numbers in.
 */
export function PlanCard({ targets }: { targets: DailyTargets }) {
  const { nu } = useFoodColors();
  const styles = useStyles(makeStyles);
  return (
    <Card padding={18}>
      <Text style={styles.overline}>Every day</Text>
      <View style={styles.kcalRow}>
        <Text style={[styles.kcal, { color: nu.kcal.ink }]}>{Math.round(targets.kcal).toLocaleString()}</Text>
        <Text style={styles.kcalUnit}>kcal</Text>
      </View>
      <View style={styles.macros}>
        {MACROS.map(({ key, label, family }) => (
          <View key={key} style={[styles.macro, { backgroundColor: nu[family].tint }]}>
            <Text style={[styles.macroValue, { color: nu[family].ink }]}>
              {Math.round(targets[key])}
              <Text style={styles.macroUnit}> g</Text>
            </Text>
            <Text style={styles.macroLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
    kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.xs },
    kcal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display2, letterSpacing: trackTight(fontSize.display2), ...num },
    kcalUnit: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textTertiary },
    macros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
    macro: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    macroValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, ...num },
    macroUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
    macroLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2 },
  });
