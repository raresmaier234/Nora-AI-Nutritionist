import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ui/pill';
import { LogColor, LogFontFamily, LogFontSize, LogSpace, trackWide } from '@/constants/log-theme';
import { MEALS, MealName } from '@/data/log-mock-data';

type MealPickerProps = {
  value: MealName;
  onChange: (meal: MealName) => void;
};

export function MealPicker({ value, onChange }: MealPickerProps) {
  return (
    <View>
      <Text style={styles.label}>Add to</Text>
      <View style={styles.row}>
        {MEALS.map((m) => (
          <Pill key={m} label={m} selected={value === m} onPress={() => onChange(m)} fontSize={10.5} flex />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(LogFontSize.micro),
    marginBottom: LogSpace.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: LogSpace.lg,
  },
});
