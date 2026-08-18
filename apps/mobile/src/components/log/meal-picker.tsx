import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ui/pill';
import { colors, fontFamily, fontSize, spacing, trackWide } from '@/theme';
import { MEALS, MealName } from '@/features/food/data/mock-data';

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
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.micro),
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.lg,
  },
});
