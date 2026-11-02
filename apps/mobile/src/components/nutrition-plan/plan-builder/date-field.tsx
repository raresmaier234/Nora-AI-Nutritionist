import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon } from '@/components/log/icons';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles, useTheme } from '@/theme';
import { formatDate, isoDate, parseIsoDate } from '@/features/nutrition-plan/questionnaire';

type DateFieldProps = {
  /** YYYY-MM-DD */
  value: string;
  /** YYYY-MM-DD, inclusive. */
  min: string;
  max: string;
  onChange: (value: string) => void;
  label: string;
};

/**
 * A date between `min` and `max`, with Expo UI's DateTimePicker (included in Expo Go): an
 * inline calendar on iOS; on Android a row that opens the Material date dialog.
 */
export function DateField({ value, min, max, onChange, label }: DateFieldProps) {
  const colors = useColors();
  const { scheme } = useTheme();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const date = parseIsoDate(value);
  const pick = (picked: Date) => onChange(isoDate(picked));

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.calendar} accessibilityLabel={`${label}: ${formatDate(value)}`}>
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          minimumDate={parseIsoDate(min)}
          maximumDate={parseIsoDate(max)}
          accentColor={colors.brandPrimary}
          themeVariant={scheme}
          onValueChange={(_, picked) => pick(picked)}
          style={styles.fill}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}. Change`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{formatDate(value)}</Text>
        </View>
        <ChevronRightIcon size={18} color={colors.textTertiary} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="date"
          presentation="dialog"
          minimumDate={parseIsoDate(min)}
          maximumDate={parseIsoDate(max)}
          accentColor={colors.brandPrimary}
          themeVariant={scheme}
          onValueChange={(_, picked) => {
            setOpen(false);
            pick(picked);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    calendar: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
      padding: spacing.sm,
    },
    fill: { width: '100%' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 58,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
    },
    pressed: { opacity: 0.75 },
    rowText: { flex: 1 },
    rowLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
    rowValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginTop: 2 },
  });
