import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodIcon } from '@/components/log/food-icon';
import { BarcodeIcon, CameraIcon, CheckIcon, ChevronLeftIcon, CloseIcon, PlusIcon, RecipeIcon, SearchIcon } from '@/components/log/icons';
import { WhenPicker } from '@/components/log/when-picker';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';
import { Entry, Food } from '@/features/food/data/mock-data';
import { describeError } from '@/features/food/hooks/use-food-log';
import { useFoodColors } from '@/features/food/theme';
import { searchFoods } from '@/services/api';

/** Wait this long after the last keystroke before searching, so typing "milk" is one request. */
const SEARCH_DEBOUNCE_MS = 300;
/** API foods carry no serving sizes yet, so search rows and quick-add use 100 g. */
const DEFAULT_GRAMS = 100;

export type SearchMode = 'photo' | 'scan' | 'recipes' | 'custom';

const actions = (colors: Palette): Array<{ mode: SearchMode; label: string; tint: string; ink: string; icon: (c: string) => React.ReactNode }> => [
  { mode: 'photo', label: 'Photo', tint: colors.brandTint, ink: colors.brandPrimary, icon: (c) => <CameraIcon size={19} color={c} /> },
  { mode: 'scan', label: 'Barcode', tint: colors.chipAmberTint, ink: colors.amberText, icon: (c) => <BarcodeIcon size={19} color={c} /> },
  { mode: 'recipes', label: 'Recipes', tint: colors.chipGreenTint, ink: colors.greenText, icon: (c) => <RecipeIcon size={19} color={c} /> },
  { mode: 'custom', label: 'Custom', tint: colors.surfaceMuted, ink: colors.textSecondary, icon: (c) => <PlusIcon size={19} color={c} /> },
];

type FoodSearchScreenProps = {
  /** "HH:MM" every item lands at. */
  time: string;
  onTimeChange: (time: string) => void;
  /** The day's entries, for the Recent and Frequent tabs. */
  entries: Entry[];
  remainingKcal: number;
  onOpenFood: (food: Food) => void;
  onQuickAdd: (food: Food, grams: number) => void;
  onMode: (mode: SearchMode) => void;
  onClose: () => void;
};

/**
 * Full-screen food search (FoodSearchV3.jsx). Header — back, title, time, search — stays
 * pinned; results scroll beneath it. Tap a row for Food Details; tap + to quick-add without
 * leaving search.
 */
