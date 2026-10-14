import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/ui/sheet';
import { Palette, fontFamily, fontSize, radius, spacing, trackWide, useStyles } from '@/theme';
import { UNITS } from '@/features/food/data/mock-data';

type UnitPickerSheetProps = {
  visible: boolean;
  value: string;
  onSelect: (unit: string) => void;
  onClose: () => void;
  /** [label, grams] to offer instead of the generic UNITS — e.g. a food's own servings. */
  units?: Array<[string, number]>;
};

/** Mini centered sheet used by AmountField and Recipe Studio to pick a unit — replaces the web <select>. */
export function UnitPickerSheet({ visible, value, onSelect, onClose, units }: UnitPickerSheetProps) {
  const styles = useStyles(makeStyles);
  const options = units ?? UNITS.map((u): [string, number] => [u.label, u.grams]);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Unit</Text>
      <View style={styles.list}>
        {options.map(([label, grams], i) => {
          const selected = label === value;
          return (
            <Pressable
              key={label}
              onPress={() => {
                onSelect(label);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.row, i < options.length - 1 && styles.rowDivider, selected && styles.rowSelected]}>
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{label}</Text>
              <View style={styles.rowEnd}>
                {label !== 'g' ? <Text style={styles.rowGrams}>{Math.round(grams * 10) / 10} g</Text> : null}
                {selected && <View style={styles.dot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.micro),
    marginBottom: spacing.sm,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowSelected: {
    backgroundColor: colors.chipIndigoTint,
  },
  rowLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  rowLabelSelected: {
    fontFamily: fontFamily.bold,
    color: colors.brandPrimaryStrong,
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowGrams: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textTertiary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandPrimary,
  },
});
