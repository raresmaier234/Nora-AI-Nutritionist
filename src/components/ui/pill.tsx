import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { LogColor, LogFontFamily, LogFontSize, LogGradient, LogMotion, LogRadius, LogSpace } from '@/constants/log-theme';

type PillProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  flex?: boolean;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Selectable pill/chip — used by MealPicker, segmented tabs, and ingredient chips. */
export function Pill({ label, selected, onPress, flex, fontSize = LogFontSize.micro, style }: PillProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.965, { duration: LogMotion.fast });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: LogMotion.fast });
      }}
      style={[styles.base, selected ? styles.selected : styles.unselected, flex && styles.flex, pressStyle, style]}>
      <Text
        numberOfLines={1}
        style={[styles.label, { fontSize }, selected ? styles.selectedLabel : styles.unselectedLabel]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: LogRadius.pill,
    paddingVertical: 9,
    paddingHorizontal: LogSpace.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  selected: {
    experimental_backgroundImage: LogGradient.primary,
  },
  unselected: {
    backgroundColor: LogColor.bgApp,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
  },
  label: {
    fontFamily: LogFontFamily.bold,
  },
  selectedLabel: { color: LogColor.textOnBrand },
  unselectedLabel: { color: LogColor.textSecondary },
});
