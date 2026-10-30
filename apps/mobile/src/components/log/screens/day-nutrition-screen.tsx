import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/log/icons';
import { Fill, MacroTargetBar, NutrientSectionCard, fmt } from '@/components/log/nutrition-parts';
import { Palette, Scheme, fontFamily, fontSize, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';
import { foodColors, useFoodColors } from '@/features/food/theme';
import { Entry, Macro } from '@/features/food/data/mock-data';
import { useDayNutrients } from '@/features/food/hooks/use-day-nutrients';
import { useTargets } from '@/features/food/hooks/use-targets';
import { NUTRIENT_SECTIONS, NutrientSectionId } from '@/features/food/nutrients';

type DayNutritionScreenProps = {
  /** "Today", "Yesterday", a weekday. */
  dayLabel: string;
  /** "Thu, Oct 29". */
  dateLabel: string;
  entries: Entry[];
  /** The day's calories and macros, as the summary card shows them. */
  totals: Macro;
  onClose: () => void;
};

// Opened from the start: what a day's nutrition check is for. The rest stays collapsed.
const OPEN_SECTIONS = new Set<NutrientSectionId>(['macros', 'vitamins', 'minerals']);

/**
 * Everything eaten in one day, opened from the calorie summary card: calories and macros against
 * their goals, then fibre, vitamins, minerals and the rest, each with what's left of its daily
 * target. Micronutrients come from the logged database foods' profiles; custom foods, scans and
 * recipes add calories and macros only, and the screen says how many were left out.
 */
export function DayNutritionScreen({ dayLabel, dateLabel, entries, totals, onClose }: DayNutritionScreenProps) {
  const { nu } = useFoodColors();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const targets = useTargets();
  const day = useDayNutrients(entries);
  const v = day.values;

  const kcal = Math.round(totals.kcal);
  const kcalLeft = targets.kcal - kcal;
  const summaries: Partial<Record<NutrientSectionId, string>> = {
    macros: `${fmt(v.protein ?? 0)} g protein · ${fmt(v.carbs ?? 0)} g carbs · ${fmt(v.fat ?? 0)} g fat`,
    sugars: v.sugar != null ? `${fmt(v.sugar)} g total sugars` : undefined,
    fats: v.fat != null ? `${fmt(v.fat)} g total${v.cholesterol != null ? ` · ${fmt(v.cholesterol)} mg cholesterol` : ''}` : undefined,
    minerals: v.sodium != null ? `${fmt(v.sodium)} mg sodium` : undefined,
    other: v.caffeine ? `${fmt(v.caffeine)} mg caffeine` : v.alcohol ? `${fmt(v.alcohol)} g alcohol` : undefined,
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: 10 + insets.top }]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <CloseIcon size={16} color={colors.textPrimary} strokeWidth={2.6} />
        </Pressable>
        <Text style={styles.topTitle}>Nutrition</Text>
        <View style={styles.close} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 + insets.bottom }]}>
        <View>
          <Text style={styles.heading}>{dayLabel}</Text>
          <Text style={styles.subheading}>
            {dateLabel} · {entries.length} {entries.length === 1 ? 'food' : 'foods'} logged
          </Text>
        </View>

        {/* Calories and macros against the day's goals */}
        <View style={styles.summaryCard}>
          <Text style={styles.overline}>Eaten</Text>
          <View style={styles.kcalRow}>
            <Text style={styles.kcalTotal}>{kcal.toLocaleString()}</Text>
            <Text style={styles.kcalTarget}>/ {targets.kcal.toLocaleString()} kcal</Text>
          </View>
          <Text style={[styles.kcalLeft, kcalLeft < 0 && styles.kcalOver]}>
            {kcalLeft >= 0 ? `${kcalLeft.toLocaleString()} kcal left` : `${(-kcalLeft).toLocaleString()} kcal over`}
          </Text>
          <View style={[styles.kcalTrack, { backgroundColor: nu.kcal.tint }]}>
            <Fill pct={(kcal / targets.kcal) * 100} color={kcalLeft < 0 ? colors.errorText : nu.kcal.base} />
          </View>
          <View style={styles.rule} />
          <View style={styles.macroBars}>
            <MacroTargetBar family="protein" label="Protein" add={v.protein ?? 0} before={null} goal={targets.protein} />
            <MacroTargetBar family="carbs" label="Carbs" add={v.carbs ?? 0} before={null} goal={targets.carbs} />
            <MacroTargetBar family="fat" label="Fat" add={v.fat ?? 0} before={null} goal={targets.fat} />
            {v.fiber != null ? <MacroTargetBar family="fiber" label="Fiber" add={v.fiber} before={null} goal={targets.fiber} /> : null}
          </View>
        </View>

        {entries.length === 0 ? (
          <Text style={styles.empty}>Nothing logged for this day yet. Foods you log add up here.</Text>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Full nutrition</Text>
            {day.loading ? <Text style={styles.status}>Adding up vitamins and minerals…</Text> : null}
            {day.failed ? (
              <Text style={styles.status}>
                Couldn&apos;t load vitamins and minerals.{' '}
                <Text onPress={day.retry} accessibilityRole="button" style={styles.retry}>
                  Retry
                </Text>
              </Text>
            ) : null}
            <View style={styles.sections}>
              {NUTRIENT_SECTIONS.map((s) => (
                <NutrientSectionCard key={s.id} section={s} values={v} summary={summaries[s.id]} defaultOpen={OPEN_SECTIONS.has(s.id)} />
              ))}
            </View>
            <Text style={styles.note}>
              {day.withoutProfile > 0
                ? `Vitamins and minerals count ${entries.length - day.withoutProfile} of ${entries.length} foods: custom foods, scans and recipes only have calories and macros. `
                : ''}
              Targets are daily values for a 2,000 kcal diet. Nutrients without data are not shown.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const makeStyles = (colors: Palette, scheme: Scheme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSurfaceSolid },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  body: { paddingHorizontal: 18, paddingTop: spacing.xl, gap: spacing.lg },
  heading: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: colors.textPrimary, letterSpacing: trackTight(fontSize.h1) },
  subheading: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 6 },
  summaryCard: {
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: 28,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    boxShadow: '0px 12px 32px rgba(17,24,39,0.08)',
  },
  overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, letterSpacing: trackWide(fontSize.micro), textTransform: 'uppercase' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.sm },
  kcalTotal: { fontFamily: fontFamily.extrabold, fontSize: 34, color: colors.textPrimary, letterSpacing: trackTight(34), ...num },
  kcalTarget: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
  kcalLeft: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: foodColors[scheme].nu.kcal.ink, marginTop: 6, ...num },
  kcalOver: { color: colors.errorText },
  kcalTrack: { flexDirection: 'row', height: 12, borderRadius: radius.pill, overflow: 'hidden', marginTop: 14 },
  rule: { height: 1, backgroundColor: foodColors[scheme].nu.other.tint, marginTop: 20, marginBottom: 18 },
  macroBars: { gap: spacing.lg },
  empty: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl },
  sectionTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary, marginTop: 6, marginHorizontal: 2, marginBottom: spacing.md },
  status: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary, marginHorizontal: 2, marginBottom: spacing.md },
  retry: { fontFamily: fontFamily.bold, color: colors.brandPrimary },
  sections: { gap: 10 },
  note: { paddingTop: spacing.lg, paddingHorizontal: 4, fontFamily: fontFamily.medium, fontSize: fontSize.micro, lineHeight: 18, color: colors.textTertiary },
});
