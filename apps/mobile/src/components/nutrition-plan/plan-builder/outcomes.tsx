import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PlanDetails } from '@/components/nutrition-plan/plan-details';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, useColors, useStyles } from '@/theme';
import { goalLabel } from '@/features/nutrition-plan/options';
import type { MeasurementUnits, NutritionGoalKind, NutritionPlan, PlanGate } from '@/services/api';

import { Callout, StepHeader } from './parts';

/*
 * What the questionnaire ends in: a gate (the answers rule the chosen goal out — pick an
 * allowed one), a stop (no plan: a warm, number-free screen pointing to a professional), or the
 * review of the new plan. Their buttons live in the builder's footer.
 */

/** The goals a gate leaves open, Maintain first. */
export function gateChoices(gate: PlanGate, current: NutritionGoalKind | undefined): NutritionGoalKind[] {
  const order: NutritionGoalKind[] = ['maintain', 'recomp', 'build_muscle', 'lose_fat'];
  return order.filter((g) => g !== current && gate.allowed_goals.includes(g));
}

export function GateScreen({ gate, goal }: { gate: PlanGate; goal: NutritionGoalKind | undefined }) {
  const styles = useStyles(makeStyles);
  const choices = gateChoices(gate, goal);
  const onlyMaintain = choices.length === 1 && choices[0] === 'maintain';
  return (
    <>
      <StepHeader
        eyebrow="Your goal"
        title={onlyMaintain ? 'For now, let’s aim to maintain' : 'Let’s choose a different goal'}
        helper={
          goal
            ? `From your answers, ${goalLabel(goal)} isn’t the right goal for you at the moment.`
            : 'From your answers, a different goal suits you better at the moment.'
        }
      />
      {gate.reasons.length > 0 ? (
        <View style={styles.reasons}>
          {gate.reasons.map((r) => (
            <Callout key={r.code}>{r.message}</Callout>
          ))}
        </View>
      ) : null}
      {choices.length > 0 ? (
        <Text style={styles.note}>
          {onlyMaintain
            ? 'With Maintain, Nora helps you eat well and stay about where you are.'
            : 'You can go back and change your answers, or carry on with one of these goals.'}
        </Text>
      ) : (
        <Text style={styles.note}>Go back to check your answers.</Text>
      )}
    </>
  );
}

const FALLBACK_STOP = {
  title: 'Let’s pause the plan here',
  body: 'For what you’ve told us, a calorie plan from an app isn’t the right fit. A doctor or registered dietitian can help you with one that’s safe for you. You can keep logging your food in Nora, and we won’t show you any targets.',
};

/** No plan. Warm and short, with no numbers; each stop's text says food logging stays available. */
export function StopScreen({ stop }: { stop: PlanGate['stop'] }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { title, body } = stop ?? FALLBACK_STOP;
  return (
    <View style={styles.stop}>
      <View style={styles.stopIcon}>
        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={colors.brandPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </Svg>
      </View>
      <Text style={styles.stopTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.stopBody}>{body}</Text>
    </View>
  );
}

type ReviewScreenProps = { plan: NutritionPlan; units: MeasurementUnits };

/** The new plan, before it's used: its notices (e.g. "the nearest safe date is …"), then the plan. */
export function ReviewScreen({ plan, units }: ReviewScreenProps) {
  const styles = useStyles(makeStyles);
  return (
    <>
      <StepHeader eyebrow="Your plan" title="Here’s your plan" helper="Built from your answers. The numbers are estimates: every body is a little different, so watch how your weight trends over a few weeks." />
      {plan.notices.length > 0 ? (
        <View style={styles.reasons}>
          {plan.notices.map((n) => (
            <Callout key={n.code}>{n.message}</Callout>
          ))}
        </View>
      ) : null}
      <PlanDetails plan={plan} units={units} />
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    reasons: { gap: spacing.sm, marginBottom: spacing.lg },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, color: colors.textSecondary },
    stop: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.md },
    stopIcon: {
      width: 76,
      height: 76,
      borderRadius: radius.lg,
      backgroundColor: colors.brandTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    stopTitle: { fontFamily: fontFamily.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: trackTight(26), color: colors.textPrimary, textAlign: 'center' },
    stopBody: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 23, color: colors.textSecondary, textAlign: 'center' },
  });
