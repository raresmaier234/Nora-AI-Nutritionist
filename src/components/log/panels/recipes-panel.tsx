import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RecipeIcon } from '@/components/log/icons';
import { MealPicker } from '@/components/log/meal-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { SectionLabel, SheetTitle } from '@/components/ui/typography';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { FOOD_DB, Macro, MealName, RECIPES, entryMacros } from '@/features/food/data/mock-data';

type RecipesPanelProps = {
  meal: MealName;
  onMeal: (meal: MealName) => void;
  onAddRecipe: (recipe: { id?: string; name: string }, totals: Macro) => void;
};

const ZERO: Macro = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function recipeTotals(items: Array<[string, number, string]>): Macro {
  return items.reduce((a, [id, amount, unit]) => {
    const f = FOOD_DB.find((x) => x.id === id);
    if (!f) return a;
    const m = entryMacros({ per100: f.per100, amount, unit });
    return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat };
  }, ZERO);
}

export function RecipesPanel({ meal, onMeal, onAddRecipe }: RecipesPanelProps) {
  const [tab, setTab] = useState<'saved' | 'new'>('saved');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Array<[string, number, string]>>([]);
  const draftTotals = recipeTotals(picked);

  return (
    <View>
      <SheetTitle>Recipes</SheetTitle>
      <View style={styles.tabRow}>
        <Pill label="Saved" selected={tab === 'saved'} onPress={() => setTab('saved')} fontSize={fontSize.small} flex />
        <Pill label="Build new" selected={tab === 'new'} onPress={() => setTab('new')} fontSize={fontSize.small} flex />
      </View>
      <MealPicker value={meal} onChange={onMeal} />

      {tab === 'saved' ? (
        <View style={styles.list}>
          {RECIPES.map((r, i) => {
            const t = recipeTotals(r.items);
            return (
              <Pressable
                key={r.id}
                onPress={() => onAddRecipe(r, t)}
                style={({ pressed }) => [
                  styles.recipeRow,
                  i < RECIPES.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}>
                <View style={styles.starChip}>
                  <RecipeIcon size={18} color={colors.brandPrimary} strokeWidth={2} />
                </View>
                <View style={styles.recipeText}>
                  <Text style={styles.recipeName}>{r.name}</Text>
                  <Text style={styles.recipeMeta}>
                    {r.items.length} ingredients · P{t.protein} C{t.carbs} F{t.fat}
                  </Text>
                </View>
                <Text style={styles.recipeKcal}>{t.kcal} kcal</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View>
          <Field style={styles.nameInput} value={name} onChangeText={setName} placeholder="Recipe name" />
          <SectionLabel>Ingredients ({picked.length})</SectionLabel>
          <View style={styles.chipWrap}>
            {FOOD_DB.slice(0, 8).map((f) => {
              const on = picked.some(([id]) => id === f.id);
              return (
                <Pill
                  key={f.id}
                  label={`${on ? '✓ ' : '+ '}${f.name}`}
                  selected={on}
                  onPress={() => setPicked((p) => (on ? p.filter(([id]) => id !== f.id) : [...p, [f.id, 100, 'g']]))}
                  fontSize={fontSize.micro}
                />
              );
            })}
          </View>
          {picked.length > 0 ? (
            <View style={styles.totalsStrip}>
              <Text style={styles.totalsKcal}>{draftTotals.kcal} kcal</Text>
              <Text style={styles.totalsMeta}>
                auto-calculated · P{draftTotals.protein} C{draftTotals.carbs} F{draftTotals.fat}
              </Text>
            </View>
          ) : null}
          <Button
            label={`Save & add to ${meal}`}
            disabled={!picked.length}
            onPress={() => onAddRecipe({ name: name || 'My recipe' }, draftTotals)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  rowPressed: { backgroundColor: colors.overlayPress },
  starChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.chipIndigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeText: { flex: 1, minWidth: 0 },
  recipeName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  recipeMeta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    marginTop: 3,
  },
  recipeKcal: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.textPrimary,
  },
  nameInput: { marginBottom: spacing.md },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  totalsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md + 2,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    marginBottom: spacing.lg - 2,
  },
  totalsKcal: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  totalsMeta: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.textSecondary,
  },
});
