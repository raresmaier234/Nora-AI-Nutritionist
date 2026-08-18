import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { colors, fontFamily, fontSize, spacing, trackWide } from '@/theme';

type TextBlockProps = { children: ReactNode; style?: StyleProp<TextStyle> };

export function SheetTitle({ children, style }: TextBlockProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function SheetSubtitle({ children, style }: TextBlockProps) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function SectionLabel({ children, style }: TextBlockProps) {
  return <Text style={[styles.section, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h1,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  section: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.micro),
    marginBottom: spacing.sm + 2,
  },
});
