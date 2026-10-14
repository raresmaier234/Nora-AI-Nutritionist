import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodIcon } from '@/components/log/food-icon';
import { CameraIcon, ChevronRightIcon, LinkIcon, PencilIcon, PlusIcon } from '@/components/log/icons';
import { SectionLabel, SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';
import { Recipe } from '@/features/food/data/mock-data';
import { recipeFood, recipeTotals } from '@/features/food/recipes';

export type StudioStart = 'scratch' | 'photo' | 'link';

type RecipesPanelProps = {
  recipes: Recipe[];
  /** Open Recipe Studio: a saved recipe to edit, or null to start a new one from `start`. */
  onOpen: (recipe: Recipe | null, start?: StudioStart) => void;
  /** Open a saved recipe in Food Details, to log it. */
  onView: (recipe: Recipe) => void;
};

/** Recipes hub (LogPageV3.jsx RecipesPanel): ways to create one, then the saved list. */
export function RecipesPanel({ recipes, onOpen, onView }: RecipesPanelProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const option = (start: StudioStart, title: string, sub: string, icon: ReactNode, tint: string, last?: boolean) => (
    <Pressable
      key={start}
      onPress={() => onOpen(null, start)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.option, !last && styles.divider, pressed && styles.pressed]}>
      <View style={[styles.optionIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.flex}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <ChevronRightIcon size={16} color={colors.textTertiary} strokeWidth={2.4} />
    </Pressable>
  );

  return (
    <View>
      <SheetTitle>Recipes</SheetTitle>
      <SheetSubtitle>Build a meal from its ingredients or import one. Saved recipes log like any food.</SheetSubtitle>

      <SectionLabel>Create</SectionLabel>
      <View style={[styles.group, styles.groupGap]}>
        {option('scratch', 'Build from ingredients', 'Search and add each ingredient', <PlusIcon size={19} color={colors.brandPrimary} />, colors.brandTint)}
        {option('photo', 'Import from photo', 'Recipe card, cookbook page or plate', <CameraIcon size={19} color={colors.amberText} />, colors.chipAmberTint)}
        {option('link', 'Import from link', 'Paste a recipe from any website', <LinkIcon size={19} color={colors.greenText} />, colors.chipGreenTint, true)}
      </View>

      <View style={styles.listHead}>
        <SectionLabel style={styles.noMargin}>Your recipes</SectionLabel>
        <Text style={styles.count}>{recipes.length}</Text>
      </View>
      {recipes.length === 0 ? (
        <Text style={styles.empty}>Recipes you save appear here, ready to log in one tap.</Text>
      ) : (
        <View style={styles.group}>
          {recipes.map((r, i) => {
            const perServing = Math.round(recipeTotals(r.items).kcal / (r.servings || 1));
            return (
              <View key={r.id} style={[styles.recipeRow, i < recipes.length - 1 && styles.divider]}>
                <Pressable
                  onPress={() => onView(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${r.name}`}
                  style={({ pressed }) => [styles.recipeMain, pressed && styles.pressed]}>
                  <FoodIcon name={recipeFood(r).iconName} size={44} />
                  <View style={styles.flex}>
                    <Text style={styles.recipeName}>{r.name}</Text>
                    <Text style={styles.recipeMeta}>
                      {r.items.length} ingredients · {r.servings} {r.servings === 1 ? 'serving' : 'servings'}
                      {r.source ? ` · ${r.source}` : ''}
                    </Text>
                  </View>
                  <View style={styles.kcal}>
                    <Text style={styles.kcalValue}>{perServing}</Text>
                    <Text style={styles.kcalUnit}>kcal/serving</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => onOpen(r)} accessibilityRole="button" accessibilityLabel={`Edit ${r.name}`} style={styles.edit}>
                  <PencilIcon size={17} color={colors.textTertiary} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  group: { borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, overflow: 'hidden' },
  groupGap: { marginBottom: 22 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  pressed: { backgroundColor: colors.overlayPress },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14 },
  optionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  optionSub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 3 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  noMargin: { marginBottom: 0 },
  count: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  empty: {
    paddingVertical: 22,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  recipeRow: { flexDirection: 'row', alignItems: 'center' },
  recipeMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, paddingVertical: spacing.md, paddingLeft: 14 },
  recipeName: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  recipeMeta: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 4 },
  kcal: { alignItems: 'flex-end', flexShrink: 0 },
  kcalValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.body, color: colors.textPrimary },
  kcalUnit: { fontFamily: fontFamily.medium, fontSize: fontSize.nano, color: colors.textTertiary, marginTop: 4 },
  edit: { width: 48, height: 48, marginRight: 6, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
