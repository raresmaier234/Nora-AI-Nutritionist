import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { colors, fontFamily, fontSize, radius, shadows, spacing } from '@/theme';
import { Entry, FOOD_DB, MEALS, MealName, entryMacros } from '@/features/food/data/mock-data';
import { useFoodLog } from '@/features/food/hooks/use-food-log';
import type { BarcodeScanResult, PhotoCaptureResult } from '@/features/camera';

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
  const router = useRouter();
  const params = useLocalSearchParams<{
    scannedBarcodeData?: string;
    scannedBarcodeType?: string;
    capturedPhotoUri?: string;
  }>();
  const { notify, toast } = useToastHost();
  const foodLog = useFoodLog(notify);

  const [dayOffset, setDayOffset] = useState(0);
  const [detail, setDetail] = useState<{ meal: MealName; entry: Entry } | null>(null);
  const [adding, setAdding] = useState<MealName | null>(null);
  const [mode, setMode] = useState<SheetMode>(null);
  const [targetMeal, setTargetMeal] = useState<MealName>('Breakfast');
  const [query, setQuery] = useState('');
  const [scanResult, setScanResult] = useState<BarcodeScanResult | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoCaptureResult | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)) : FOOD_DB;
  }, [query]);

  // The Sheet is a React Native Modal, which always renders above whatever the navigator pushes
  // next — so it has to close before the full-screen camera route opens, and reopen once the
  // camera route returns a result via router.dismissTo (see src/app/camera/*.tsx).
  const openCamera = (kind: 'scan' | 'photo') => {
    setMode(null);
    router.push(kind === 'scan' ? '/camera/barcode' : '/camera/photo');
  };

  useEffect(() => {
    if (params.scannedBarcodeData && params.scannedBarcodeType) {
      setScanResult({ data: params.scannedBarcodeData, type: params.scannedBarcodeType as BarcodeScanResult['type'] });
      setMode('scan');
      router.setParams({ scannedBarcodeData: '', scannedBarcodeType: '' });
    } else if (params.capturedPhotoUri) {
      setPhotoResult({ uri: params.capturedPhotoUri });
      setMode('photo');
      router.setParams({ capturedPhotoUri: '' });
    }
  }, [params.scannedBarcodeData, params.scannedBarcodeType, params.capturedPhotoUri, router]);

  useEffect(() => {
      fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1//health`, {
        method: 'GET'
      }).then(r =>  r.json());
    }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const liveDetailEntry = detail ? foodLog.entries[detail.meal].find((e) => e.uid === detail.entry.uid) ?? detail.entry : null;

  const handleOpenFlowFromAdd = (action: Exclude<QuickEntryAction, 'search'>) => {
    if (adding) setTargetMeal(adding);
    setAdding(null);
    setQuery('');
    if (action === 'scan' || action === 'photo') {
      openCamera(action);
    } else {
      setMode(action);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
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
            } else if (action === 'scan' || action === 'photo') {
              openCamera(action);
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
          <Stat value={`${foodLog.totals.protein}g`} label="protein" color={colors.brandPrimary} />
          <Stat value={`${foodLog.water * 250}ml`} label="water" color={colors.greenText} />
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
      <Sheet
        visible={mode === 'photo'}
        onClose={() => {
          setMode(null);
          setPhotoResult(null);
        }}>
        <PhotoEstimatePanel
          meal={targetMeal}
          onMeal={setTargetMeal}
          onOpenCamera={() => openCamera('photo')}
          photoResult={photoResult}
          onAdd={(items) => {
            foodLog.addPhotoItems(targetMeal, items);
            setMode(null);
            setPhotoResult(null);
          }}
        />
      </Sheet>
      <Sheet
        visible={mode === 'scan'}
        onClose={() => {
          setMode(null);
          setScanResult(null);
        }}>
        <BarcodeScannerPanel
          meal={targetMeal}
          onMeal={setTargetMeal}
          onOpenCamera={() => openCamera('scan')}
          scanResult={scanResult}
          onAdd={(product) => {
            foodLog.addScanned(targetMeal, product);
            setMode(null);
            setScanResult(null);
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
    backgroundColor: colors.bgApp,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgApp,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.xl - 2,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
    marginBottom: spacing.sm + 2,
  },
  mealTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h2,
    color: colors.textPrimary,
  },
  mealKcal: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.small,
    color: colors.greenText,
  },
  mealCard: {
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    boxShadow: shadows.sm,
  },
  emptyMeal: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 20,
    paddingHorizontal: spacing.lg,
  },
  emptyMealText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textTertiary,
  },
  addFoodLink: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.brandPrimary,
  },
  addFoodRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.brandPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 26,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
