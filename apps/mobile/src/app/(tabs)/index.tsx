import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppearanceButton } from '@/components/common/appearance-button';
import { CalorieSummaryCard } from '@/components/log/calorie-summary-card';
import { DateNavigator, dayLabels } from '@/components/log/date-navigator';
import { LogFoodBar } from '@/components/log/log-food-bar';
import { BarcodeScannerPanel } from '@/components/log/panels/barcode-scanner-panel';
import { CustomFoodPanel } from '@/components/log/panels/custom-food-panel';
import { PhotoEstimatePanel } from '@/components/log/panels/photo-estimate-panel';
import { RecipesPanel, StudioStart } from '@/components/log/panels/recipes-panel';
import { DayNutritionScreen } from '@/components/log/screens/day-nutrition-screen';
import { FoodDetailsScreen } from '@/components/log/screens/food-details-screen';
import { FoodSearchScreen, SearchMode } from '@/components/log/screens/food-search-screen';
import { RecipeStudioScreen } from '@/components/log/screens/recipe-studio-screen';
import { Timeline } from '@/components/log/timeline';
import { FullScreen, FullScreenLayer } from '@/components/ui/full-screen';
import { Sheet } from '@/components/ui/sheet';
import { ToastOverlay, useToastHost } from '@/components/ui/toast';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';
import { Entry, Food, Macro, RECIPES, Recipe, entryMacros, toGrams } from '@/features/food/data/mock-data';
import { shiftDate, toDateString, useFoodLog } from '@/features/food/hooks/use-food-log';
import { useTargets } from '@/features/food/hooks/use-targets';
import { recipeFood } from '@/features/food/recipes';
import { nowHHMM } from '@/features/food/time';
import type { BarcodeScanResult, PhotoCaptureResult } from '@/features/camera';

/** Room under the timeline so its last hour can scroll clear of the Log food bar. */
const LOG_BAR_CLEARANCE = 96;

const minus = (a: Macro, b: Macro): Macro => ({
  kcal: a.kcal - b.kcal,
  protein: a.protein - b.protein,
  carbs: a.carbs - b.carbs,
  fat: a.fat - b.fat,
});

