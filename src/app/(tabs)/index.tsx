import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalorieSummaryCard } from '@/components/log/calorie-summary-card';
import { DateNavigator } from '@/components/log/date-navigator';
import { FoodRow } from '@/components/log/food-row';
import { AddFoodPanel } from '@/components/log/panels/add-food-panel';
import { BarcodeScannerPanel } from '@/components/log/panels/barcode-scanner-panel';
import { CustomFoodPanel } from '@/components/log/panels/custom-food-panel';
import { FoodDetailPanel } from '@/components/log/panels/food-detail-panel';
import { PhotoEstimatePanel } from '@/components/log/panels/photo-estimate-panel';
import { RecipesPanel } from '@/components/log/panels/recipes-panel';
import { QuickEntryAction, QuickEntryRow } from '@/components/log/quick-entry-row';
import { Stat } from '@/components/log/stat';
import { WaterTracker } from '@/components/log/water-tracker';
import { Sheet } from '@/components/ui/sheet';
import { ToastOverlay, useToastHost } from '@/components/ui/toast';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogShadow, LogSpace } from '@/constants/log-theme';
import { Entry, FOOD_DB, MEALS, MealName, entryMacros } from '@/data/log-mock-data';
import { useFoodLog } from '@/hooks/use-food-log';

const ANCHOR_DATE = new Date(2026, 7, 11); // matches the fixed demo date in LogPageV3.jsx

type SheetMode = 'photo' | 'scan' | 'recipes' | 'custom' | null;

