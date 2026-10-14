import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, fontFamily, fontSize, gradientAngle, gradients, motion, radius, trackWide } from '@/theme';

export type MacroTone = 'protein' | 'carbs' | 'fat';

// Canonical macro→color mapping (DESIGN_SYSTEM.md §2.4): protein=indigo, carbs=amber, fat=green.
const TONE_GRADIENT: Record<MacroTone, [string, string]> = {
  protein: gradients.primary,
  carbs: gradients.accent,
  fat: gradients.success,
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
    width.value = withTiming(pct, { duration: motion.slow });
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
            start={gradientAngle.start}
            end={gradientAngle.end}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.micro),
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  value: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.stat,
    color: colors.textPrimary,
  },
  target: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.trackEmpty,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
