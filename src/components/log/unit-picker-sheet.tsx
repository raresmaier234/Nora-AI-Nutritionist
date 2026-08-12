import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/ui/sheet';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace, trackWide } from '@/constants/log-theme';
import { UNITS } from '@/data/log-mock-data';

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
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(LogFontSize.micro),
    marginBottom: LogSpace.sm,
  },
  list: {
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: LogSpace.md,
    paddingHorizontal: LogSpace.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: LogColor.borderSubtle,
  },
  rowSelected: {
    backgroundColor: LogColor.chipIndigoTint,
  },
  rowLabel: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
  rowLabelSelected: {
    fontFamily: LogFontFamily.bold,
    color: LogColor.brandPrimaryStrong,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LogColor.brandPrimary,
  },
});