export default function LogScreen() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const insets = useSafeAreaInsets();
  const { notify, toast } = useToastHost();
  const foodLog = useFoodLog(notify);

  const [dayOffset, setDayOffset] = useState(0);
  const [detail, setDetail] = useState<{ meal: MealName; entry: Entry } | null>(null);
  const [adding, setAdding] = useState<MealName | null>(null);
  const [mode, setMode] = useState<SheetMode>(null);
  const [targetMeal, setTargetMeal] = useState<MealName>('Breakfast');
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)) : FOOD_DB;
  }, [query]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={LogColor.brandPrimary} />
      </View>
    );
  }

  const liveDetailEntry = detail ? foodLog.entries[detail.meal].find((e) => e.uid === detail.entry.uid) ?? detail.entry : null;

  const handleOpenFlowFromAdd = (action: Exclude<QuickEntryAction, 'search'>) => {
    if (adding) setTargetMeal(adding);
    setAdding(null);
    setQuery('');
    setMode(action);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + LogSpace.xxl }]}
        showsVerticalScrollIndicator={false}>
        <DateNavigator dayOffset={dayOffset} onChange={setDayOffset} anchorDate={ANCHOR_DATE} />

        <CalorieSummaryCard
          totals={foodLog.totals}
          remaining={foodLog.remaining}
          pct={foodLog.pct}
          over={foodLog.over}
          onCopyYesterday={foodLog.copyYesterday}
        />

        <QuickEntryRow
          onSelect={(action) => {
            if (action === 'search') {
              setAdding(targetMeal);
            } else {
              setMode(action);
            }
          }}
        />

        {MEALS.map((meal) => {
          const items = foodLog.entries[meal];
          const mealKcal = items.reduce((a, e) => a + entryMacros(e).kcal, 0);
          return (
            <View key={meal}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{meal}</Text>
                <Text style={styles.mealKcal}>{mealKcal} kcal</Text>
              </View>
              <View style={styles.mealCard}>
                {items.length === 0 ? (
                  <View style={styles.emptyMeal}>
                    <Text style={styles.emptyMealText}>No food added yet</Text>
                    <Text
                      onPress={() => setAdding(meal)}
                      accessibilityRole="button"
                      style={styles.addFoodLink}>
                      + Add food
                    </Text>
                  </View>
                ) : (
                  <>
                    {items.map((e) => (
                      <FoodRow
                        key={e.uid}
                        name={e.name}
                        meta={`${e.amount} ${e.unit} · ${e.time}`}
                        trailing={`${entryMacros(e).kcal} kcal`}
                        onPress={() => setDetail({ meal, entry: e })}
                      />
                    ))}
                    <Text onPress={() => setAdding(meal)} accessibilityRole="button" style={styles.addFoodRow}>
                      + Add food
                    </Text>
                  </>
                )}
              </View>
            </View>
          );
        })}

        <WaterTracker water={foodLog.water} onChange={foodLog.setWater} />

        <View style={styles.statsRow}>
          <Stat value={foodLog.entryCount} label="entries" />
          <Stat value={`${foodLog.totals.protein}g`} label="protein" color={LogColor.brandPrimary} />
          <Stat value={`${foodLog.water * 250}ml`} label="water" color={LogColor.greenText} />
        </View>
      </ScrollView>

      {/* Food detail / edit sheet */}
      <Sheet visible={!!detail} onClose={() => setDetail(null)}>
        {detail && liveDetailEntry ? (
          <FoodDetailPanel
            meal={detail.meal}
            entry={liveDetailEntry}
            onChange={(patch) => foodLog.updateEntry(detail.meal, liveDetailEntry.uid, patch)}
            onSave={() => setDetail(null)}
            onDelete={() => {
              foodLog.removeEntry(detail.meal, liveDetailEntry.uid, liveDetailEntry.name);
              setDetail(null);
            }}
          />
        ) : null}
      </Sheet>

      {/* Photo estimate / barcode scan / recipes / custom food */}
      <Sheet visible={mode === 'photo'} onClose={() => setMode(null)}>
        <PhotoEstimatePanel
          meal={targetMeal}
          onMeal={setTargetMeal}
          onAdd={(items) => {
            foodLog.addPhotoItems(targetMeal, items);
            setMode(null);
          }}
        />
      </Sheet>
      <Sheet visible={mode === 'scan'} onClose={() => setMode(null)}>
        <BarcodeScannerPanel
          meal={targetMeal}
          onMeal={setTargetMeal}
          onAdd={(product) => {
            foodLog.addScanned(targetMeal, product);
            setMode(null);
          }}
        />
      </Sheet>
      <Sheet visible={mode === 'recipes'} onClose={() => setMode(null)}>
        <RecipesPanel
          meal={targetMeal}
          onMeal={setTargetMeal}
          onAddRecipe={(recipe, totals) => {
            foodLog.addRecipe(targetMeal, recipe, totals);
            setMode(null);
          }}
        />
      </Sheet>
      <Sheet visible={mode === 'custom'} onClose={() => setMode(null)}>
        <CustomFoodPanel
          meal={targetMeal}
          onMeal={setTargetMeal}
          onSave={(form) => {
            foodLog.saveCustom(targetMeal, form);
            setMode(null);
          }}
        />
      </Sheet>

      {/* Add food sheet */}
      <Sheet
        visible={!!adding}
        onClose={() => {
          setAdding(null);
          setQuery('');
        }}>
        {adding ? (
          <AddFoodPanel
            meal={adding}
            query={query}
            onQueryChange={setQuery}
            results={results}
            onPickFood={(food) => {
              foodLog.addEntry(adding, food);
              setAdding(null);
              setQuery('');
            }}
            onOpenFlow={handleOpenFlowFromAdd}
          />
        ) : null}
      </Sheet>

      <ToastOverlay toast={toast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LogColor.bgApp,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LogColor.bgApp,
  },
  content: {
    paddingHorizontal: LogSpace.xl,
    paddingTop: LogSpace.lg,
    gap: LogSpace.xl - 2,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
    marginBottom: LogSpace.sm + 2,
  },
  mealTitle: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.h2,
    color: LogColor.textPrimary,
  },
  mealKcal: {
    fontFamily: LogFontFamily.extrabold,
    fontSize: LogFontSize.small,
    color: LogColor.greenText,
  },
  mealCard: {
    backgroundColor: LogColor.bgSurfaceSolid,
    borderRadius: LogRadius.lg,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    boxShadow: LogShadow.sm,
  },
  emptyMeal: {
    alignItems: 'center',
    gap: LogSpace.sm,
    paddingVertical: 20,
    paddingHorizontal: LogSpace.lg,
  },
  emptyMealText: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.small,
    color: LogColor.textTertiary,
  },
  addFoodLink: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
    color: LogColor.brandPrimary,
  },
  addFoodRow: {
    paddingVertical: LogSpace.md,
    paddingHorizontal: LogSpace.lg - 2,
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
    color: LogColor.brandPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 26,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
