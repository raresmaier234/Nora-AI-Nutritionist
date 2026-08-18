import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, fontSize, trackWide } from '@/theme';

type StatProps = { value: string | number; label: string; color?: string };

export function Stat({ value, label, color }: StatProps) {
  return (
    <View>
      <Text style={[styles.value, { color: color ?? colors.textPrimary }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h2,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.nano,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.nano),
    marginTop: 5,
  },
});
