import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MacroBar } from '@/components/log/macro-bar';
import { GlassCard } from '@/components/ui/card';
import { LogColor, LogFontFamily, LogFontSize, LogGradientAngle, LogGradientColors, LogMotion, LogRadius, LogSpace, trackTight } from '@/constants/log-theme';
import { Macro, TARGETS } from '@/data/log-mock-data';

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
    width.value = withTiming(pct, { duration: LogMotion.slow });
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
          <Text style={[styles.remaining, { color: over ? LogColor.red500 : LogColor.greenText }]}>
            {over ? `${(totals.kcal - TARGETS.kcal).toLocaleString()} kcal over` : `${remaining.toLocaleString()} kcal remaining`}
          </Text>
        </View>
        <Pressable onPress={onCopyYesterday} accessibilityRole="button" style={styles.copyButton}>
          <Text style={styles.copyLabel}>Copy yesterday</Text>
        </Pressable>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, over && { backgroundColor: LogColor.red500 }, fillStyle]}>
          {!over && (
            <LinearGradient
              colors={LogGradientColors.success}
              start={LogGradientAngle.start}
              end={LogGradientAngle.end}
              style={StyleSheet.absoluteFillObject}
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
    marginBottom: LogSpace.md,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  total: {
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.display2,
    color: LogColor.textPrimary,
    letterSpacing: trackTight(LogFontSize.display2),
  },
  target: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.small,
    color: LogColor.textTertiary,
  },
  remaining: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
    marginTop: 6,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    backgroundColor: LogColor.bgApp,
    borderRadius: LogRadius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  copyLabel: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.nano,
    color: LogColor.textSecondary,
  },
  track: {
    height: 10,
    borderRadius: LogRadius.pill,
    backgroundColor: LogColor.trackEmpty,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: LogRadius.pill,
    overflow: 'hidden',
  },
  macroRow: {
    flexDirection: 'row',
    gap: LogSpace.lg,
    marginTop: LogSpace.lg,
  },
});
