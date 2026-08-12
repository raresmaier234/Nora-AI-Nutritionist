import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UnitPickerSheet } from '@/components/log/unit-picker-sheet';
import { Field } from '@/components/ui/field';
import { LogColor, LogFontFamily, LogFontSize, LogRadius } from '@/constants/log-theme';

type AmountFieldProps = {
  amount: number | string;
  unit: string;
  onChange: (value: { amount: number; unit: string }) => void;
};

/** Amount number input + unit selector. The unit selector opens a UnitPickerSheet (mini sheet). */
export function AmountField({ amount, unit, onChange }: AmountFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Field
        style={styles.amountInput}
        keyboardType="numeric"
        value={String(amount)}
        onChangeText={(text) => onChange({ amount: Number(text) || 0, unit })}
      />
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose unit"
        style={styles.unitButton}>
        <Text style={styles.unitLabel}>{unit}</Text>
      </Pressable>
      <UnitPickerSheet
        visible={pickerOpen}
        value={unit}
        onSelect={(u) => onChange({ amount: Number(amount) || 0, unit: u })}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  amountInput: {
    width: 88,
  },
  unitButton: {
    flex: 1,
    borderRadius: LogRadius.md,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    backgroundColor: LogColor.bgApp,
    paddingVertical: 13,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  unitLabel: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
});
