import { StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/components/log/amount-field';
import { FoodIcon } from '@/components/log/food-icon';
import { Button } from '@/components/ui/button';
import { colors, fontFamily, fontSize, radius, spacing, trackWide } from '@/theme';
import { Entry, entryMacros } from '@/features/food/data/mock-data';

type FoodDetailPanelProps = {
  meal: string;
  entry: Entry;
  onChange: (patch: { amount: number; unit: string }) => void;
  onSave: () => void;
  onDelete: () => void;
};

/** Edit sheet for an existing log entry — amount/unit + live-recomputed macros. */
export function FoodDetailPanel({ meal, entry, onChange, onSave, onDelete }: FoodDetailPanelProps) {
  const m = entryMacros(entry);
  const cells: Array<[string, string | number, string]> = [
    ['Calories', m.kcal, colors.textPrimary],
    ['Protein', `${m.protein}g`, colors.brandPrimary],
    ['Carbs', `${m.carbs}g`, colors.amberText],
    ['Fat', `${m.fat}g`, colors.greenText],
  ];

  return (
    <View>
      <View style={styles.hero}>
        <FoodIcon name={entry.name} size={72} />
        <Text style={styles.name}>{entry.name}</Text>
        <Text style={styles.meta}>
          {meal} · {entry.time}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Amount</Text>
      <AmountField amount={entry.amount} unit={entry.unit} onChange={onChange} />

      <View style={styles.macroGrid}>
        {cells.map(([label, value, color]) => (
          <View key={label} style={styles.macroCell}>
            <Text style={[styles.macroValue, { color }]}>{value}</Text>
            <Text style={styles.macroLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Save" onPress={onSave} flex />
        <Button label="Delete" variant="destructive" onPress={onDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  name: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
  },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.micro),
    marginBottom: spacing.sm,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.xl,
    marginBottom: spacing.xl + 4,
  },
  macroCell: {
    flex: 1,
    backgroundColor: colors.bgApp,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  macroValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h2,
  },
  macroLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 5,
    letterSpacing: trackWide(9),
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
});
