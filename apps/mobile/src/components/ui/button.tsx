import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Palette, fontFamily, fontSize, gradientAngle, motion, radius, spacing, useColors, useStyles } from '@/theme';

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
  const variantContainer = useStyles(makeVariantContainer);
  const variantLabel = useStyles(makeVariantLabel);
  const styles = useStyles(makeStyles);
  const colors = useColors();
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
          colors={colors.gradPrimary}
          start={gradientAngle.start}
          end={gradientAngle.end}
          style={styles.gradientFill}
        />
      )}
      <Text style={[styles.label, variantLabel[variant]]}>{label}</Text>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
  },
});

const makeVariantContainer = (colors: Palette): Record<ButtonVariant, StyleProp<ViewStyle>> => StyleSheet.create({
  primary: {
    boxShadow: colors.glowPrimary,
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
    borderColor: colors.stateError,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});

const makeVariantLabel = (colors: Palette): Record<ButtonVariant, StyleProp<TextStyle>> => ({
  primary: { color: colors.textOnBrand },
  secondary: { color: colors.textPrimary },
  destructive: { color: colors.errorText },
  ghost: { color: colors.brandPrimary },
});