export default function LogScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    scannedBarcodeData?: string;
    scannedBarcodeType?: string;
    capturedPhotoUri?: string;
  }>();
  const { notify, toast } = useToastHost();

  // Fixed for the screen's lifetime: "today" is the day the app was opened on.
  const [today] = useState(() => new Date());
  const [dayOffset, setDayOffset] = useState(0);
  const date = shiftDate(toDateString(today), dayOffset);
  const foodLog = useFoodLog(date, notify);
  const targets = useTargets();
  /** Entry being edited in Food Details. */
  const [detail, setDetail] = useState<Entry | null>(null);
  /** The day's full nutrition, opened from the summary card. */
  const [showDay, setShowDay] = useState(false);
  /** Food opened from search, to add at `time`. */
  const [foodView, setFoodView] = useState<{ food: Food; time: string } | null>(null);
  /** "HH:MM" while full-screen search is open, logging at that time. */
  const [adding, setAdding] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode | null>(null);
  /** A flow chosen in search, opened once search has finished closing. */
  const [pendingFlow, setPendingFlow] = useState<SearchMode | null>(null);
  /** Time for the photo / scan / recipe / custom flows. */
  const [targetTime, setTargetTime] = useState(nowHHMM);
  /** Saved recipes — in memory until there is a recipes endpoint. */
  const [recipes, setRecipes] = useState<Recipe[]>(RECIPES);
  /** Recipe Studio, open on a saved recipe or a new one. `key` is fixed per opening. */
  const [studio, setStudio] = useState<{ recipe: Recipe | null; start?: StudioStart; key: number } | null>(null);
  /** A saved recipe open in Food Details — over the studio, or on its own from the list. */
  const [recipeView, setRecipeView] = useState<Recipe | null>(null);
  /** What to open once the Recipes sheet has finished closing. */
  const [afterRecipes, setAfterRecipes] = useState<(() => void) | null>(null);
  const [scanResult, setScanResult] = useState<BarcodeScanResult | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoCaptureResult | null>(null);
  /** The camera to open once the Photo / Barcode sheet has finished closing. */
  const [pendingCamera, setPendingCamera] = useState<'scan' | 'photo' | null>(null);

  // The Sheet is a React Native Modal, which always renders above whatever the navigator pushes
  // next — so it has to close before the full-screen camera route opens, and reopen once the
  // camera route returns a result via router.dismissTo (see src/app/camera/*.tsx).
  const openCamera = (kind: 'scan' | 'photo') => {
    router.push(kind === 'scan' ? '/camera/barcode' : '/camera/photo');
  };
  // From the Photo / Barcode sheet: only once it has finished closing. Pushed while the sheet
  // is still animating out, iOS presents the camera from the sheet's window, and the camera's
  // close button can no longer dismiss it.
  const openCameraFromSheet = (kind: 'scan' | 'photo') => {
    setPendingCamera(kind);
    setMode(null);
  };
  const onCameraSheetDismissed = () => {
    if (!pendingCamera) return;
    const kind = pendingCamera;
    setPendingCamera(null);
    openCamera(kind);
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

  // Search's Photo / Barcode / Recipes / Custom tiles: close search, then open that flow at the
  // time search was logging at. Not straight away: iOS can't present a sheet or push the camera
  // while the search modal is still sliding out — it waits for search's onDismissed.
  const openFlow = (next: SearchMode) => {
    if (adding) setTargetTime(adding);
    setPendingFlow(next);
    closeSearch();
  };
  const closeSearch = () => {
    setFoodView(null);
    setAdding(null);
  };
  const onSearchDismissed = () => {
    if (!pendingFlow) return;
    const next = pendingFlow;
    setPendingFlow(null);
    if (next === 'scan' || next === 'photo') {
      openCamera(next);
    } else {
      setMode(next);
    }
  };

  // ---- Recipes ------------------------------------------------------------------------
  const saveRecipe = (r: Recipe): Recipe => {
    const rec = { ...r, id: r.id || `r${Date.now()}` };
    setRecipes((list) => (list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? rec : x)) : [rec, ...list]));
    return rec;
  };
  const closeRecipePages = () => {
    setStudio(null);
    setRecipeView(null);
  };
  // The Recipes sheet hands over to a full-screen page; iOS can only present it once the
  // sheet has finished closing.
  const fromRecipes = (open: () => void) => {
    setAfterRecipes(() => open);
    setMode(null);
  };
  const onRecipesDismissed = () => {
    if (!afterRecipes) return;
    afterRecipes();
    setAfterRecipes(null);
  };
  /** Logs `servingsEaten` servings of the recipe as one entry, at the recipe's density. */
  const logRecipe = (r: Recipe, servingsEaten: number) => {
    const rec = saveRecipe(r);
    const { food, servings } = recipeFood(rec);
    foodLog.addEntry(targetTime, food, Math.round(servings[0][1] * servingsEaten), 'g');
    closeRecipePages();
  };
  const viewed = recipeView ? recipeFood(recipeView) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + LOG_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <AppearanceButton />
        </View>
        <DateNavigator dayOffset={dayOffset} onChange={setDayOffset} anchorDate={today} />

        <CalorieSummaryCard
          totals={foodLog.totals}
          remaining={foodLog.remaining}
          pct={foodLog.pct}
          over={foodLog.over}
          onPress={() => setShowDay(true)}
        />

        {foodLog.loadState === 'loading' ? (
          <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Loading your log" />
        ) : null}
        {foodLog.loadState === 'error' ? (
          <View style={styles.loadError}>
            <Text style={styles.loadErrorText}>{foodLog.loadError}</Text>
            <Text onPress={foodLog.reload} accessibilityRole="button" style={styles.retry}>
              Retry
            </Text>
          </View>
        ) : null}

        <Timeline entries={foodLog.entries} isToday={dayOffset === 0} onOpenEntry={setDetail} onAddAt={setAdding} />
      </ScrollView>

      <LogFoodBar onPress={() => setAdding(nowHHMM())} bottomInset={insets.bottom} />

      {/* The day's totals: macros, fibre, vitamins, minerals, and what's left of each */}
      <FullScreen visible={showDay} onClose={() => setShowDay(false)}>
        {showDay ? (
          <DayNutritionScreen
            {...dayLabels(today, dayOffset)}
            entries={foodLog.entries}
            totals={foodLog.totals}
            onClose={() => setShowDay(false)}
          />
        ) : null}
      </FullScreen>

      {/* Edit a logged entry */}
      <FullScreen visible={!!detail} onClose={() => setDetail(null)}>
        {detail ? (
          <FoodDetailsScreen
            key={`edit-${detail.uid}`}
            mode="edit"
            food={detail}
            time={detail.time}
            initialGrams={toGrams(detail.amount, detail.unit)}
            consumed={minus(foodLog.totals, entryMacros(detail))}
            onClose={() => setDetail(null)}
            onSave={(change) => {
              foodLog.changeEntry(detail.uid, change);
              setDetail(null);
            }}
            onDelete={() => {
              foodLog.removeEntry(detail.uid, detail.name);
              setDetail(null);
            }}
          />
        ) : null}
      </FullScreen>

      {/* Add food — full-screen search, with Food Details on top of it. Details is a layer inside
          the search modal, never a second modal: closing two nested modals at once on iOS can
          leave a black screen. */}
      <FullScreen
        visible={!!adding}
        onClose={() => (foodView ? setFoodView(null) : closeSearch())}
        onDismissed={onSearchDismissed}>
        {adding ? (
          <FoodSearchScreen
            time={adding}
            onTimeChange={setAdding}
            entries={foodLog.entries}
            remainingKcal={targets.kcal - foodLog.totals.kcal}
            onOpenFood={(food) => setFoodView({ food, time: adding })}
            onQuickAdd={(food, grams) => foodLog.addEntry(adding, food, grams, 'g')}
            onMode={openFlow}
            onClose={closeSearch}
          />
        ) : null}
        {foodView ? (
          <FullScreenLayer>
            <FoodDetailsScreen
              key={`add-${foodView.food.id}`}
              mode="add"
              food={foodView.food}
              time={foodView.time}
              consumed={foodLog.totals}
              onClose={() => setFoodView(null)}
              onAdd={({ time, amount, unit }) => {
                foodLog.addEntry(time, foodView.food, amount, unit);
                closeSearch();
              }}
            />
          </FullScreenLayer>
        ) : null}
        {/* A modal covers the screen's own toast; quick-add confirms here. */}
        <ToastOverlay toast={toast} />
      </FullScreen>

      {/* Photo estimate / barcode scan / recipes / custom food */}
      <Sheet
        visible={mode === 'photo'}
        onClose={() => {
          setMode(null);
          setPhotoResult(null);
        }}
        onDismissed={onCameraSheetDismissed}>
        <PhotoEstimatePanel
          time={targetTime}
          onTime={setTargetTime}
          onOpenCamera={() => openCameraFromSheet('photo')}
          photoResult={photoResult}
          onAdd={(items) => {
            foodLog.addPhotoItems(targetTime, items);
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
        }}
        onDismissed={onCameraSheetDismissed}>
        <BarcodeScannerPanel
          time={targetTime}
          onTime={setTargetTime}
          onOpenCamera={() => openCameraFromSheet('scan')}
          scanResult={scanResult}
          onAdd={(product) => {
            foodLog.addScanned(targetTime, product);
            setMode(null);
            setScanResult(null);
          }}
        />
      </Sheet>
      <Sheet visible={mode === 'recipes'} onClose={() => setMode(null)} onDismissed={onRecipesDismissed}>
        <RecipesPanel
          recipes={recipes}
          onOpen={(recipe, start) => fromRecipes(() => setStudio({ recipe, start, key: Date.now() }))}
          onView={(recipe) => fromRecipes(() => setRecipeView(recipe))}
        />
      </Sheet>
      <Sheet visible={mode === 'custom'} onClose={() => setMode(null)}>
        <CustomFoodPanel
          time={targetTime}
          onTime={setTargetTime}
          onSave={(form) => {
            foodLog.saveCustom(targetTime, form);
            setMode(null);
          }}
        />
      </Sheet>

      {/* Recipe Studio, with a saved recipe's Food Details as a layer over it (never a second
          modal — see FullScreen). Details opened from the recipe list stand alone. */}
      <FullScreen
        visible={!!studio || !!recipeView}
        background={colors.bgApp}
        onClose={() => (studio && recipeView ? setRecipeView(null) : closeRecipePages())}>
        {studio ? (
          <RecipeStudioScreen
            key={studio.key}
            initial={studio.recipe}
            start={studio.start}
            time={targetTime}
            onTimeChange={setTargetTime}
            onClose={closeRecipePages}
            onSave={(r) => {
              const rec = saveRecipe(r);
              closeRecipePages();
              notify('success', `"${rec.name}" saved to your recipes.`);
            }}
            onLog={logRecipe}
            onDetails={(r) => {
              const rec = saveRecipe(r);
              // Further edits in the studio now update this saved recipe.
              setStudio((s) => (s ? { ...s, recipe: rec } : s));
              setRecipeView(rec);
            }}
          />
        ) : null}
        {recipeView && viewed ? (
          <FullScreenLayer>
            <FoodDetailsScreen
              key={`recipe-${recipeView.id}`}
              mode="add"
              food={viewed.food}
              servings={viewed.servings}
              time={targetTime}
              consumed={foodLog.totals}
              onClose={() => (studio ? setRecipeView(null) : closeRecipePages())}
              onAdd={({ time, amount, unit }) => {
                foodLog.addEntry(time, viewed.food, amount, unit);
                closeRecipePages();
              }}
            />
          </FullScreenLayer>
        ) : null}
        <ToastOverlay toast={toast} />
      </FullScreen>

      <ToastOverlay toast={toast} />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgApp,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.xl - 2,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: -spacing.sm,
  },
  loadError: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  loadErrorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retry: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.brandPrimary,
  },
});
