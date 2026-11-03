import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { FoodIcon } from '@/components/log/food-icon';
import { BarcodeIcon, CameraIcon, ClockIcon, CloseIcon, PlusIcon, RecipeIcon, SearchIcon } from '@/components/log/icons';
import { TimePickerSheet } from '@/components/log/when-picker';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackWide, useColors, useStyles } from '@/theme';
import { findScannedFood } from '@/features/food/barcode';
import { Entry, Food, Macro, Targets, brandAndStore, toGrams } from '@/features/food/data/mock-data';
import { useFoodColors } from '@/features/food/theme';
import { useTargets } from '@/features/food/hooks/use-targets';
import { describeError, searchFoods } from '@/services/api';

/** Wait this long after the last keystroke before searching, so typing "milk" is one request. */
const SEARCH_DEBOUNCE_MS = 300;
/** Search results carry no portion of their own, so rows and quick-add use 100 g. */
const DEFAULT_GRAMS = 100;
/** Frequent foods shown as icons across the top: one row of them. */
const FREQUENT_COUNT = 5;
/** Searches remembered for the session, offered as chips in an empty search. */
const RECENT_SEARCHES = 6;
/** Digits only, the length of a retail barcode: offer to look it up. */
const BARCODE_RE = /^\d{8,14}$/;

// Kept for the session, across openings of this screen; the newest first. Read into state when
// the screen opens: the React Compiler memoizes render-time reads of module values.
let sessionSearches: string[] = [];
/** Adds `query` to the session's searches and returns them. */
function rememberSearch(query: string): string[] {
  const q = query.trim();
  if (q.length >= 2 && !BARCODE_RE.test(q)) {
    sessionSearches = [q, ...sessionSearches.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_SEARCHES);
  }
  return sessionSearches;
}

export type SearchMode = 'photo' | 'scan' | 'recipes' | 'custom';

/** A food in a list, with the grams quick-add logs: what was logged last time, else 100 g. */
type Listed = Food & { grams: number };

type FoodSearchScreenProps = {
  /** "HH:MM" every item lands at. */
  time: string;
  onTimeChange: (time: string) => void;
  /** The day's entries, for Frequent and Latest. */
  entries: Entry[];
  /** What's been eaten today, for the day ring and macro bars. */
  consumed: Macro;
  onOpenFood: (food: Food) => void;
  onQuickAdd: (food: Food, grams: number) => void;
  onMode: (mode: SearchMode) => void;
  onClose: () => void;
};

/**
 * Full-screen Add food. A top bar with the time and the day so far (a calorie ring and three
 * macro bars), tinted tiles for the ways to add (Scan, Search, AI, Quick Add, Library), then
 * Frequent foods as icons and the Latest as a list — or, while typing, the search results. The
 * search bar sits at the bottom and rises above the keyboard; focused, it offers recent searches, looks
 * up a typed barcode, and swaps Done for Cancel. Tap a food for Food Details; + logs it at once.
 */
