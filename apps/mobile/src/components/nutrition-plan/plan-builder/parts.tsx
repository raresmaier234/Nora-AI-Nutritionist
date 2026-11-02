import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AlertIcon, CheckIcon, MinusIcon, PlusIcon } from '@/components/log/icons';
import { Pill } from '@/components/ui/pill';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';
import type { Option } from '@/features/nutrition-plan/options';

/*
 * Building blocks of the plan questionnaire's screens: the question header, single- and
 * multi-choice lists, toggles, steppers, number fields and callouts.
 */

/** The question: a small section label, the question itself and a helper line. */
export function StepHeader({ eyebrow, title, helper }: { eyebrow: string; title: string; helper?: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

type ChoiceRowProps = {
  label: string;
  description?: string;
  selected: boolean;
  kind: 'radio' | 'checkbox';
  onPress: () => void;
};

/** One answer: a card that's either a radio (one of several) or a checkbox (any number). */
export function ChoiceRow({ label, description, selected, kind, onPress }: ChoiceRowProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={kind}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      <View style={[kind === 'radio' ? styles.radio : styles.checkbox, selected && styles.indicatorOn]}>
        {selected ? <CheckIcon size={12} color={colors.white} /> : null}
      </View>
    </Pressable>
  );
}

type ChoiceListProps<K extends string> = {
  options: Option<K>[];
  value: K | null | undefined;
  onChange: (value: K) => void;
  accessibilityLabel: string;
};

/** Pick one. */
export function ChoiceList<K extends string>({ options, value, onChange, accessibilityLabel }: ChoiceListProps<K>) {
  const styles = useStyles(makeStyles);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.list}>
      {options.map((o) => (
        <ChoiceRow key={o.value} label={o.label} description={o.description} kind="radio" selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

type MultiChoiceListProps<K extends string> = {
  options: (Option<K> & { exclusive?: boolean })[];
  values: readonly K[];
  onChange: (values: K[]) => void;
  accessibilityLabel: string;
};

/** Pick any number. An `exclusive` option ("None of these") clears the others, and vice versa. */
export function MultiChoiceList<K extends string>({ options, values, onChange, accessibilityLabel }: MultiChoiceListProps<K>) {
  const styles = useStyles(makeStyles);
  const exclusive = new Set(options.filter((o) => o.exclusive).map((o) => o.value));
  const toggle = (value: K) => {
    if (values.includes(value)) return onChange(values.filter((v) => v !== value));
    if (exclusive.has(value)) return onChange([value]);
    onChange([...values.filter((v) => !exclusive.has(v)), value]);
  };
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.list}>
      {options.map((o) => (
        <ChoiceRow key={o.value} label={o.label} description={o.description} kind="checkbox" selected={values.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </View>
  );
}

/** Wrapping chips, for short answers (allergies, eating style, months). */
export function ChipGroup<K extends string>({
  options,
  isSelected,
  onPress,
  accessibilityLabel,
  columns,
}: {
  options: Option<K>[];
  isSelected: (value: K) => boolean;
  onPress: (value: K) => void;
  accessibilityLabel: string;
  /** Fixed columns (e.g. 4 for months) instead of wrapping to content. */
  columns?: number;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.chips}>
      {options.map((o) => (
        <Pill
          key={o.value}
          label={o.label}
          selected={isSelected(o.value)}
          onPress={() => onPress(o.value)}
          fontSize={fontSize.small}
          style={[styles.chip, columns ? { width: `${100 / columns - 2.5}%` as `${number}%` } : null]}
        />
      ))}
    </View>
  );
}

/** Metric / imperial, as two pills. */
export function UnitToggle<K extends string>({ options, value, onChange }: { options: Option<K>[]; value: K; onChange: (value: K) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Units" style={styles.units}>
      {options.map((o) => (
        <Pill key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} fontSize={fontSize.small} style={styles.unit} />
      ))}
    </View>
  );
}

type NumberFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  accessibilityLabel: string;
  placeholder?: string;
  decimal?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
};

/** A large number input with its unit beside it. */
export function NumberField({ value, onChangeText, unit, accessibilityLabel, placeholder, decimal, maxLength = 5, autoFocus }: NumberFieldProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.numberWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        accessibilityLabel={accessibilityLabel}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={styles.numberInput}
      />
      <Text style={styles.numberUnit}>{unit}</Text>
    </View>
  );
}

/** Parses a typed number ("72,4" too); null if it isn't one. */
export function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() !== '' && Number.isFinite(n) ? n : null;
}

type StepperProps = { label: string; hint?: string; value: number; min: number; max: number; onChange: (value: number) => void; unit?: string };

/** A whole number with − and + (training days, meals a day). */
export function Stepper({ label, hint, value, min, max, onChange, unit }: StepperProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stepperRow}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowDescription}>{hint}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Fewer: ${label}`}
          style={[styles.stepButton, value <= min && styles.disabled]}>
          <MinusIcon size={18} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.stepValue} accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`} accessibilityLiveRegion="polite">
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`More: ${label}`}
          style={[styles.stepButton, value >= max && styles.disabled]}>
          <PlusIcon size={18} color={colors.brandPrimary} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

/** A soft note: information, a gentle warning, or a problem with an answer. */
export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const color = tone === 'error' ? colors.errorText : tone === 'warning' ? colors.amberText : colors.brandPrimary;
  return (
    <View style={[styles.callout, tone === 'error' ? styles.calloutError : tone === 'warning' ? styles.calloutWarning : styles.calloutInfo]}>
      <AlertIcon size={16} color={color} />
      <Text style={styles.calloutText} accessibilityLiveRegion={tone === 'error' ? 'polite' : undefined}>
        {children}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { gap: spacing.sm, marginBottom: spacing.xl },
    eyebrow: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.micro,
      color: colors.brandPrimary,
      textTransform: 'uppercase',
      letterSpacing: trackWide(fontSize.micro),
    },
    title: { fontFamily: fontFamily.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: trackTight(26), color: colors.textPrimary },
    helper: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, color: colors.textSecondary },
    list: { gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 58,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
    },
    rowOn: { borderColor: colors.brandPrimary, backgroundColor: colors.brandWash },
    pressed: { opacity: 0.75 },
    rowText: { flex: 1, minWidth: 0 },
    rowLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.body, lineHeight: 20, color: colors.textPrimary },
    rowDescription: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 18, color: colors.textTertiary, marginTop: 3 },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    indicatorOn: { backgroundColor: colors.brandFill, borderColor: colors.brandFill },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: { minHeight: 40, paddingHorizontal: 14 },
    units: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', marginBottom: spacing.lg },
    unit: { minHeight: 36, paddingHorizontal: spacing.lg },
    numberWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 68,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
    },
    numberInput: {
      flex: 1,
      paddingVertical: spacing.md,
      fontFamily: fontFamily.extrabold,
      fontSize: 30,
      letterSpacing: trackTight(30),
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    numberUnit: { fontFamily: fontFamily.bold, fontSize: fontSize.h2, color: colors.textTertiary },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stepButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgApp,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { opacity: 0.4 },
    stepValue: {
      minWidth: 32,
      textAlign: 'center',
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.h1,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    callout: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: radius.sm },
    calloutInfo: { backgroundColor: colors.brandTint },
    calloutWarning: { backgroundColor: colors.warningTint },
    calloutError: { backgroundColor: colors.dangerTint },
    calloutText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textPrimary },
  });
