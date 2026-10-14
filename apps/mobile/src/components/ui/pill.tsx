import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, fontFamily, fontSize, gradientAngle, gradients, motion, radius, spacing } from '@/theme';

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
export function Pill({ label, selected, onPress, flex, fontSize: fontSizeProp, style }: PillProps) {
  const resolvedFontSize = fontSizeProp ?? fontSize.micro;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.965, { duration: motion.fast });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: motion.fast });
      }}
      style={[styles.base, selected ? styles.selected : styles.unselected, flex && styles.flex, pressStyle, style]}>
      {selected && (
        <LinearGradient
          colors={gradients.primary}
          start={gradientAngle.start}
          end={gradientAngle.end}
          style={styles.gradientFill}
        />
      )}
      <Text
        numberOfLines={1}
        style={[styles.label, { fontSize: resolvedFontSize }, selected ? styles.selectedLabel : styles.unselectedLabel]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  selected: {},
  unselected: {
    backgroundColor: colors.bgApp,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  gradientFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: fontFamily.bold,
  },
  selectedLabel: { color: colors.textOnBrand },
  unselectedLabel: { color: colors.textSecondary },
});
