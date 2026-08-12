import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/components/log/amount-field';
import { MealPicker } from '@/components/log/meal-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SectionLabel, SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { LogColor, LogFontFamily, LogSpace, trackWide } from '@/constants/log-theme';
import { MealName } from '@/data/log-mock-data';
import { CustomFoodForm } from '@/hooks/use-food-log';

type CustomFoodPanelProps = {
  meal: MealName;
  onMeal: (meal: MealName) => void;
  onSave: (form: CustomFoodForm) => void;
};

const NUMERIC_FIELDS: Array<{ key: keyof CustomFoodForm; label: string }> = [
  { key: 'kcal', label: 'Kcal' },
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
];

export function CustomFoodPanel({ meal, onMeal, onSave }: CustomFoodPanelProps) {
  const [form, setForm] = useState<CustomFoodForm>({ name: '', amount: 100, unit: 'g', kcal: '', protein: '', carbs: '', fat: '' });
  const set = (k: keyof CustomFoodForm, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim().length > 0 && Number(form.kcal) > 0;

  return (
    <View>
      <SheetTitle>Custom food</SheetTitle>
      <SheetSubtitle>Enter the values from the label, per the serving below</SheetSubtitle>

      <Field style={styles.nameInput} value={form.name} onChangeText={(v) => set('name', v)} placeholder="Food name" />

      <SectionLabel>Serving</SectionLabel>
      <View style={styles.servingWrap}>
        <AmountField amount={form.amount} unit={form.unit} onChange={(q) => setForm((f) => ({ ...f, ...q }))} />
      </View>

      <View style={styles.fieldGrid}>
        {NUMERIC_FIELDS.map(({ key, label }) => (
          <View key={key} style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Field
              value={String(form[key])}
              onChangeText={(v) => set(key, v)}
              placeholder="0"
              keyboardType="numeric"
              style={styles.numericInput}
            />
          </View>
        ))}
      </View>

      <MealPicker value={meal} onChange={onMeal} />
      <Button label={`Save food & add to ${meal}`} disabled={!valid} onPress={() => onSave(form)} />
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: { marginBottom: LogSpace.md + 2 },
  servingWrap: { marginBottom: LogSpace.md + 2 },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LogSpace.sm,
    marginBottom: LogSpace.lg,
  },
  fieldCol: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  fieldLabel: {
    fontFamily: LogFontFamily.semibold,
    fontSize: 10,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(10),
    marginBottom: 6,
  },
  numericInput: {
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
});
