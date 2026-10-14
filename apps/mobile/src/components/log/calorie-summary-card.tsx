import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MacroBar } from '@/components/log/macro-bar';
import { GlassCard } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, gradientAngle, motion, radius, spacing, trackTight, useColors, useStyles } from '@/theme';
import { Macro, TARGETS } from '@/features/food/data/mock-data';

type CalorieSummaryCardProps = {
  totals: Macro;
  remaining: number;
  pct: number;
  over: boolean;
};

export function CalorieSummaryCard({ totals, remaining, pct, over }: CalorieSummaryCardProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(pct, { duration: motion.slow });
  }, [pct, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <GlassCard padding={18}>
      <View style={styles.headerRow}>
        <View>
          <View style={styles.totalRow}>
            <Text style={styles.total}>{totals.kcal.toLocaleString()}</Text>
            <Text style={styles.target}>/ {TARGETS.kcal.toLocaleString()} kcal</Text>
          </View>
          <Text style={[styles.remaining, { color: over ? colors.errorText : colors.greenText }]}>
            {over ? `${(totals.kcal - TARGETS.kcal).toLocaleString()} kcal over` : `${remaining.toLocaleString()} kcal remaining`}
          </Text>
        </View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, over && { backgroundColor: colors.stateError }, fillStyle]}>
          {!over && (
            <LinearGradient
              colors={colors.gradSuccess}
              start={gradientAngle.start}
              end={gradientAngle.end}
              style={StyleSheet.absoluteFill}
            />
          )}
        </Animated.View>
      </View>

      <View style={styles.macroRow}>
        <MacroBar tone="protein" label="Protein" current={totals.protein} target={TARGETS.protein} unit="g" />
        <MacroBar tone="carbs" label="Carbs" current={totals.carbs} target={TARGETS.carbs} unit="g" />
        <MacroBar tone="fat" label="Fat" current={totals.fat} target={TARGETS.fat} unit="g" />
      </View>
    </GlassCard>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  total: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display2,
    color: colors.textPrimary,
    letterSpacing: trackTight(fontSize.display2),
  },
  target: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.small,
    color: colors.textTertiary,
  },
  remaining: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    marginTop: 6,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.trackEmpty,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
});
