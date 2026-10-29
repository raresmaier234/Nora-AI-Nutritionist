import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { Palette, fontFamily, fontSize, spacing, trackWide, useStyles } from '@/theme';

type TextBlockProps = { children: ReactNode; style?: StyleProp<TextStyle> };

export function SheetTitle({ children, style }: TextBlockProps) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function SheetSubtitle({ children, style }: TextBlockProps) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function SectionLabel({ children, style }: TextBlockProps) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.section, style]}>{children}</Text>;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h1,
    color: colors.textPrimary,
    marginBottom: 4,
    // Clear of the Sheet's close button in the card's top-right corner.
    paddingRight: 32,
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
