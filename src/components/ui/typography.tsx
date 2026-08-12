import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { LogColor, LogFontFamily, LogFontSize, LogSpace, trackWide } from '@/constants/log-theme';

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
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.h1,
    color: LogColor.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.small,
    color: LogColor.textTertiary,
    marginBottom: LogSpace.lg,
  },
  section: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(LogFontSize.micro),
    marginBottom: LogSpace.sm + 2,
  },
});
