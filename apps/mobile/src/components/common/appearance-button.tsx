import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AutoThemeIcon, CheckIcon, MoonIcon, SunIcon } from '@/components/log/icons';
import { Sheet } from '@/components/ui/sheet';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Palette, SchemePreference, fontFamily, fontSize, radius, setSchemePreference, spacing, useColors, useSchemePreference, useStyles } from '@/theme';

const OPTIONS: Array<{ value: SchemePreference; label: string; sub: string; Icon: typeof SunIcon }> = [
  { value: 'system', label: 'Auto', sub: 'Match your phone’s setting', Icon: AutoThemeIcon },
  { value: 'light', label: 'Light', sub: 'Always light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', sub: 'Night mode, always', Icon: MoonIcon },
];

/** Round button that opens the Auto / Light / Dark choice; its icon shows the current one. */
export function AppearanceButton() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const preference = useSchemePreference();
  const [open, setOpen] = useState(false);
  const Current = OPTIONS.find((o) => o.value === preference)!.Icon;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Appearance: ${OPTIONS.find((o) => o.value === preference)!.label}. Change`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Current size={17} color={colors.textSecondary} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <SheetTitle>Appearance</SheetTitle>
        <SheetSubtitle>Night mode for the whole app</SheetSubtitle>
        <View accessibilityRole="radiogroup" style={styles.list}>
          {OPTIONS.map(({ value, label, sub, Icon }, i) => {
            const on = value === preference;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setSchemePreference(value);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.row, i < OPTIONS.length - 1 && styles.divider, on && styles.rowOn, pressed && styles.pressed]}>
                <View style={[styles.icon, on && styles.iconOn]}>
                  <Icon size={18} color={on ? colors.brandPrimary : colors.textSecondary} />
                </View>
                <View style={styles.text}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.sub}>{sub}</Text>
                </View>
                {on ? (
                  <View style={styles.check}>
                    <CheckIcon size={12} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
    list: { borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: 14 },
    rowOn: { backgroundColor: colors.brandWash },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    iconOn: { backgroundColor: colors.brandTint },
    text: { flex: 1, minWidth: 0 },
    label: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
    sub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 3 },
    check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandFill, alignItems: 'center', justifyContent: 'center' },
  });