export function FoodSearchScreen({ time, onTimeChange, entries, consumed, onOpenFood, onQuickAdd, onMode, onClose }: FoodSearchScreenProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const targets = useTargets();
  const { height: screenHeight } = useWindowDimensions();
  // The search bar scales with the screen: 44 px on a small phone to 52 on a tall one.
  const barHeight = Math.round(Math.min(52, Math.max(44, screenHeight * 0.056)));
  const inputRef = useRef<TextInputInstance>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Listed[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [barcodeNote, setBarcodeNote] = useState<string | null>(null);
  const [pickingTime, setPickingTime] = useState(false);
  const [recentSearches, setRecentSearches] = useState(sessionSearches);
  const remember = (query: string) => setRecentSearches(rememberSearch(query));

  // How far the keyboard covers this screen, measured when it opens: the screen's bottom edge
  // against the keyboard's top, both in window coordinates. KeyboardAvoidingView can't do it
  // here — it measures itself against its parent, below the top bar, so it under-lifts by that
  // much. Where Android has already resized the window for the keyboard, the overlap is 0.
  const rootRef = useRef<ViewInstance>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKeyboardInset(Math.max(0, y + h - keyboardTop)));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchFoods(q)
        .then((found) => {
          if (!cancelled) setResults(found.map((f) => ({ id: String(f.id), name: f.name, brand: f.brand, store: f.store, per100: f.per_100g, grams: DEFAULT_GRAMS })));
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
  const latest = useMemo(() => {
    const seen = new Set<string>();
    const out: Listed[] = [];
    for (const e of [...loggable].sort((a, b) => b.uid - a.uid)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ id: e.id, name: e.name, per100: e.per100, grams: Math.round(e.grams ?? toGrams(e.amount, e.unit)) });
    }
    return out.slice(0, 10);
  }, [loggable]);
  const frequent = useMemo(() => {
    const n = new Map<string, number>();
    loggable.forEach((e) => n.set(e.id, (n.get(e.id) ?? 0) + 1));
    return [...latest].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0)).slice(0, FREQUENT_COUNT);
  }, [loggable, latest]);

  const q = query.trim();
  const isBarcode = BARCODE_RE.test(q);
  // Clearing the field drops the results here, where the user acts, not in the search effect.
  const changeQuery = (text: string) => {
    setQuery(text);
    setBarcodeNote(null);
    if (!text.trim()) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
    }
  };
  const cancel = () => {
    changeQuery('');
    inputRef.current?.blur();
    Keyboard.dismiss();
  };
  const open = (food: Food) => {
    // Details has its own keypad; the search keyboard would sit over it.
    if (q) remember(q);
    Keyboard.dismiss();
    onOpenFood(food);
  };
  const quickAdd = (food: Listed) => {
    if (q) remember(q);
    onQuickAdd(food, food.grams);
  };
  const lookUpBarcode = () => {
    setBarcodeNote('Looking up…');
    findScannedFood(q).then(
      (hit) => (hit ? open(hit.food) : setBarcodeNote('No product with this barcode yet.')),
      (err: unknown) => setBarcodeNote(describeError(err)),
    );
  };

  const ways: { key: SearchMode | 'search'; label: string; tint: string; ink: string; icon: (c: string) => React.ReactNode }[] = [
    { key: 'scan', label: 'Scan', tint: colors.chipAmberTint, ink: colors.amberText, icon: (c) => <BarcodeIcon size={18} color={c} /> },
    { key: 'search', label: 'Search', tint: colors.brandTint, ink: colors.brandPrimary, icon: (c) => <SearchIcon size={18} color={c} strokeWidth={2.4} /> },
    { key: 'photo', label: 'AI photo', tint: colors.chipIndigoTint, ink: colors.brandPrimary, icon: (c) => <CameraIcon size={18} color={c} /> },
    { key: 'custom', label: 'Quick add', tint: colors.surfaceMuted, ink: colors.textSecondary, icon: (c) => <PlusIcon size={18} color={c} strokeWidth={2.4} /> },
    { key: 'recipes', label: 'Recipes', tint: colors.chipGreenTint, ink: colors.greenText, icon: (c) => <RecipeIcon size={18} color={c} /> },
  ];

  const showRecent = focused && !q && recentSearches.length > 0;

  return (
    <View ref={rootRef} style={[styles.root, { paddingTop: Math.max(10, insets.top) }]}>
      {/* Top bar: close, the time everything lands at, the day so far */}
      <View style={styles.topBar}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.roundButton}>
          <CloseIcon size={15} color={colors.textPrimary} strokeWidth={2.6} />
        </Pressable>
        <Pressable onPress={() => setPickingTime(true)} accessibilityRole="button" accessibilityLabel={`Eaten at ${time}. Change`} style={styles.timePill}>
          <ClockIcon size={14} color={colors.brandPrimary} />
          <Text style={styles.timeText}>{time}</Text>
        </Pressable>
        <DayStatus consumed={consumed} targets={targets} />
      </View>

      <View style={styles.sheet}>
        {/* Ways to add, as tinted tiles; Search is this screen */}
        <View accessibilityRole="tablist" style={styles.ways}>
          {ways.map((w) => {
            const on = w.key === 'search';
            return (
              <Pressable
                key={w.key}
                onPress={() => (w.key === 'search' ? inputRef.current?.focus() : onMode(w.key))}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.way, pressed && styles.pressedSoft]}>
                <View style={[styles.wayTile, { backgroundColor: w.tint }, on && styles.wayTileOn]}>
                  {on ? <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} /> : null}
                  {w.icon(on ? colors.white : w.ink)}
                </View>
                <Text style={[styles.wayText, on && styles.wayTextOn]} numberOfLines={1}>
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.flex, { paddingBottom: keyboardInset }]}>
          <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {showRecent ? (
              <>
                <Text style={styles.overline}>Recent searches</Text>
                <View style={styles.recentRow}>
                  {recentSearches.map((r) => (
                    <Pressable key={r} onPress={() => changeQuery(r)} accessibilityRole="button" accessibilityLabel={`Search ${r} again`} style={styles.recentChip}>
                      <ClockIcon size={12} color={colors.textTertiary} />
                      <Text style={styles.recentText} numberOfLines={1}>
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {q ? (
              <>
                {isBarcode ? (
                  <Pressable onPress={lookUpBarcode} accessibilityRole="button" style={({ pressed }) => [styles.barcodeRow, pressed && styles.pressedSoft]}>
                    <View style={[styles.wayTile, { backgroundColor: colors.chipAmberTint }]}>
                      <BarcodeIcon size={18} color={colors.amberText} />
                    </View>
                    <View style={styles.flexText}>
                      <Text style={styles.barcodeTitle}>Look up barcode {q}</Text>
                      {barcodeNote ? <Text style={styles.barcodeNote}>{barcodeNote}</Text> : null}
                    </View>
                  </Pressable>
                ) : null}
                <Text style={styles.overline}>{searching && !results.length ? 'Searching…' : searchError ? 'Search failed' : `${results.length} result${results.length === 1 ? '' : 's'}`}</Text>
                {searching && !results.length ? (
                  <ActivityIndicator color={colors.brandPrimary} style={styles.spinner} accessibilityLabel="Searching" />
                ) : searchError ? (
                  <Text style={styles.message}>{searchError}</Text>
                ) : results.length === 0 ? (
                  <View style={styles.empty}>
                    <FoodIcon generic size={56} />
                    <Text style={styles.emptyTitle}>Nothing for “{q}” yet</Text>
                    <Text style={styles.emptyBody}>Try another spelling, scan the package, or add it yourself.</Text>
                    <View style={styles.emptyActions}>
                      <Pressable onPress={() => onMode('scan')} accessibilityRole="button" style={[styles.emptyButton, styles.emptySecondary]}>
                        <Text style={styles.emptySecondaryText}>Scan barcode</Text>
                      </Pressable>
                      <Pressable onPress={() => onMode('custom')} accessibilityRole="button" style={[styles.emptyButton, styles.emptyPrimary]}>
                        <Text style={styles.emptyPrimaryText}>Quick add</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  results.map((f) => <FoodRow key={f.id} food={f} query={q} onOpen={() => open(f)} onQuickAdd={() => quickAdd(f)} />)
                )}
              </>
            ) : (
              <>
                {frequent.length ? (
                  <>
                    <Text style={styles.overline}>Frequent</Text>
                    <View style={styles.frequent}>
                      {frequent.map((f) => (
                        <FrequentTile key={f.id} food={f} onOpen={() => open(f)} onQuickAdd={() => quickAdd(f)} />
                      ))}
                    </View>
                  </>
                ) : null}
                <Text style={styles.overline}>Latest</Text>
                {latest.length ? (
                  latest.map((f) => <FoodRow key={f.id} food={f} query="" onOpen={() => open(f)} onQuickAdd={() => quickAdd(f)} />)
                ) : (
                  <Text style={styles.message}>Foods you log today appear here, ready to add again in one tap.</Text>
                )}
              </>
            )}
          </ScrollView>

          {/* Search bar: the last thing in the column, which is padded by the keyboard's overlap,
              so the bar — and what's typed — sits right on the keyboard and the list shrinks to
              fit. The home-indicator gap only matters while the keyboard is down. */}
          <View style={[styles.bottomBar, { paddingBottom: keyboardInset ? 8 : Math.max(12, insets.bottom) }]}>
            <Pressable onPress={() => inputRef.current?.focus()} style={[styles.searchField, { height: barHeight }, focused && styles.searchFieldFocused]}>
              <SearchIcon size={18} color={focused ? colors.brandPrimary : colors.textTertiary} strokeWidth={2.4} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={changeQuery}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={() => (isBarcode ? lookUpBarcode() : remember(q))}
                placeholder="Search foods or brands"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Search foods or brands"
                returnKeyType="search"
                // Food and brand names are not dictionary words: autocorrect turns "lapte" into "latte".
                autoCorrect={false}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                selectionColor={colors.brandPrimary}
                style={styles.searchInput}
              />
              {searching ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : null}
              {query ? (
                <Pressable onPress={() => changeQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} style={styles.clearDot}>
                  <CloseIcon size={10} color={colors.white} strokeWidth={3.4} />
                </Pressable>
              ) : null}
            </Pressable>
            {focused ? (
              <Pressable onPress={cancel} accessibilityRole="button" hitSlop={8} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onClose} accessibilityRole="button" style={[styles.doneButton, { height: barHeight }]}>
                <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <TimePickerSheet
        visible={pickingTime}
        value={time}
        onClose={() => setPickingTime(false)}
        onDone={(t) => {
          onTimeChange(t);
          setPickingTime(false);
        }}
      />
    </View>
  );
}

/** The day so far: a calorie ring with what's left, and protein, carbs and fat as slim bars. */
function DayStatus({ consumed, targets }: { consumed: Macro; targets: Targets | null }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const { nu } = useFoodColors();
  const size = 40;
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = targets ? Math.min(1, consumed.kcal / targets.kcal) : 0;
  const over = targets ? consumed.kcal > targets.kcal : false;
  const left = targets ? Math.round(targets.kcal - consumed.kcal) : null;
  const macros: [string, number, number | null, string][] = [
    ['P', consumed.protein, targets?.protein ?? null, nu.protein.base],
    ['C', consumed.carbs, targets?.carbs ?? null, nu.carbs.base],
    ['F', consumed.fat, targets?.fat ?? null, nu.fat.base],
  ];
  return (
    <View
      style={styles.status}
      accessible
      accessibilityLabel={`Today: ${Math.round(consumed.kcal)} kcal${left !== null ? `, ${Math.abs(left)} ${left >= 0 ? 'left' : 'over'}` : ''}; ${Math.round(consumed.protein)} g protein, ${Math.round(consumed.carbs)} g carbs, ${Math.round(consumed.fat)} g fat`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? colors.dangerTint : nu.kcal.tint} strokeWidth={stroke} />
          {share > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={over ? colors.stateError : nu.kcal.base}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * share} ${c}`}
            />
          ) : null}
        </Svg>
      </View>
      <View style={styles.statusText}>
        <Text style={[styles.statusKcal, over && styles.statusOver]} numberOfLines={1}>
          {left !== null ? `${Math.abs(left).toLocaleString()} ${left >= 0 ? 'left' : 'over'}` : `${Math.round(consumed.kcal).toLocaleString()} kcal`}
        </Text>
        <View style={styles.statusMacros}>
          {macros.map(([short, eaten, goal, color]) => (
            <View key={short} style={styles.statusMacro}>
              <View style={styles.statusTrack}>
                <View style={[styles.statusFill, { backgroundColor: color, width: `${goal ? Math.min(100, (eaten / goal) * 100) : 0}%` }]} />
              </View>
              <Text style={styles.statusMacroText}>
                {Math.round(eaten)}
                {short}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** A frequent food as a big icon with a + badge: tap the icon for details, + to log it. */
function FrequentTile({ food, onOpen, onQuickAdd }: { food: Listed; onOpen: () => void; onQuickAdd: () => void }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const [added, flash] = useAddedFlash();
  return (
    <View style={styles.tile}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${food.name}, details`} style={styles.tileIcon}>
        <FoodIcon name={food.name} size={52} />
      </Pressable>
      <Pressable
        onPress={() => flash(onQuickAdd)}
        accessibilityRole="button"
        accessibilityLabel={added ? `${food.name} added` : `Add ${food.name}, ${food.grams} grams`}
        hitSlop={6}
        style={[styles.tileAdd, added && styles.added]}>
        {added ? null : <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />}
        {added ? <Text style={styles.addedMark}>✓</Text> : <PlusIcon size={12} color={colors.white} strokeWidth={3} />}
      </Pressable>
      <Text style={styles.tileName} numberOfLines={1}>
        {food.name}
      </Text>
    </View>
  );
}

/** One food: icon, name with brand, macros as coloured dots and grams; kcal on the right; + logs it. */
function FoodRow({ food, query, onOpen, onQuickAdd }: { food: Listed; query: string; onOpen: () => void; onQuickAdd: () => void }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const { nu } = useFoodColors();
  const [added, flash] = useAddedFlash();
  const { brand } = brandAndStore(food);
  const f = food.grams / 100;
  const label = brand ? `${food.name}, ${brand}` : food.name;
  const macros: [string, number, string][] = [
    ['P', food.per100.protein * f, nu.protein.base],
    ['C', food.per100.carbs * f, nu.carbs.base],
    ['F', food.per100.fat * f, nu.fat.base],
  ];
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressedSoft]}>
      <FoodIcon name={food.name} size={42} />
      <View style={styles.flexText}>
        <Text style={styles.rowName} numberOfLines={2}>
          <Highlight text={food.name} query={query} />
          {brand ? (
            <Text style={styles.rowBrand}>
              {' '}
              <Highlight text={brand} query={query} />
            </Text>
          ) : null}
        </Text>
        <View style={styles.rowMeta}>
          {macros.map(([k, v, c]) => (
            <View key={k} style={styles.rowMacro}>
              <View style={[styles.dot, { backgroundColor: c }]} />
              <Text style={styles.rowMetaText}>
                {Math.round(v)}
                {k}
              </Text>
            </View>
          ))}
          <Text style={styles.rowMetaText}>· {food.grams} g</Text>
        </View>
      </View>
      <View style={styles.rowKcal}>
        <Text style={styles.rowKcalValue}>{Math.round(food.per100.kcal * f)}</Text>
        <Text style={styles.rowKcalUnit}>kcal</Text>
      </View>
      <Pressable
        onPress={() => flash(onQuickAdd)}
        accessibilityRole="button"
        accessibilityLabel={added ? `${label} added` : `Add ${label}, ${food.grams} grams`}
        style={[styles.rowAdd, added && styles.added]}>
        {added ? <Text style={styles.addedMark}>✓</Text> : <PlusIcon size={16} color={colors.brandPrimary} strokeWidth={2.8} />}
      </Pressable>
    </Pressable>
  );
}

