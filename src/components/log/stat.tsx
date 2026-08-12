import { StyleSheet, Text, View } from 'react-native';

import { LogColor, LogFontFamily, LogFontSize, trackWide } from '@/constants/log-theme';

type StatProps = { value: string | number; label: string; color?: string };

export function Stat({ value, label, color }: StatProps) {
  return (
    <View>
      <Text style={[styles.value, { color: color ?? LogColor.textPrimary }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.h2,
  },
  label: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.nano,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(LogFontSize.nano),
    marginTop: 5,
  },
});
