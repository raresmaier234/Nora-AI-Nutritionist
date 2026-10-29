import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ChevronRightIcon } from '@/components/log/icons';
import { MacroBar } from '@/components/log/macro-bar';
import { GlassCard } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, gradientAngle, motion, radius, spacing, trackTight, useColors, useStyles } from '@/theme';
import { Macro, TARGETS } from '@/features/food/data/mock-data';

type CalorieSummaryCardProps = {
  totals: Macro;
  remaining: number;
  pct: number;
  over: boolean;
  /** Opens the day's full nutrition. */
  onPress: () => void;
};

/** The day's calories and macros; tapping it opens the full nutrition for the day. */
export function CalorieSummaryCard({ totals, remaining, pct, over, onPress }: CalorieSummaryCardProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(pct, { duration: motion.slow });
  }, [pct, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Shows the day's vitamins, minerals and everything else eaten"
      style={({ pressed }) => pressed && styles.pressed}>
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

        <View style={styles.more}>
          <Text style={styles.moreText}>Vitamins, minerals & full nutrition</Text>
          <ChevronRightIcon size={14} color={colors.brandPrimary} strokeWidth={2.6} />
        </View>
      </GlassCard>
    </Pressable>
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
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: spacing.lg,
  },
  moreText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.brandPrimary,
  },
  pressed: { opacity: 0.85 },
});
