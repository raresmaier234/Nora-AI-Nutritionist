import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/log/icons';
import { colors, fontFamily, fontSize } from '@/theme';

type DateNavigatorProps = {
  dayOffset: number;
  onChange: (offset: number) => void;
  /** The day `dayOffset` counts from — today. */
  anchorDate: Date;
};

export function DateNavigator({ dayOffset, onChange, anchorDate }: DateNavigatorProps) {
  const date = useMemo(() => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [anchorDate, dayOffset]);

  const dayLabel = dayOffset === 0 ? 'Today' : dayOffset === -1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(dayOffset - 1)} accessibilityRole="button" accessibilityLabel="Previous day" style={styles.iconButton}>
        <ChevronLeftIcon />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <Text style={styles.dateLabel}>{dateLabel}</Text>
      </View>
      <Pressable onPress={() => onChange(dayOffset + 1)} accessibilityRole="button" accessibilityLabel="Next day" style={styles.iconButton}>
        <ChevronRightIcon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
