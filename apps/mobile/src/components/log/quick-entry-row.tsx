import { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BarcodeIcon, CameraIcon, PlusIcon, RecipeIcon, SearchIcon } from '@/components/log/icons';
import { colors, fontFamily, fontSize, radius, shadows, spacing } from '@/theme';

export type QuickEntryAction = 'search' | 'photo' | 'scan' | 'recipes' | 'custom';

const TILES: Array<{ action: QuickEntryAction; label: string }> = [
  { action: 'search', label: 'Search' },
  { action: 'photo', label: 'Photo' },
  { action: 'scan', label: 'Scan' },
  { action: 'recipes', label: 'Recipes' },
  { action: 'custom', label: 'Custom' },
];

const ICONS: Record<QuickEntryAction, ComponentType<{ size?: number; color?: string }>> = {
  search: SearchIcon,
  photo: CameraIcon,
  scan: BarcodeIcon,
  recipes: RecipeIcon,
  custom: PlusIcon,
};

type QuickEntryRowProps = { onSelect: (action: QuickEntryAction) => void };

export function QuickEntryRow({ onSelect }: QuickEntryRowProps) {
  return (
    <View style={styles.row}>
      {TILES.map(({ action, label }) => {
        const Icon = ICONS[action];
        return (
          <Pressable key={action} onPress={() => onSelect(action)} accessibilityRole="button" style={styles.tile}>
            <View style={styles.iconChip}>
              <Icon size={15} color={colors.brandPrimary} />
            </View>
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: radius.md,
    boxShadow: shadows.sm,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.chipIndigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.nano,
    color: colors.textPrimary,
  },
});
