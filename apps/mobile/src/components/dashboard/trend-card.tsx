import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Palette, fontFamily, fontSize, spacing, useColors, useStyles } from '@/theme';
import { useFoodColors } from '@/features/food/theme';
import { isOnTarget } from '@/features/dashboard/stats';
import type { DayTotals } from '@/services/api';

const CHART_HEIGHT = 96;
const PAD = 8;

const shortDate = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`;
};

/**
 * Calories over the last two weeks: a line through each logged day, the daily target as a
 * dashed line, and in words the average and how many days landed on target. Days with nothing
 * logged are left out rather than drawn as zero.
 */
export function TrendCard({ days, target }: { days: DayTotals[]; target: number | null }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const { nu } = useFoodColors();
  const [width, setWidth] = useState(0);

  const logged = days.map((d, i) => ({ ...d, i })).filter((d) => d.entries > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, d) => sum + d.kcal, 0) / logged.length) : 0;
  const onTarget = target ? logged.filter((d) => isOnTarget(d.kcal, target)).length : 0;

  const top = Math.max(target ?? 0, ...logged.map((d) => d.kcal)) * 1.15 || 1;
  const x = (i: number) => PAD + (i / Math.max(1, days.length - 1)) * (width - PAD * 2);
  const y = (kcal: number) => PAD + (1 - kcal / top) * (CHART_HEIGHT - PAD * 2);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Calories, last 2 weeks</Text>
      <Text style={styles.subtitle}>
        {shortDate(days[0].date)} – {shortDate(days[days.length - 1].date)}
      </Text>

      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {target ? <Line x1={PAD} x2={width - PAD} y1={y(target)} y2={y(target)} stroke={colors.borderStrong} strokeWidth={1.5} strokeDasharray="5 5" /> : null}
            {logged.length > 1 ? (
              <Polyline points={logged.map((d) => `${x(d.i)},${y(d.kcal)}`).join(' ')} fill="none" stroke={nu.kcal.base} strokeWidth={2.5} strokeLinejoin="round" />
            ) : null}
            {logged.map((d) => (
              <Circle key={d.date} cx={x(d.i)} cy={y(d.kcal)} r={3.5} fill={colors.bgSurfaceSolid} stroke={nu.kcal.base} strokeWidth={2} />
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{logged.length ? average.toLocaleString() : '–'}</Text>
          <Text style={styles.statLabel}>kcal a day, on average</Text>
        </View>
        {target ? (
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {onTarget}
              <Text style={styles.statOf}> of {logged.length}</Text>
            </Text>
            <Text style={styles.statLabel}>days on target ({target.toLocaleString()})</Text>
          </View>
        ) : (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{logged.length}</Text>
            <Text style={styles.statLabel}>days logged</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.bgSurfaceSolid, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.borderSubtle },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary },
    subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 3 },
    chart: { height: CHART_HEIGHT, marginTop: spacing.md },
    stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
    stat: { flex: 1 },
    statValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: colors.textPrimary, ...num },
    statOf: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textTertiary },
    statLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textSecondary, marginTop: 2 },
  });
