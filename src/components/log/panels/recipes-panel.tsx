import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RecipeIcon } from '@/components/log/icons';
import { MealPicker } from '@/components/log/meal-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { SectionLabel, SheetTitle } from '@/components/ui/typography';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace } from '@/constants/log-theme';
import { FOOD_DB, Macro, MealName, RECIPES, entryMacros } from '@/data/log-mock-data';

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
        <Pill label="Saved" selected={tab === 'saved'} onPress={() => setTab('saved')} fontSize={LogFontSize.small} flex />
        <Pill label="Build new" selected={tab === 'new'} onPress={() => setTab('new')} fontSize={LogFontSize.small} flex />
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
                  <RecipeIcon size={18} color={LogColor.brandPrimary} strokeWidth={2} />
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
                  fontSize={LogFontSize.micro}
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
    gap: LogSpace.sm,
    marginBottom: LogSpace.lg,
  },
  list: {
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.lg,
    overflow: 'hidden',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LogSpace.md,
    paddingVertical: LogSpace.md,
    paddingHorizontal: LogSpace.lg - 2,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: LogColor.borderSubtle },
  rowPressed: { backgroundColor: LogColor.overlayPress },
  starChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LogColor.chipIndigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeText: { flex: 1, minWidth: 0 },
  recipeName: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
  recipeMeta: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    marginTop: 3,
  },
  recipeKcal: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
    color: LogColor.textPrimary,
  },
  nameInput: { marginBottom: LogSpace.md },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: LogSpace.md,
  },
  totalsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: LogSpace.md + 2,
    backgroundColor: LogColor.successTint,
    borderRadius: LogRadius.md,
    marginBottom: LogSpace.lg - 2,
  },
  totalsKcal: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
  totalsMeta: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.micro,
    color: LogColor.textSecondary,
  },
});
