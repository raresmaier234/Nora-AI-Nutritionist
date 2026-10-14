import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FoodIconImage } from '@/components/log/food-icon';
import { SearchIcon } from '@/components/log/icons';
import { Sheet } from '@/components/ui/sheet';
import { SectionLabel, SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';
import { ICON_CHOICES, IconChoice, foodIllustration } from '@/features/food/food-icons';
import { setFoodIcon, useFoodIconOverride } from '@/features/food/icon-overrides';

const TILE = 52;

type FoodIconPickerProps = {
  visible: boolean;
  /** The food whose icon is being chosen; the choice applies to every food with this name. */
  name: string;
  onClose: () => void;
};

/** Pick any icon from the food icon library for a food, or go back to the automatic one. */
export function FoodIconPicker({ visible, name, onClose }: FoodIconPickerProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const picked = useFoodIconOverride(name);
  const auto = foodIllustration(name);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const groups = ICON_CHOICES.map((g) => ({
    ...g,
    icons: q && !g.label.toLowerCase().includes(q) ? g.icons.filter((i) => i.name.toLowerCase().includes(q)) : g.icons,
  })).filter((g) => g.icons.length > 0);

  const choose = (src: string | null) => {
    setFoodIcon(name, src);
    onClose();
  };

  const tile = (icon: IconChoice) => {
    const on = picked === icon.src;
    return (
      <Pressable
        key={icon.src}
        onPress={() => choose(icon.src)}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={icon.name}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
        <View style={[styles.ring, on && styles.ringOn]}>
          <FoodIconImage src={icon.src} tint={icon.tint} size={TILE} initial={icon.name} />
        </View>
        <Text style={[styles.tileLabel, on && styles.tileLabelOn]} numberOfLines={1}>
          {icon.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle>Choose icon</SheetTitle>
      <SheetSubtitle>For “{name}”, everywhere it appears</SheetSubtitle>

      <Pressable
        onPress={() => choose(null)}
        accessibilityRole="radio"
        accessibilityState={{ checked: !picked }}
        style={({ pressed }) => [styles.auto, !picked && styles.autoOn, pressed && styles.pressed]}>
        <FoodIconImage src={auto.src} tint={auto.tint} size={44} initial={name} />
        <View style={styles.autoText}>
          <Text style={styles.autoTitle}>Automatic</Text>
          <Text style={styles.autoSub}>Matched from the food’s name</Text>
        </View>
        {!picked ? <Text style={styles.autoBadge}>In use</Text> : null}
      </Pressable>

      <View style={styles.search}>
        <SearchIcon size={18} color={colors.textTertiary} strokeWidth={2.2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search icons, e.g. cheese"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Search icons"
          style={styles.searchInput}
        />
      </View>

      {groups.length === 0 ? <Text style={styles.none}>No icon matches “{query.trim()}”.</Text> : null}
      {groups.map((g) => (
        <View key={g.id} style={styles.group}>
          <SectionLabel>{g.label}</SectionLabel>
          <View accessibilityRole="radiogroup" style={styles.grid}>
            {g.icons.map(tile)}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    auto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: spacing.md,
    },
    autoOn: { borderColor: colors.brandPrimary, backgroundColor: colors.brandWash },
    autoText: { flex: 1, minWidth: 0 },
    autoTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
    autoSub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 3 },
    autoBadge: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.brandPrimary },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgApp,
      marginBottom: spacing.lg,
    },
    searchInput: { flex: 1, minWidth: 0, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary, padding: 0 },
    none: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
    group: { marginBottom: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: { width: TILE + 12, alignItems: 'center', gap: 5 },
    ring: { padding: 2, borderRadius: (TILE + 4) * 0.42, borderWidth: 2, borderColor: 'transparent' },
    ringOn: { borderColor: colors.brandPrimary },
    tileLabel: { width: TILE + 12, textAlign: 'center', fontFamily: fontFamily.medium, fontSize: fontSize.nano, color: colors.textTertiary },
    tileLabelOn: { fontFamily: fontFamily.bold, color: colors.brandPrimary },
  });
