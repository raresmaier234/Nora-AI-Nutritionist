import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';
import { kgFrom } from '@/features/dashboard/stats';
import type { DayTotals } from '@/services/api';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** Each half of the chart, above and below the line. */
const HALF = 42;

/**
 * Eating against burning, this week: for each day logged, how far its calories were under
 * (a bar down, green) or over (a bar up, amber) the plan's estimated daily burn — and in one
 * sentence, what the week adds up to and roughly what that means in body weight.
 */
export function EnergyCard({ week, today, maintenance }: { week: DayTotals[]; today: string; maintenance: number | null }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const router = useRouter();

  if (maintenance === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Energy balance</Text>
        <Text style={styles.body}>See how what you eat compares with what you burn each day. It needs your estimated burn, which comes with a nutrition plan.</Text>
        <Pressable onPress={() => router.navigate('/strategy')} accessibilityRole="button" style={styles.cta}>
          <Text style={styles.ctaText}>Set up your plan</Text>
        </Pressable>
      </View>
    );
  }

  const todayIndex = week.findIndex((d) => d.date === today);
  const balances = week.map((d, i) => (i <= todayIndex && d.entries > 0 ? d.kcal - maintenance : null));
  const counted = balances.filter((b): b is number => b !== null);
  const total = counted.reduce((sum, b) => sum + b, 0);
  const biggest = Math.max(300, ...counted.map(Math.abs));

  const sentence =
    counted.length === 0
      ? 'Log a day to see your balance.'
      : Math.abs(total) < 50
        ? 'So far this week you’ve eaten about what you burned.'
        : total < 0
          ? `So far this week you’ve eaten ${Math.abs(Math.round(total)).toLocaleString()} kcal less than you burned — about ${kgFrom(total)} of fat lost.`
          : `So far this week you’ve eaten ${Math.round(total).toLocaleString()} kcal more than you burned — about ${kgFrom(total)} gained.`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Energy balance</Text>
      <Text style={styles.subtitle}>Eaten vs. burned (~{maintenance.toLocaleString()} kcal a day, from your plan)</Text>

      <View style={styles.chart} accessible accessibilityLabel={sentence}>
        <View style={styles.zero} />
        {week.map((d, i) => {
          const b = balances[i];
          const h = b === null ? 0 : Math.max(3, (Math.abs(b) / biggest) * HALF);
          return (
            <View key={d.date} style={styles.col}>
              <View style={styles.upper}>{b !== null && b > 0 ? <View style={[styles.bar, styles.barUp, { height: h, backgroundColor: colors.amberText }]} /> : null}</View>
              <View style={styles.lower}>{b !== null && b <= 0 ? <View style={[styles.bar, styles.barDown, { height: h, backgroundColor: colors.successFill }]} /> : null}</View>
              <Text style={[styles.day, i === todayIndex && styles.dayToday]}>{DAY_LETTERS[i]}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.successFill }]} />
        <Text style={styles.legendText}>Under your burn</Text>
        <View style={[styles.legendDot, { backgroundColor: colors.amberText }]} />
        <Text style={styles.legendText}>Over</Text>
      </View>

      <Text style={styles.body}>{sentence}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.bgSurfaceSolid, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.borderSubtle },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary },
    subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 3 },
    chart: { flexDirection: 'row', marginTop: spacing.lg },
    zero: { position: 'absolute', left: 0, right: 0, top: HALF, height: 1, backgroundColor: colors.borderStrong },
    col: { flex: 1, alignItems: 'center' },
    upper: { height: HALF, justifyContent: 'flex-end' },
    lower: { height: HALF, justifyContent: 'flex-start' },
    bar: { width: 16 },
    barUp: { borderTopLeftRadius: 5, borderTopRightRadius: 5 },
    barDown: { borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
    day: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 6 },
    dayToday: { color: colors.textPrimary, fontFamily: fontFamily.extrabold },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'center' },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
    legendText: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textSecondary },
    body: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary, marginTop: spacing.md },
    cta: { alignSelf: 'flex-start', marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.brandFill },
    ctaText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textOnBrand },
  });
