import { StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/components/log/amount-field';
import { FoodIcon } from '@/components/log/food-icon';
import { Button } from '@/components/ui/button';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace, trackWide } from '@/constants/log-theme';
import { Entry, entryMacros } from '@/data/log-mock-data';

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
    ['Calories', m.kcal, LogColor.textPrimary],
    ['Protein', `${m.protein}g`, LogColor.brandPrimary],
    ['Carbs', `${m.carbs}g`, LogColor.amberText],
    ['Fat', `${m.fat}g`, LogColor.greenText],
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
    gap: LogSpace.md,
    marginBottom: LogSpace.xl,
  },
  name: {
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.h1,
    color: LogColor.textPrimary,
    textAlign: 'center',
  },
  meta: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
  },
  sectionLabel: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(LogFontSize.micro),
    marginBottom: LogSpace.sm,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: LogSpace.sm + 2,
    marginTop: LogSpace.xl,
    marginBottom: LogSpace.xl + 4,
  },
  macroCell: {
    flex: 1,
    backgroundColor: LogColor.bgApp,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.md,
    paddingVertical: LogSpace.md,
    paddingHorizontal: LogSpace.sm,
    alignItems: 'center',
  },
  macroValue: {
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.h2,
  },
  macroLabel: {
    fontFamily: LogFontFamily.semibold,
    fontSize: 9,
    color: LogColor.textTertiary,
    marginTop: 5,
    letterSpacing: trackWide(9),
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: LogSpace.sm + 2,
  },
});
