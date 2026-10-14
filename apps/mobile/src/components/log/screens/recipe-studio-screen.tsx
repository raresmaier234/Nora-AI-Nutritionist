import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodIcon } from '@/components/log/food-icon';
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  ImageIcon,
  LinkIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/log/icons';
import { UnitPickerSheet } from '@/components/log/unit-picker-sheet';
import { WhenPicker } from '@/components/log/when-picker';
import { StudioStart } from '@/components/log/panels/recipes-panel';
import { colors, fontFamily, fontSize, gradientAngle, gradients, radius, shadows, spacing, trackTight, trackWide } from '@/theme';
import { FOOD_DB, FOOD_SERVINGS, Food, Recipe, RecipeItem } from '@/features/food/data/mock-data';
import { nutrientFamily as nu, overInk } from '@/features/food/theme';
import {
  IMPORT_LINK,
  IMPORT_PHOTO,
  importItems,
  itemGrams,
  linkHost,
  macrosFor,
  recipeFoodById,
  recipeTotals,
  recipeUnits,
} from '@/features/food/recipes';

type Item = RecipeItem & { key: number };
let nextKey = 1;
const withKey = (i: RecipeItem): Item => ({ ...i, key: nextKey++ });

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString();
const IMPORT_STEPS = ['Reading ingredients', 'Matching foods', 'Calculating nutrition'];

type RecipeStudioScreenProps = {
  /** A saved recipe to edit, or null for a new one. */
  initial: Recipe | null;
  /** New recipe: open straight into photo or link import. */
  start?: StudioStart;
  /** "HH:MM" the recipe is logged at. */
  time: string;
  onTimeChange: (time: string) => void;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  /** Save, then log `servingsEaten` servings. */
  onLog: (recipe: Recipe, servingsEaten: number) => void;
  /** Save, then open the recipe in Food Details. */
  onDetails: (recipe: Recipe) => void;
};

/**
 * Full-screen recipe & custom-meal builder (RecipeStudioV3.jsx). Nutrition is always derived
 * from the ingredients; a recipe can't be saved while an imported ingredient is unmatched.
 */
