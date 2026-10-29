import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/log/icons';
import { Palette, fontFamily, fontSize, useColors, useStyles } from '@/theme';

type DateNavigatorProps = {
  dayOffset: number;
  onChange: (offset: number) => void;
  /** The day `dayOffset` counts from — today. */
  anchorDate: Date;
};

/** "Today" / "Yesterday" / a weekday, and "Thu, Oct 29", for the day `dayOffset` days from `anchorDate`. */
export function dayLabels(anchorDate: Date, dayOffset: number) {
  const date = new Date(anchorDate);
  date.setDate(date.getDate() + dayOffset);
  return {
    dayLabel: dayOffset === 0 ? 'Today' : dayOffset === -1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

export function DateNavigator({ dayOffset, onChange, anchorDate }: DateNavigatorProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { dayLabel, dateLabel } = useMemo(() => dayLabels(anchorDate, dayOffset), [anchorDate, dayOffset]);

  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(dayOffset - 1)} accessibilityRole="button" accessibilityLabel="Previous day" style={styles.iconButton}>
        <ChevronLeftIcon color={colors.textSecondary} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <Text style={styles.dateLabel}>{dateLabel}</Text>
      </View>
      <Pressable onPress={() => onChange(dayOffset + 1)} accessibilityRole="button" accessibilityLabel="Next day" style={styles.iconButton}>
        <ChevronRightIcon color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center' },
  dayLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h1,
    color: colors.textPrimary,
    letterSpacing: -0.66,
  },
  dateLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    marginTop: 5,
  },
});
