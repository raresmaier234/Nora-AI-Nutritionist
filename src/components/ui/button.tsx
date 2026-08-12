import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { LogColor, LogFontFamily, LogFontSize, LogGradient, LogMotion, LogRadius, LogShadow, LogSpace } from '@/constants/log-theme';

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
        scale.value = withTiming(0.965, { duration: LogMotion.fast });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: LogMotion.fast });
      }}
      style={[
        styles.base,
        variantContainer[variant],
        flex && styles.flex,
        disabled && styles.disabled,
        pressStyle,
        style,
      ]}>
      <Text style={[styles.label, variantLabel[variant]]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: LogRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
  },
});

const variantContainer: Record<ButtonVariant, StyleProp<ViewStyle>> = StyleSheet.create({
  primary: {
    experimental_backgroundImage: LogGradient.primary,
    boxShadow: LogShadow.glowPrimary,
    paddingHorizontal: LogSpace.lg,
  },
  secondary: {
    backgroundColor: LogColor.bgSurfaceSolid,
    borderWidth: 1,
    borderColor: LogColor.borderStrong,
    paddingHorizontal: LogSpace.xl,
  },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: LogColor.red500,
    paddingVertical: 13,
    paddingHorizontal: LogSpace.xl,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: LogSpace.md,
    paddingHorizontal: LogSpace.md,
  },
});

const variantLabel: Record<ButtonVariant, StyleProp<ViewStyle>> = {
  primary: { color: LogColor.textOnBrand },
  secondary: { color: LogColor.textPrimary },
  destructive: { color: LogColor.red500 },
  ghost: { color: LogColor.brandPrimary },
};