export function RecipeStudioScreen({ initial, start, time, onTimeChange, onClose, onSave, onLog, onDetails }: RecipeStudioScreenProps) {
  const insets = useSafeAreaInsets();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [items, setItems] = useState<Item[]>(() => (initial ? initial.items.map(withKey) : []));
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [source, setSource] = useState<string | null>(initial?.source ?? null);
  const [view, setView] = useState<'serving' | 'total'>('serving');
  const [eat, setEat] = useState(1);
  const [nameErr, setNameErr] = useState(false);
  const [showImport, setShowImport] = useState(!initial && (start === 'photo' || start === 'link'));

  const t = recipeTotals(items);
  const div = view === 'serving' ? Math.max(servings, 0.5) : 1;
  const shown = { kcal: Math.round(t.kcal / div), protein: t.protein / div, carbs: t.carbs / div, fat: t.fat / div };
  const perServingKcal = Math.round(t.kcal / Math.max(servings, 0.5));
  const gramsPerServing = t.grams / Math.max(servings, 0.5);
  const energy = shown.protein * 4 + shown.carbs * 4 + shown.fat * 9 || 1;
  const matched = items.filter((i) => recipeFoodById(i.id));
  const unmatched = items.length - matched.length;
  const toCheck = items.filter((i) => i.confidence != null && i.confidence < 0.7).length;
  const hasItems = matched.length > 0;
  const ready = hasItems && unmatched === 0;
  const first = matched[0] ? recipeFoodById(matched[0].id) : undefined;
  const used = items.map((i) => i.id).filter((id): id is string => !!id);

  const build = (): Recipe => ({
    id: initial?.id ?? '',
    name: name.trim(),
    servings,
    source,
    steps,
    items: items.map(({ id, amount, unit }) => ({ id, amount: Number(amount) || 0, unit })),
  });
  const guard = () => {
    if (!ready) return false;
    if (!name.trim()) {
      setNameErr(true);
      return false;
    }
    return true;
  };

  const ctaLabel = !hasItems
    ? 'Add an ingredient to continue'
    : unmatched
      ? `Match ${unmatched} ingredient${unmatched === 1 ? '' : 's'} to continue`
      : `Save & log · ${Math.round(perServingKcal * eat)} kcal`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.headerClose}>
          <CloseIcon size={18} color={colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{editing ? 'Edit recipe' : 'New recipe'}</Text>
        <Pressable
          onPress={() => guard() && onSave(build())}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          style={styles.headerSave}>
          <Text style={[styles.headerSaveText, !ready && styles.headerSaveOff]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: 132 + insets.bottom }]}>
        {/* Identity */}
        <View>
          <View style={styles.identity}>
            {first ? <FoodIcon name={first.name} size={56} /> : <FoodIcon generic size={56} />}
            <View style={styles.flex}>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setNameErr(false);
                }}
                placeholder="Name your recipe"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Recipe name"
                style={[styles.nameInput, nameErr && styles.nameInputErr]}
              />
              {nameErr ? <Text style={styles.errText}>Give the recipe a name to save it.</Text> : null}
            </View>
          </View>
          {source ? (
            <View style={styles.sourceChip}>
              {source === 'Photo' ? <CameraIcon size={12} color={colors.greenText} strokeWidth={2.4} /> : <LinkIcon size={12} color={colors.greenText} strokeWidth={2.4} />}
              <Text style={styles.sourceText}>Imported from {source}</Text>
            </View>
          ) : null}
          <View style={styles.servingsRow}>
            <View>
              <Text style={styles.rowTitle}>Servings</Text>
              <Text style={styles.rowSub}>
                {hasItems ? `${Math.round(gramsPerServing)} g each · ${Math.round(t.grams).toLocaleString()} g total` : 'How many portions this makes'}
              </Text>
            </View>
            <Stepper value={servings} onChange={setServings} step={1} min={1} label="servings" />
          </View>
        </View>

        {showImport || (!items.length && !initial) ? (
          <ImportCard
            start={start}
            onImported={(r) => {
              setName((n) => (n.trim() ? n : r.name));
              setServings(r.servings);
              setItems(r.items.map(withKey));
              setSteps(r.steps);
              setSource(r.source);
              setShowImport(false);
            }}
          />
        ) : !items.some((i) => i.imported) ? (
          <Pressable onPress={() => setShowImport(true)} accessibilityRole="button" style={styles.importLink}>
            <LinkIcon size={15} color={colors.textSecondary} />
            <Text style={styles.importLinkText}>Import from photo or link</Text>
          </Pressable>
        ) : null}

        {/* Nutrition */}
        <View style={[styles.card, styles.cardPad]}>
          <View style={styles.nutHead}>
            <Text style={styles.overline}>Nutrition</Text>
            <View accessibilityRole="tablist" style={styles.segment}>
              {(
                [
                  ['serving', 'Per serving'],
                  ['total', 'Whole recipe'],
                ] as const
              ).map(([k, l]) => (
                <Pressable key={k} onPress={() => setView(k)} accessibilityRole="tab" accessibilityState={{ selected: view === k }} style={[styles.segmentTab, view === k && styles.segmentOn]}>
                  <Text style={[styles.segmentText, view === k && styles.segmentTextOn]}>{l}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {hasItems ? (
            <>
              <View style={styles.kcalRow}>
                <Text style={styles.kcalBig}>{shown.kcal.toLocaleString()}</Text>
                <Text style={styles.kcalUnit}>kcal {view === 'serving' ? 'per serving' : 'in total'}</Text>
              </View>
              <Text style={styles.per100}>{Math.round(t.grams ? (t.kcal * 100) / t.grams : 0)} kcal per 100 g</Text>
              <View style={styles.split}>
                <View style={{ flex: (shown.protein * 4) / energy || 0.0001, backgroundColor: nu.protein.base }} />
                <View style={{ flex: (shown.carbs * 4) / energy || 0.0001, backgroundColor: nu.carbs.base }} />
                <View style={{ flex: (shown.fat * 9) / energy || 0.0001, backgroundColor: nu.fat.base }} />
              </View>
              <View style={styles.macros}>
                <Macro label="Protein" value={shown.protein} color={nu.protein.base} />
                <Macro label="Carbs" value={shown.carbs} color={nu.carbs.base} />
                <Macro label="Fat" value={shown.fat} color={nu.fat.base} />
              </View>
              {unmatched > 0 ? (
                <Text style={styles.warnText}>
                  {unmatched} unmatched ingredient{unmatched === 1 ? ' isn’t' : 's aren’t'} counted yet.
                </Text>
              ) : null}
              <Pressable
                onPress={() => guard() && onDetails(build())}
                disabled={!ready}
                accessibilityRole="button"
                style={[styles.detailsButton, !ready && styles.disabled]}>
                <View style={styles.flex}>
                  <Text style={styles.detailsTitle}>Full nutrition</Text>
                  <Text style={styles.detailsSub}>Calories, macros and how it fits your day</Text>
                </View>
                <ChevronRightIcon size={16} color={colors.textTertiary} strokeWidth={2.4} />
              </Pressable>
            </>
          ) : (
            <Text style={styles.bodyText}>Add ingredients and Nora calculates calories and macros for the whole recipe and each serving.</Text>
          )}
        </View>

        {/* Ingredients */}
        <View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              Ingredients{items.length > 0 ? <Text style={styles.sectionCount}> · {items.length}</Text> : null}
            </Text>
            {hasItems ? <Text style={styles.sectionKcal}>{Math.round(t.kcal).toLocaleString()} kcal</Text> : null}
          </View>
          {unmatched > 0 || toCheck > 0 ? (
            <View style={styles.banner}>
              <AlertIcon size={16} color={colors.amberText} />
              <Text style={styles.bannerText}>
                {[unmatched && `${unmatched} ingredient${unmatched === 1 ? '' : 's'} to match`, toCheck && `${toCheck} amount${toCheck === 1 ? '' : 's'} to check`]
                  .filter(Boolean)
                  .join(' · ')}
                . Review before you save.
              </Text>
            </View>
          ) : null}
          <View style={styles.card}>
            {items.map((it) => (
              <IngredientRow
                key={it.key}
                it={it}
                exclude={used}
                onChange={(n) => setItems((list) => list.map((x) => (x.key === it.key ? { ...n, key: it.key } : x)))}
                onRemove={() => setItems((list) => list.filter((x) => x.key !== it.key))}
              />
            ))}
            <View style={styles.pickerPad}>
              <FoodPicker
                exclude={used}
                placeholder="Add ingredient"
                onPick={(f) => {
                  const sv = (FOOD_SERVINGS[f.id] ?? [])[0];
                  setItems((list) => [
                    ...list,
                    withKey(sv ? { id: f.id, amount: 1, unit: sv[0].replace(/^1 /, '') } : { id: f.id, amount: 100, unit: 'g' }),
                  ]);
                }}
              />
            </View>
          </View>
        </View>

        <Method steps={steps} onChange={setSteps} />

        {/* Log it now */}
        {hasItems ? (
          <View style={[styles.card, styles.cardPad]}>
            <Text style={[styles.overline, styles.overlineGap]}>Log it now</Text>
            <View style={styles.servingsRow}>
              <View>
                <Text style={styles.rowTitle}>You ate</Text>
                <Text style={styles.rowSub}>
                  {Math.round(gramsPerServing * eat)} g · {Math.round(perServingKcal * eat)} kcal
                </Text>
              </View>
              <Stepper value={eat} onChange={setEat} step={0.5} min={0.5} suffix={eat === 1 ? 'serving' : 'servings'} label="servings eaten" />
            </View>
            <WhenPicker value={time} onChange={onTimeChange} compact />
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky actions */}
      <View style={[styles.actions, { paddingBottom: Math.max(18, insets.bottom) }]}>
        {ready ? (
          <Pressable onPress={() => guard() && onSave(build())} accessibilityRole="button" style={styles.saveSecondary}>
            <Text style={styles.saveSecondaryText}>Save</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => guard() && onLog(build(), eat)}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          style={[styles.cta, ready ? styles.ctaOn : styles.ctaOff]}>
          {ready ? <LinearGradient colors={gradients.primary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} /> : null}
          <Text style={[styles.ctaText, !ready && styles.ctaTextOff]}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.flex}>
      <View style={styles.macroLabelRow}>
        <View style={[styles.macroDot, { backgroundColor: color }]} />
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
      <Text style={styles.macroValue}>
        {fmt1(value)}
        <Text style={styles.macroUnit}> g</Text>
      </Text>
    </View>
  );
}

function Stepper({ value, onChange, step, min, suffix, label }: { value: number; onChange: (v: number) => void; step: number; min: number; suffix?: string; label: string }) {
  const atMin = value <= min;
  return (
    <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={label}>
      <Pressable
        onPress={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        style={[styles.stepButton, atMin && styles.stepOff]}>
        <MinusIcon size={16} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.stepValueWrap}>
        <Text style={styles.stepValue}>{fmt1(value)}</Text>
        {suffix ? <Text style={styles.stepSuffix}>{suffix}</Text> : null}
      </View>
      <Pressable
        onPress={() => onChange(Math.round((value + step) * 10) / 10)}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        style={styles.stepButton}>
        <PlusIcon size={16} color={colors.textPrimary} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

type Imported = { name: string; servings: number; items: RecipeItem[]; steps: string[]; source: string };

/** Photo / link import, mocked: a short "reading" sequence, then IMPORT_PHOTO or IMPORT_LINK. */
function ImportCard({ start, onImported }: { start?: StudioStart; onImported: (r: Imported) => void }) {
  const [kind, setKind] = useState<'photo' | 'link' | null>(start === 'link' ? 'link' : start === 'photo' ? 'photo' : null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = (k: 'photo' | 'link') => {
    const host = k === 'link' ? linkHost(url) : null;
    if (k === 'link' && !host) {
      setErr('That doesn’t look like a link. Paste the full address, e.g. bbcgoodfood.com/recipes/…');
      return;
    }
    setErr('');
    setBusy(true);
    setStage(0);
    timers.current = [
      setTimeout(() => setStage(1), 550),
      setTimeout(() => setStage(2), 1100),
      setTimeout(() => {
        setBusy(false);
        const src = k === 'link' ? IMPORT_LINK : IMPORT_PHOTO;
        onImported({ name: src.name, servings: src.servings, items: importItems(src), steps: src.steps ?? [], source: host ?? 'Photo' });
      }, 1700),
    ];
  };

  const tab = (k: 'photo' | 'link', label: string, icon: ReactNode) => (
    <Pressable
      key={k}
      onPress={() => {
        setKind(k);
        setErr('');
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: kind === k }}
      style={[styles.importTab, kind === k && styles.segmentOn]}>
      {icon}
      <Text style={[styles.importTabText, kind === k && styles.segmentTextOn]}>{label}</Text>
    </Pressable>
  );
  const bigButton = (label: string, sub: string, icon: ReactNode, primary: boolean) => (
    <Pressable onPress={() => run('photo')} accessibilityRole="button" style={[styles.bigButton, primary ? styles.bigPrimary : styles.bigSecondary]}>
      {primary ? <LinearGradient colors={gradients.primary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} /> : null}
      {icon}
      <View>
        <Text style={[styles.bigLabel, primary && styles.onBrand]}>{label}</Text>
        <Text style={[styles.bigSub, primary && styles.onBrandSoft]}>{sub}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.card, styles.importCard]}>
      <Text style={styles.rowTitle}>Import a recipe</Text>
      <Text style={styles.importIntro}>Nora reads the ingredients and amounts. You check them before saving.</Text>
      {busy ? (
        <View accessibilityLiveRegion="polite" style={styles.progress}>
          {IMPORT_STEPS.map((s, i) => (
            <View key={s} style={[styles.progressRow, i > stage && styles.progressLater]}>
              <View style={[styles.progressDot, i < stage && styles.progressDone]}>
                {i < stage ? (
                  <CheckIcon size={13} color={colors.white} />
                ) : i === stage ? (
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                ) : (
                  <View style={styles.progressPending} />
                )}
              </View>
              <Text style={styles.progressText}>
                {s}
                {i === stage ? '…' : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <View accessibilityRole="tablist" style={styles.segment}>
            {tab('photo', 'Photo', <CameraIcon size={16} color={kind === 'photo' ? colors.textPrimary : colors.textSecondary} />)}
            {tab('link', 'Link', <LinkIcon size={16} color={kind === 'link' ? colors.textPrimary : colors.textSecondary} />)}
          </View>
          {kind === 'photo' ? (
            <View style={styles.importBody}>
              <View style={styles.bigRow}>
                {bigButton('Take photo', 'Recipe card or plate', <CameraIcon size={20} color={colors.white} />, true)}
                {bigButton('Choose photo', 'From your library', <ImageIcon size={20} color={colors.textPrimary} />, false)}
              </View>
              <Text style={styles.hint}>Works with handwritten cards, cookbook pages and screenshots.</Text>
            </View>
          ) : null}
          {kind === 'link' ? (
            <View style={styles.importBody}>
              <View style={[styles.linkField, !!err && styles.linkFieldErr]}>
                <LinkIcon size={16} color={colors.textTertiary} />
                <TextInput
                  value={url}
                  onChangeText={(v) => {
                    setUrl(v);
                    setErr('');
                  }}
                  onSubmitEditing={() => run('link')}
                  placeholder="Paste recipe link"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Recipe link"
                  style={styles.linkInput}
                />
                <Pressable
                  onPress={() => run('link')}
                  disabled={!url.trim()}
                  accessibilityRole="button"
                  style={[styles.importButton, !url.trim() && styles.disabled]}>
                  <LinearGradient colors={gradients.primary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
                  <Text style={styles.importButtonText}>Import</Text>
                </Pressable>
              </View>
              <Text style={[styles.hint, !!err && styles.errText]}>{err || 'Ingredients, servings and method are imported. Ads and stories are skipped.'}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function FoodPicker({ exclude, placeholder, autoFocus, onPick }: { exclude: string[]; placeholder: string; autoFocus?: boolean; onPick: (f: Food) => void }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const results = query ? FOOD_DB.filter((f) => !exclude.includes(f.id) && f.name.toLowerCase().includes(query)).slice(0, 6) : [];
  return (
    <View>
      <View style={styles.pickerField}>
        <SearchIcon size={18} color={colors.brandPrimary} strokeWidth={2.4} />
        <TextInput
          autoFocus={autoFocus}
          value={q}
          onChangeText={setQ}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={placeholder}
          style={styles.pickerInput}
        />
      </View>
      {query ? (
        <View style={styles.pickerResults}>
          {results.length ? (
            results.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  onPick(f);
                  setQ('');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                <FoodIcon name={f.name} size={36} />
                <Text style={styles.pickerName}>{f.name}</Text>
                <Text style={styles.pickerKcal}>{f.per100.kcal} kcal/100g</Text>
                <View style={styles.pickerAdd}>
                  <PlusIcon size={14} color={colors.white} strokeWidth={3} />
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.pickerNone}>No food matches &quot;{q.trim()}&quot;. Try a simpler name, like &quot;dill&quot; or &quot;herbs&quot;.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function IngredientRow({ it, exclude, onChange, onRemove }: { it: Item; exclude: string[]; onChange: (n: RecipeItem) => void; onRemove: () => void }) {
  const [matching, setMatching] = useState(false);
  const [pickingUnit, setPickingUnit] = useState(false);
  const f = recipeFoodById(it.id);
  const removeButton = (label: string) => (
    <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${label}`} style={styles.remove}>
      <CloseIcon size={16} color={colors.textTertiary} strokeWidth={2.2} />
    </Pressable>
  );

  if (!f) {
    return (
      <View style={[styles.ingredient, styles.unmatched]}>
        <View style={styles.ingredientRow}>
          <View style={styles.unmatchedIcon}>
            <AlertIcon size={18} color={colors.amberText} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.ingredientName}>{it.raw}</Text>
            <Text style={styles.unmatchedText}>Not matched — not counted in nutrition yet</Text>
            {!matching ? (
              <Pressable onPress={() => setMatching(true)} accessibilityRole="button" style={styles.matchButton}>
                <Text style={styles.matchButtonText}>Match to a food</Text>
              </Pressable>
            ) : null}
          </View>
          {removeButton(it.raw ?? 'ingredient')}
        </View>
        {matching ? (
          <View style={styles.matchPicker}>
            <FoodPicker
              autoFocus
              exclude={exclude}
              placeholder="Search for this ingredient"
              onPick={(food) => onChange({ ...it, id: food.id, unit: 'g', raw: null, confidence: null })}
            />
          </View>
        ) : null}
      </View>
    );
  }

  const units = recipeUnits(f.id);
  const g = itemGrams(it);
  const m = macrosFor(f, g);
  const low = it.confidence != null && it.confidence < 0.7;
  return (
    <View style={[styles.ingredient, styles.ingredientRow]}>
      <FoodIcon name={f.name} size={42} />
      <View style={styles.flex}>
        <View style={styles.ingredientTop}>
          <Text style={[styles.ingredientName, styles.flex]}>{f.name}</Text>
          <Text style={styles.ingredientKcal}>{Math.round(m.kcal)} kcal</Text>
        </View>
        <View style={styles.amountRow}>
          <TextInput
            value={String(it.amount)}
            onChangeText={(v) => onChange({ ...it, amount: v, confidence: null })}
            keyboardType="decimal-pad"
            accessibilityLabel={`${f.name} amount`}
            style={[styles.amountInput, low && styles.amountLow]}
          />
          <Pressable onPress={() => setPickingUnit(true)} accessibilityRole="button" accessibilityLabel={`${f.name} unit, ${it.unit}`} style={styles.unitButton}>
            <Text style={styles.unitText} numberOfLines={1}>
              {it.unit}
            </Text>
            <ChevronDownIcon size={14} color={colors.textTertiary} />
          </Pressable>
          {it.unit !== 'g' ? <Text style={styles.gramsHint}>= {Math.round(g)} g</Text> : null}
        </View>
        <Text style={[styles.ingredientMeta, low && styles.lowText]}>
          {low ? 'Low confidence — check the amount' : `P ${Math.round(m.protein)} g · C ${Math.round(m.carbs)} g · F ${Math.round(m.fat)} g`}
        </Text>
      </View>
      {removeButton(f.name)}
      <UnitPickerSheet
        visible={pickingUnit}
        value={it.unit}
        units={units}
        onClose={() => setPickingUnit(false)}
        onSelect={(next) => {
          // Keep the same weight when switching units.
          const toG = (units.find(([l]) => l === next) ?? ['', 1])[1];
          const amount = next === 'g' ? Math.round(g) : Math.round((g / toG) * 10) / 10 || 1;
          onChange({ ...it, unit: next, amount, confidence: null });
        }}
      />
    </View>
  );
}

function Method({ steps, onChange }: { steps: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(steps.length > 0);
  const [draft, setDraft] = useState('');
  // Imported steps arrive after mount; show them.
  const [seen, setSeen] = useState(steps.length);
  if (steps.length !== seen) {
    setSeen(steps.length);
    if (steps.length > seen) setOpen(true);
  }
  const add = () => {
    if (!draft.trim()) return;
    onChange([...steps, draft.trim()]);
    setDraft('');
  };
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.methodHead}>
        <Text style={[styles.rowTitle, styles.flex]}>Method</Text>
        <Text style={styles.methodCount}>{steps.length ? `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}` : 'Optional'}</Text>
        <View style={open && styles.flip}>
          <ChevronDownIcon size={16} color={colors.textTertiary} strokeWidth={2.4} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.methodBody}>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
              <Pressable onPress={() => onChange(steps.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove step ${i + 1}`} style={styles.stepRemove}>
                <CloseIcon size={14} color={colors.textTertiary} strokeWidth={2.2} />
              </Pressable>
            </View>
          ))}
          <View style={[styles.stepAddRow, steps.length > 0 && styles.stepAddGap]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
              placeholder={`Step ${steps.length + 1}`}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="New step"
              style={styles.stepInput}
            />
            <Pressable onPress={add} disabled={!draft.trim()} accessibilityRole="button" style={[styles.stepAdd, !draft.trim() && styles.disabled]}>
              <Text style={styles.stepAddText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  flex: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.overlayPress },
  disabled: { opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, minHeight: 60 },
  headerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  headerSave: { minWidth: 44, height: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  headerSaveText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.brandPrimary },
  headerSaveOff: { color: colors.textTertiary },
  body: { paddingTop: 6, paddingHorizontal: spacing.xl, gap: spacing.xl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nameInput: {
    borderBottomWidth: 2,
    borderBottomColor: colors.borderSubtle,
    paddingTop: 4,
    paddingBottom: 10,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h1,
    color: colors.textPrimary,
    letterSpacing: trackTight(fontSize.h1),
  },
  nameInputErr: { borderBottomColor: colors.red500 },
  errText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: overInk, marginTop: spacing.sm },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.successTint,
  },
  sourceText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.greenText },
  servingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: 18 },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  rowSub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 5, ...num },
  importLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
  },
  importLinkText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textSecondary },
  card: { backgroundColor: colors.bgSurfaceSolid, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, boxShadow: shadows.sm, overflow: 'hidden' },
  cardPad: { padding: 18 },
  nutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: spacing.lg },
  overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, letterSpacing: trackWide(fontSize.micro), textTransform: 'uppercase' },
  overlineGap: { marginBottom: 14 },
  segment: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: radius.pill, backgroundColor: colors.trackEmpty },
  segmentTab: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.bgSurfaceSolid, boxShadow: shadows.sm },
  segmentText: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textSecondary },
  segmentTextOn: { color: colors.textPrimary },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kcalBig: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display2, color: colors.textPrimary, letterSpacing: trackTight(fontSize.display2), ...num },
  kcalUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
  per100: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 6, ...num },
  split: { flexDirection: 'row', gap: 2, height: 8, borderRadius: radius.pill, overflow: 'hidden', marginVertical: spacing.lg },
  macros: { flexDirection: 'row', gap: spacing.md },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  macroValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginTop: 7, ...num },
  macroUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  warnText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.amberText, marginTop: 14 },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
  },
  detailsTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  detailsSub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 2 },
  bodyText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 2, marginBottom: 10 },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.h2, color: colors.textPrimary },
  sectionCount: { fontFamily: fontFamily.semibold, color: colors.textTertiary },
  sectionKcal: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textSecondary, ...num },
  banner: { flexDirection: 'row', gap: 10, paddingVertical: spacing.md, paddingHorizontal: 14, marginBottom: 10, borderRadius: radius.md, backgroundColor: 'rgba(245,158,11,0.10)' },
  bannerText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textPrimary, lineHeight: 18 },
  ingredient: { paddingVertical: 14, paddingLeft: spacing.lg, paddingRight: 4, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  ingredientRow: { flexDirection: 'row', gap: spacing.md },
  unmatched: { backgroundColor: 'rgba(245,158,11,0.06)' },
  unmatchedIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(180,83,9,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmatchedText: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.amberText, marginTop: 5 },
  matchButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.35)',
    backgroundColor: colors.bgSurfaceSolid,
  },
  matchButtonText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.amberText },
  matchPicker: { marginTop: spacing.md, paddingRight: spacing.md },
  ingredientTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  ingredientName: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  ingredientKcal: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary, flexShrink: 0, ...num },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 9 },
  amountInput: {
    width: 70,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.textPrimary,
    ...num,
  },
  amountLow: { borderColor: 'rgba(245,158,11,0.7)' },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    maxWidth: 132,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
  },
  unitText: { flexShrink: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textPrimary },
  gramsHint: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary, ...num },
  ingredientMeta: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: spacing.sm, ...num },
  lowText: { color: colors.amberText },
  remove: { width: 44, height: 44, marginTop: -4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickerPad: { padding: spacing.md },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(99,102,241,0.35)',
  },
  pickerInput: { flex: 1, minWidth: 0, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textPrimary, padding: 0 },
  pickerResults: { marginTop: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, padding: 6, borderRadius: 12 },
  pickerName: { flex: 1, minWidth: 0, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textPrimary },
  pickerKcal: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, ...num },
  pickerAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  pickerNone: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: spacing.lg },
  methodCount: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  flip: { transform: [{ rotate: '180deg' }] },
  methodBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  step: { flexDirection: 'row', gap: spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.10)', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fontFamily.extrabold, fontSize: fontSize.micro, color: colors.brandPrimary },
  stepText: { flex: 1, minWidth: 0, fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textPrimary, lineHeight: 19 },
  stepRemove: { width: 32, height: 32, marginTop: -4, alignItems: 'center', justifyContent: 'center' },
  stepAddRow: { flexDirection: 'row', gap: spacing.sm },
  stepAddGap: { marginTop: 6 },
  stepInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textPrimary,
  },
  stepAdd: { minWidth: 64, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.bgSurfaceSolid, alignItems: 'center', justifyContent: 'center' },
  stepAddText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.4 },
  stepValueWrap: { minWidth: 60, alignItems: 'center' },
  stepValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, ...num },
  stepSuffix: { fontFamily: fontFamily.semibold, fontSize: fontSize.nano, color: colors.textTertiary, marginTop: 4 },
  importCard: { padding: spacing.lg },
  importIntro: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  importTab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.pill },
  importTabText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textSecondary },
  importBody: { marginTop: spacing.md },
  bigRow: { flexDirection: 'row', gap: 10 },
  bigButton: { flex: 1, minWidth: 0, minHeight: 84, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: 14, borderRadius: radius.md, overflow: 'hidden' },
  bigPrimary: { boxShadow: shadows.glowPrimary },
  bigSecondary: { borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.bgSurfaceSolid },
  bigLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  bigSub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 2 },
  onBrand: { color: colors.white },
  onBrandSoft: { color: 'rgba(255,255,255,0.85)' },
  hint: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 10, paddingLeft: 4, lineHeight: 15 },
  linkField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingRight: 4,
    paddingLeft: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
  },
  linkFieldErr: { borderColor: colors.red500 },
  linkInput: { flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  importButton: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  importButtonText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.white },
  progress: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: spacing.lg, borderRadius: radius.md, backgroundColor: 'rgba(99,102,241,0.07)' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  progressLater: { opacity: 0.45 },
  progressDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  progressDone: { backgroundColor: colors.green500 },
  progressPending: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  progressText: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textPrimary },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bgSurfaceSolid,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    boxShadow: '0px -8px 24px rgba(17,24,39,0.06)',
  },
  saveSecondary: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSecondaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textPrimary },
  cta: { flex: 1, minHeight: 52, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  ctaOn: { boxShadow: shadows.glowPrimary },
  ctaOff: { backgroundColor: colors.trackEmpty },
  ctaText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.white, ...num },
  ctaTextOff: { color: colors.textSecondary },
});
