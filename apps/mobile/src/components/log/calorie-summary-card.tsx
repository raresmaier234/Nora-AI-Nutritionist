import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MacroBar } from '@/components/log/macro-bar';
import { GlassCard } from '@/components/ui/card';
import { colors, fontFamily, fontSize, gradientAngle, gradients, motion, radius, spacing, trackTight } from '@/theme';
import { Macro, TARGETS } from '@/features/food/data/mock-data';

type CalorieSummaryCardProps = {
  totals: Macro;
  remaining: number;
  pct: number;
  over: boolean;
  onCopyYesterday: () => void;
};

export function CalorieSummaryCard({ totals, remaining, pct, over, onCopyYesterday }: CalorieSummaryCardProps) {
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
          <Text style={[styles.remaining, { color: over ? colors.red500 : colors.greenText }]}>
            {over ? `${(totals.kcal - TARGETS.kcal).toLocaleString()} kcal over` : `${remaining.toLocaleString()} kcal remaining`}
          </Text>
        </View>
        <Pressable onPress={onCopyYesterday} accessibilityRole="button" style={styles.copyButton}>
          <Text style={styles.copyLabel}>Copy yesterday</Text>
        </Pressable>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, over && { backgroundColor: colors.red500 }, fillStyle]}>
          {!over && (
            <LinearGradient
              colors={gradients.success}
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

const styles = StyleSheet.create({
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
  copyButton: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  copyLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.nano,
    color: colors.textSecondary,
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