export function FoodSearchScreen({ time, onTimeChange, entries, remainingKcal, onOpenFood, onQuickAdd, onMode, onClose }: FoodSearchScreenProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'recent' | 'frequent'>('recent');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 240);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    setSearchError(null);
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchFoods(q)
        .then((found) => {
          if (!cancelled) setResults(found.map((f) => ({ id: String(f.id), name: f.name, per100: f.per_100g })));
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setResults([]);
          setSearchError(describeError(err));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    // A response to an older query must never replace the results of the newer one.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Only database foods can be logged again by id; custom, photo and recipe entries are one-offs.
  const loggable = useMemo(() => entries.filter((e) => /^\d+$/.test(e.id)), [entries]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    [...loggable]
      .sort((a, b) => b.uid - a.uid)
      .forEach((e) => {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          out.push({ id: e.id, name: e.name, per100: e.per100 });
        }
      });
    return out.slice(0, 8);
  }, [loggable]);
  const frequent = useMemo(() => {
    const n = new Map<string, number>();
    loggable.forEach((e) => n.set(e.id, (n.get(e.id) ?? 0) + 1));
    return [...recent].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [loggable, recent]);

  const q = query.trim();
  const list = q ? results : tab === 'recent' ? recent : frequent;

  return (
    <View style={styles.root}>
      {/* Pinned header */}
      <View style={[styles.header, { paddingTop: Math.max(14, insets.top) }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close search" style={styles.back}>
            <ChevronLeftIcon size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.titleCol}>
            <Text style={styles.title}>Add food</Text>
            <Text style={styles.subtitle}>
              {remainingKcal >= 0 ? (
                <>
                  <Text style={styles.left}>{remainingKcal.toLocaleString()} kcal</Text> left today
                </>
              ) : (
                <>
                  <Text style={styles.over}>{(-remainingKcal).toLocaleString()} kcal</Text> over today
                </>
              )}
            </Text>
          </View>
        </View>
        {/* When — every item lands on the timeline at this time */}
        <WhenPicker value={time} onChange={onTimeChange} label="Eaten at" compact />
        <View style={styles.field}>
          <SearchIcon size={20} color={colors.textTertiary} strokeWidth={2.2} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Search foods"
            returnKeyType="search"
            style={styles.input}
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clear}>
              <View style={styles.clearDot}>
                <CloseIcon size={11} color={colors.white} strokeWidth={3.4} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Scrolling body */}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom) }}>
        {!q ? (
          <View style={styles.actions}>
            {actions(colors).map((a) => (
              <Pressable
                key={a.mode}
                onPress={() => onMode(a.mode)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <View style={[styles.actionIcon, { backgroundColor: a.tint }]}>{a.icon(a.ink)}</View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* List header: tabs when browsing, count when searching */}
        <View style={[styles.listHeader, q ? styles.listHeaderSearch : styles.listHeaderTabs]}>
          {q ? (
            <Text style={styles.count}>
              {searching ? 'Searching…' : searchError ? 'Search failed' : `${results.length} result${results.length === 1 ? '' : 's'}`}
            </Text>
          ) : (
            (
              [
                ['recent', 'Recent'],
                ['frequent', 'Frequent'],
              ] as const
            ).map(([k, l]) => (
              <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={[styles.tab, tab === k && styles.tabOn]}>
                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{l}</Text>
              </Pressable>
            ))
          )}
        </View>

        {searching ? (
          <ActivityIndicator color={colors.brandPrimary} style={styles.spinner} accessibilityLabel="Searching" />
        ) : searchError ? (
          <Text style={styles.message}>{searchError}</Text>
        ) : q && results.length === 0 ? (
          <View style={styles.empty}>
            <FoodIcon generic size={64} />
            <Text style={styles.emptyTitle}>No results for &quot;{q}&quot;</Text>
            <Text style={styles.emptyBody}>Check the spelling, scan the package, or add it yourself.</Text>
            <View style={styles.emptyActions}>
              <Pressable onPress={() => onMode('scan')} accessibilityRole="button" style={[styles.emptyButton, styles.emptySecondary]}>
                <Text style={styles.emptySecondaryText}>Scan barcode</Text>
              </Pressable>
              <Pressable onPress={() => onMode('custom')} accessibilityRole="button" style={[styles.emptyButton, styles.emptyPrimary]}>
                <Text style={styles.emptyPrimaryText}>Create food</Text>
              </Pressable>
            </View>
          </View>
        ) : !q && list.length === 0 ? (
          <Text style={styles.message}>Foods you log today appear here, ready to add again in one tap.</Text>
        ) : (
          list.map((f, i) => (
            <View key={f.id} style={i < list.length - 1 && styles.rowDivider}>
              <SearchRow food={f} query={q} onOpen={() => onOpenFood(f)} onQuickAdd={() => onQuickAdd(f, DEFAULT_GRAMS)} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const colors = useColors();
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Text style={{ color: colors.brandPrimary }}>{text.slice(i, i + query.length)}</Text>
      {text.slice(i + query.length)}
    </>
  );
}

const round = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

function SearchRow({ food, query, onOpen, onQuickAdd }: { food: Food; query: string; onOpen: () => void; onQuickAdd: () => void }) {
  const macro = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const f = DEFAULT_GRAMS / 100;
  const kcal = Math.round(food.per100.kcal * f);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(t);
  }, [added]);
  const macros: Array<[string, number, string]> = [
    ['P', food.per100.protein, macro.accentProtein],
    ['C', food.per100.carbs, macro.accentCarbs],
    ['F', food.per100.fat, macro.warnFat],
  ];
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <FoodIcon name={food.name} size={48} />
      <View style={styles.rowText}>
        <Text style={styles.rowName}>
          <Highlight text={food.name} query={query} />
        </Text>
        <Text style={styles.rowServing}>{DEFAULT_GRAMS} g</Text>
        <View style={styles.rowMacros}>
          {macros.map(([k, v, c]) => (
            <View key={k} style={styles.rowMacro}>
              <View style={[styles.macroDot, { backgroundColor: c }]} />
              <Text style={styles.rowMacroText}>
                {round(v * f)}g {k}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.rowKcal}>
        <Text style={styles.rowKcalValue}>{kcal}</Text>
        <Text style={styles.rowKcalUnit}>kcal</Text>
      </View>
      <Pressable
        onPress={() => {
          if (added) return;
          setAdded(true);
          onQuickAdd();
        }}
        accessibilityRole="button"
        accessibilityLabel={added ? `${food.name} added` : `Quick add ${food.name}`}
        style={[styles.quickAdd, added && styles.quickAdded]}>
        {added ? <CheckIcon size={18} color={colors.white} /> : <PlusIcon size={18} color={colors.brandPrimary} strokeWidth={2.6} />}
      </Pressable>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSurfaceSolid },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg },
  back: { width: 44, height: 44, marginLeft: -10, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  titleCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: colors.textPrimary, letterSpacing: trackTight(fontSize.h1) },
  subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 3 },
  left: { fontFamily: fontFamily.bold, color: colors.greenText },
  over: { fontFamily: fontFamily.bold, color: colors.errorText },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
  },
  input: { flex: 1, minWidth: 0, fontFamily: fontFamily.medium, fontSize: 16, color: colors.textPrimary, padding: 0 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clearDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.slate300, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 18, paddingHorizontal: spacing.xl, paddingBottom: 6 },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: 11,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurfaceSolid,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textPrimary },
  pressed: { backgroundColor: colors.overlayPress },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: spacing.xl },
  listHeaderSearch: { paddingTop: 18, paddingBottom: 6 },
  listHeaderTabs: { paddingTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  count: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    letterSpacing: trackWide(fontSize.micro),
    textTransform: 'uppercase',
  },
  tab: { minHeight: 44, paddingTop: 10, paddingBottom: spacing.md, justifyContent: 'center' },
  tabOn: { borderBottomWidth: 2.5, borderBottomColor: colors.brandPrimary },
  tabText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textTertiary },
  tabTextOn: { color: colors.textPrimary },
  spinner: { marginTop: spacing.xxl },
  message: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxxl,
  },
  empty: { alignItems: 'center', paddingTop: 36, paddingHorizontal: spacing.xxxl, paddingBottom: spacing.xl },
  emptyTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', maxWidth: 270 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  emptyButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  emptySecondary: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.bgSurfaceSolid },
  emptySecondaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  emptyPrimary: { backgroundColor: colors.brandFill },
  emptyPrimaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textOnBrand },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: spacing.xl, minHeight: 76 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  rowServing: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 3 },
  rowMacros: { flexDirection: 'row', gap: spacing.md, marginTop: 6 },
  rowMacro: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  macroDot: { width: 7, height: 7, borderRadius: 3.5 },
  rowMacroText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textSecondary },
  rowKcal: { alignItems: 'flex-end', flexShrink: 0 },
  rowKcalValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, letterSpacing: trackTight(fontSize.h2) },
  rowKcalUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 3 },
  quickAdd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
    flexShrink: 0,
  },
  quickAdded: { backgroundColor: colors.successFill },
});
