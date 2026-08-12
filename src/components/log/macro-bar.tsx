import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { LogColor, LogFontFamily, LogFontSize, LogGradientAngle, LogGradientColors, LogMotion, LogRadius, trackWide } from '@/constants/log-theme';

export type MacroTone = 'protein' | 'carbs' | 'fat';

// Canonical macro→color mapping (DESIGN_SYSTEM.md §2.4): protein=indigo, carbs=amber, fat=green.
const TONE_GRADIENT: Record<MacroTone, [string, string]> = {
  protein: LogGradientColors.primary,
  carbs: LogGradientColors.accent,
  fat: LogGradientColors.success,
};

type MacroBarProps = {
  tone: MacroTone;
  label: string;
  current: number;
  target: number;
  unit: string;
};

export function MacroBar({ tone, label, current, target, unit }: MacroBarProps) {
  const width = useSharedValue(0);
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);

  useEffect(() => {
    width.value = withTiming(pct, { duration: LogMotion.slow });
  }, [pct, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{current}</Text>
        <Text style={styles.target}>
          /{target}
          {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]}>
          <LinearGradient
            colors={TONE_GRADIENT[tone]}
            start={LogGradientAngle.start}
            end={LogGradientAngle.end}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(LogFontSize.micro),
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  value: {
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.stat,
    color: LogColor.textPrimary,
  },
  target: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
  },
  track: {
    height: 5,
    borderRadius: LogRadius.pill,
    backgroundColor: LogColor.trackEmpty,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: LogRadius.pill,
    overflow: 'hidden',
  },
});
