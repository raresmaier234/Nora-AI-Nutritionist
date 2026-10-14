import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ClockIcon, MinusIcon, PlusIcon } from '@/components/log/icons';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Sheet } from '@/components/ui/sheet';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, useColors, useStyles } from '@/theme';
import { fromMin, nowHHMM, toMin } from '@/features/food/time';

const OFFSETS: Array<[string, number]> = [
  ['Now', 0],
  ['30 min ago', 30],
  ['1 h ago', 60],
  ['2 h ago', 120],
];

type WhenPickerProps = {
  /** "HH:MM" */
  value: string;
  onChange: (time: string) => void;
  label?: string;
  compact?: boolean;
};

/**
 * "When did you eat?" — every entry lands on the timeline at this time. Quick offsets for the
 * common case, and the time chip opens an exact picker. Ported from timeline-utils.jsx's
 * WhenPicker; the native `<input type="time">` becomes TimePickerSheet.
 */
export function WhenPicker({ value, onChange, label, compact }: WhenPickerProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [picking, setPicking] = useState(false);
  const now = toMin(nowHHMM());
  const active = OFFSETS.find(([, o]) => fromMin(now - o) === value);

  return (
    <View style={{ marginBottom: compact ? 10 : spacing.lg }}>
      <View style={styles.header}>
        <Text style={styles.label}>{label ?? 'When did you eat?'}</Text>
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`Time eaten, ${value}. Change`}
          style={({ pressed }) => [styles.timeChip, pressed && styles.pressed]}>
          <ClockIcon size={15} color={colors.brandPrimary} />
          <Text style={styles.timeText}>{value}</Text>
        </Pressable>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Quick time" style={styles.offsets}>
        {OFFSETS.map(([l, o]) => (
          <Pill
            key={l}
            label={l}
            selected={!!active && active[1] === o}
            onPress={() => onChange(fromMin(now - o))}
            fontSize={fontSize.micro}
            flex
            style={styles.offset}
          />
        ))}
      </View>
      <TimePickerSheet
        visible={picking}
        value={value}
        onClose={() => setPicking(false)}
        onDone={(t) => {
          onChange(t);
          setPicking(false);
        }}
      />
    </View>
  );
}

type TimePickerSheetProps = { visible: boolean; value: string; onClose: () => void; onDone: (time: string) => void };

/** Hour and minute steppers (minutes in 5s), so any time of day is a few taps away. */
function TimePickerSheet({ visible, value, onClose, onDone }: TimePickerSheetProps) {
  const styles = useStyles(makeStyles);
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(visible);
  // Start from the current value every time the sheet opens.
  if (visible !== shown) {
    setShown(visible);
    if (visible) setDraft(value);
  }
  const m = toMin(draft);
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  const setHM = (h: number, mi: number) => setDraft(fromMin(((h + 24) % 24) * 60 + ((mi + 60) % 60)));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle>Time eaten</SheetTitle>
      <SheetSubtitle>Pick when you had it</SheetSubtitle>
      <View style={styles.steppers}>
        <Stepper
          label="Hour"
          value={String(hour).padStart(2, '0')}
          onDec={() => setHM(hour - 1, minute)}
          onInc={() => setHM(hour + 1, minute)}
        />
        <Text style={styles.colon}>:</Text>
        <Stepper
          label="Minute"
          value={String(minute).padStart(2, '0')}
          onDec={() => setHM(hour, Math.ceil(minute / 5) * 5 - 5)}
          onInc={() => setHM(hour, Math.floor(minute / 5) * 5 + 5)}
        />
      </View>
      <Button label={`Set ${draft}`} onPress={() => onDone(draft)} />
    </Sheet>
  );
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onInc} accessibilityRole="button" accessibilityLabel={`Later ${label.toLowerCase()}`} style={styles.stepButton}>
        <PlusIcon size={18} color={colors.brandPrimary} strokeWidth={2.6} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
      <Pressable onPress={onDec} accessibilityRole="button" accessibilityLabel={`Earlier ${label.toLowerCase()}`} style={styles.stepButton}>
        <MinusIcon size={18} color={colors.brandPrimary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 10,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  pressed: { opacity: 0.7 },
  timeText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 16,
    color: colors.brandPrimary,
    fontVariant: ['tabular-nums'],
  },
  offsets: { flexDirection: 'row', gap: 6 },
  offset: { minHeight: 36 },
  steppers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  colon: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display2,
    color: colors.textTertiary,
  },
  stepper: { alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display2,
    color: colors.textPrimary,
    letterSpacing: trackTight(fontSize.display2),
    fontVariant: ['tabular-nums'],
    minWidth: 64,
    textAlign: 'center',
  },
});
