import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadows } from '@/theme';

type CardProps = { children: ReactNode; padding?: number; style?: StyleProp<ViewStyle> };

/** Plain solid surface — meal sections, list containers, row groups. */
export function Card({ children, padding = 0, style }: CardProps) {
  return <View style={[styles.card, { padding }, style]}>{children}</View>;
}

/**
 * Translucent "glass" surface used by the calorie summary and water tracker.
 * True `backdrop-filter: blur()` has no cross-platform RN equivalent over arbitrary content,
 * so this approximates it with a translucent fill + border + elevated shadow (§7.1 GlassCard) —
 * visually very close here since the card always sits over the flat `--bg-app` page background.
 */
export function GlassCard({ children, padding = 18, style }: CardProps) {
  return <View style={[styles.glass, { padding }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    boxShadow: shadows.sm,
  },
  glass: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    boxShadow: shadows.md,
  },
});
