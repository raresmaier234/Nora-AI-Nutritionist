import { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BarcodeIcon, CameraIcon, PlusIcon, RecipeIcon, SearchIcon } from '@/components/log/icons';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogShadow, LogSpace } from '@/constants/log-theme';

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
              <Icon size={15} color={LogColor.brandPrimary} />
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
    gap: LogSpace.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: LogSpace.md,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    backgroundColor: LogColor.bgSurfaceSolid,
    borderRadius: LogRadius.md,
    boxShadow: LogShadow.sm,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: LogColor.chipIndigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.nano,
    color: LogColor.textPrimary,
  },
});