/** "Added" for a moment after a quick add, so a second tap doesn't log it twice. */
function useAddedFlash() {
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(t);
  }, [added]);
  const flash = (add: () => void) => {
    if (added) return;
    setAdded(true);
    add();
  };
  return [added, flash] as const;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const colors = useColors();
  // Folded one character at a time ("â" -> "a"), so a match's position is the same in the
  // original text and "smantana" highlights "Smântână".
  const fold = (s: string) => s.split('').map((c) => c.normalize('NFD')[0].toLowerCase()).join('');
  const i = query ? fold(text).indexOf(fold(query)) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Text style={{ color: colors.brandPrimary }}>{text.slice(i, i + query.length)}</Text>
      {text.slice(i + query.length)}
    </>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  roundButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSurfaceSolid, borderWidth: 1, borderColor: colors.borderSubtle },
  timePill: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  timeText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary, ...num },
  status: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4, paddingLeft: 4, paddingRight: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.bgSurfaceSolid, borderWidth: 1, borderColor: colors.borderSubtle },
  statusText: { flex: 1, minWidth: 0 },
  statusKcal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.small, color: colors.textPrimary, ...num },
  statusOver: { color: colors.errorText },
  statusMacros: { flexDirection: 'row', gap: 6, marginTop: 3 },
  statusMacro: { flex: 1, minWidth: 0 },
  statusTrack: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.trackEmpty },
  statusFill: { height: 3, borderRadius: 2 },
  statusMacroText: { fontFamily: fontFamily.semibold, fontSize: fontSize.nano, color: colors.textTertiary, marginTop: 2, ...num },
  sheet: { flex: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.bgSurfaceSolid, overflow: 'hidden' },
  ways: { flexDirection: 'row', paddingTop: spacing.md, paddingBottom: 6, paddingHorizontal: spacing.sm },
  way: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4, borderRadius: radius.md },
  wayTile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wayTileOn: { boxShadow: colors.glowPrimary },
  wayText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textSecondary },
  wayTextOn: { color: colors.brandPrimary, fontFamily: fontFamily.bold },
  pressedSoft: { backgroundColor: colors.overlayPress },
  overline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: trackWide(fontSize.micro),
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg },
  recentChip: { maxWidth: '48%', height: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  recentText: { flexShrink: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textPrimary },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, marginHorizontal: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  barcodeTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary, ...num },
  barcodeNote: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2 },
  frequent: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  tile: { width: '20%', alignItems: 'center', paddingVertical: 4 },
  tileIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  tileAdd: {
    position: 'absolute',
    top: 34,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bgSurfaceSolid,
  },
  tileName: { maxWidth: '92%', fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  rowName: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  rowBrand: { fontFamily: fontFamily.medium, color: colors.textSecondary },
  rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  rowMacro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  rowMetaText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary, ...num },
  rowKcal: { alignItems: 'flex-end', flexShrink: 0 },
  rowKcalValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, ...num },
  rowKcalUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.nano, color: colors.textTertiary },
  rowAdd: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandTint, flexShrink: 0 },
  added: { backgroundColor: colors.successFill },
  addedMark: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.white },
  spinner: { marginTop: spacing.xl },
  message: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  empty: { alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  emptyTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg, alignSelf: 'stretch' },
  emptyButton: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  emptySecondary: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.bgSurfaceSolid },
  emptySecondaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  emptyPrimary: { backgroundColor: colors.brandFill },
  emptyPrimaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textOnBrand },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 8, paddingHorizontal: spacing.md, backgroundColor: colors.bgSurfaceSolid, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
    boxShadow: colors.shadowSm,
  },
  searchFieldFocused: { borderColor: colors.brandPrimary },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fontFamily.medium, fontSize: 16, color: colors.textPrimary, padding: 0 },
  clearDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.slate300, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { paddingHorizontal: 6, height: 44, justifyContent: 'center' },
  cancelText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.brandPrimary },
  doneButton: { paddingHorizontal: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: colors.glowPrimary },
  doneText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.white },
});
