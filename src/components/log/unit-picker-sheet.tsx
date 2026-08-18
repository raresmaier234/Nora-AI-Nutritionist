import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/ui/sheet';
import { colors, fontFamily, fontSize, radius, spacing, trackWide } from '@/theme';
import { UNITS } from '@/features/food/data/mock-data';

type UnitPickerSheetProps = {
  visible: boolean;
  value: string;
  onSelect: (unit: string) => void;
  onClose: () => void;
};

/** Mini centered sheet used by AmountField to pick a serving unit — replaces the web <select>. */
export function UnitPickerSheet({ visible, value, onSelect, onClose }: UnitPickerSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Unit</Text>
      <View style={styles.list}>
        {UNITS.map((u, i) => {
          const selected = u.label === value;
          return (
            <Pressable
              key={u.label}
              onPress={() => {
                onSelect(u.label);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.row, i < UNITS.length - 1 && styles.rowDivider, selected && styles.rowSelected]}>
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{u.label}</Text>
              {selected && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandPrimary,
  },
});
