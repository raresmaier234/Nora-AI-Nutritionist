import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, fontFamily, fontSize, gradientAngle, gradients, motion, radius, shadows, spacing } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  flex?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Primary/secondary/destructive/ghost button, matching DESIGN_SYSTEM.md §7.1 Button. */
export function Button({ label, onPress, variant = 'primary', disabled, flex, style }: ButtonProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.965, { duration: motion.fast });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: motion.fast });
      }}
      style={[
        styles.base,
        variantContainer[variant],
        flex && styles.flex,
        disabled && styles.disabled,
        pressStyle,
        style,
      ]}>
      {variant === 'primary' && (
        <LinearGradient
          colors={gradients.primary}
          start={gradientAngle.start}
          end={gradientAngle.end}
          style={styles.gradientFill}
        />
      )}
      <Text style={[styles.label, variantLabel[variant]]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
});

const variantContainer: Record<ButtonVariant, StyleProp<ViewStyle>> = StyleSheet.create({
  primary: {
    boxShadow: shadows.glowPrimary,
    paddingHorizontal: spacing.lg,
  },
  secondary: {
    backgroundColor: colors.bgSurfaceSolid,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.xl,
  },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.red500,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});

const variantLabel: Record<ButtonVariant, StyleProp<TextStyle>> = {
  primary: { color: colors.textOnBrand },
  secondary: { color: colors.textPrimary },
  destructive: { color: colors.red500 },
  ghost: { color: colors.brandPrimary },
};
