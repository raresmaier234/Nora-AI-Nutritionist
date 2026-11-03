import { StyleSheet, Text, View } from 'react-native';

import { AlertIcon } from '@/components/log/icons';
import { PlanCard } from '@/components/nutrition-plan/plan-card';
import { Card } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';
import { goalLabel } from '@/features/nutrition-plan/options';
import { formatDate, formatRate, formatWeight } from '@/features/nutrition-plan/questionnaire';
import type { MeasurementUnits, NutritionPlan } from '@/services/api';

type PlanDetailsProps = {
  plan: NutritionPlan;
  /** How the user entered their weight; weights here are shown the same way. */
  units: MeasurementUnits;
  /** The Strategy tab: a progress area under the goal (filled by weekly check-ins, a later phase). */
  showProgress?: boolean;
};

/**
 * A nutrition plan, read-only: the goal and its date, the daily targets, and the plan's texts —
 * summary, why these numbers, how to follow it, and anything to be careful about. Shown on the
 * plan builder's review and on the Strategy tab. Numbers are estimates ("~").
 */
export function PlanDetails({ plan, units, showProgress }: PlanDetailsProps) {
  const styles = useStyles(makeStyles);
  const { texts } = plan;
  // The API ends the cautions with the disclaimer, in the plan's language: shown on its own.
  const cautions = texts.cautions.slice(0, -1);
  const disclaimer = texts.cautions[texts.cautions.length - 1];
  return (
    <View style={styles.root}>
      <GoalCard plan={plan} units={units} showProgress={showProgress} />
      <PlanCard targets={plan.targets} approximate />
      {texts.summary ? <Text style={styles.summary}>{texts.summary}</Text> : null}
      <TextList title="Why these numbers" items={texts.why} />
      <TextList title="How to follow it" items={texts.guidance} />
      <TextList title="Good to know" items={cautions} caution />
      {disclaimer ? <Text style={styles.disclaimer}>{disclaimer}</Text> : null}
    </View>
  );
}

function GoalCard({ plan, units, showProgress }: PlanDetailsProps) {
  const styles = useStyles(makeStyles);
  const hasWeightGoal = plan.goal !== 'maintain';
  const target = plan.target_weight_kg;
  const rate = plan.rate.effective_kg_week;

  let line: string;
  if (!hasWeightGoal) line = 'Stay about where you are and eat well.';
  else if (target !== null && plan.goal_date) line = `Reach ~${formatWeight(target, units)} around ${formatDate(plan.goal_date)}.`;
  else if (plan.goal === 'recomp') line = plan.goal_date ? `Lose fat and build muscle until ${formatDate(plan.goal_date)}, then decide what’s next.` : 'Lose fat and build muscle steadily.';
  else if (plan.goal_date) line = `Build steadily until ${formatDate(plan.goal_date)}, then decide what’s next.`;
  else line = 'Build steadily, then decide what’s next.';

  return (
    <Card padding={18}>
      <Text style={styles.overline}>Your goal</Text>
      <Text style={styles.goal}>{goalLabel(plan.goal)}</Text>
      <Text style={styles.goalLine}>{line}</Text>
      {hasWeightGoal ? (
        <View style={styles.chips}>
          {plan.weeks ? <Chip label={`~${plan.weeks} weeks`} /> : null}
          {rate ? <Chip label={formatRate(rate, units)} /> : null}
        </View>
      ) : null}
      {showProgress && hasWeightGoal ? (
        <View style={styles.progress}>
          {target !== null ? (
            <View style={styles.progressEnds}>
              <Text style={styles.progressEnd}>Start {formatWeight(plan.start_weight_kg, units)}</Text>
              <Text style={styles.progressEnd}>Goal {formatWeight(target, units)}</Text>
            </View>
          ) : null}
          <View style={styles.track} />
          <Text style={styles.progressNote}>Your progress will show here once weekly check-ins start.</Text>
        </View>
      ) : null}
    </Card>
  );
}

function Chip({ label }: { label: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function TextList({ title, items, caution }: { title: string; items: string[]; caution?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  if (!items.length) return null;
  return (
    <View style={[styles.list, caution && styles.listCaution]}>
      <Text style={styles.listTitle} accessibilityRole="header">
        {title}
      </Text>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          {caution ? (
            <View style={styles.itemIcon}>
              <AlertIcon size={15} color={colors.amberText} />
            </View>
          ) : (
            <View style={styles.dot} />
          )}
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { gap: spacing.md },
    overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
    goal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, letterSpacing: trackTight(fontSize.h1), color: colors.textPrimary, marginTop: spacing.xs },
    goalLine: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 21, color: colors.textSecondary, marginTop: spacing.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    chip: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11, backgroundColor: colors.brandTint },
    chipText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
    progress: { marginTop: spacing.lg, gap: spacing.sm },
    progressEnds: { flexDirection: 'row', justifyContent: 'space-between' },
    progressEnd: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: trackWide(fontSize.micro) },
    track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.trackEmpty },
    progressNote: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary },
    summary: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 23, color: colors.textPrimary, paddingHorizontal: 2, marginTop: spacing.xs },
    list: {
      gap: 10,
      padding: 18,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
    },
    listCaution: { backgroundColor: colors.warningTint, borderColor: 'transparent' },
    listTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.body, color: colors.textPrimary, marginBottom: 2 },
    item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 8 },
    itemIcon: { marginTop: 2 },
    itemText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 20, color: colors.textSecondary },
    disclaimer: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs },
  });
