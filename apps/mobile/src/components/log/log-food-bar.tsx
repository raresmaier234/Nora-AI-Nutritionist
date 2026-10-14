import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlusIcon, SearchIcon } from '@/components/log/icons';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

type LogFoodBarProps = { onPress: () => void; bottomInset: number };

/**
 * Sticky primary action, always reachable above the tab bar while the timeline scrolls — the
 * single entry point to full-screen search (photo, barcode, recipes and custom live inside it).
 */
export function LogFoodBar({ onPress, bottomInset }: LogFoodBarProps) {
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomInset + spacing.sm }]}>
      <LinearGradient pointerEvents="none" colors={['rgba(248,250,252,0)', colors.bgApp]} locations={[0, 0.42]} style={StyleSheet.absoluteFill} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Log food"
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
        <SearchIcon size={20} color={colors.textTertiary} strokeWidth={2.2} />
        <View style={styles.text}>
          <Text style={styles.title}>Log food</Text>
          <Text style={styles.subtitle}>Search, scan or snap a photo</Text>
        </View>
        <View style={styles.plus}>
          <PlusIcon size={20} color={colors.white} strokeWidth={2.6} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 18, paddingHorizontal: spacing.xl },
  bar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    paddingLeft: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurfaceSolid,
    boxShadow: '0px 10px 28px rgba(17,24,39,0.12), 0px 2px 6px rgba(17,24,39,0.06)',
  },
  pressed: { transform: [{ scale: 0.985 }] },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 2 },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
});
