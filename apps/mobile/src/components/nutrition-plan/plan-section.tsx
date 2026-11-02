import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BuildPlanCard } from '@/components/nutrition-plan/build-plan-card';
import { PlanCard } from '@/components/nutrition-plan/plan-card';
import { PlanDetails } from '@/components/nutrition-plan/plan-details';
import { usePlanBuilder } from '@/components/nutrition-plan/plan-builder/plan-builder-host';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, spacing, useColors, useStyles } from '@/theme';
import { useActivePlan } from '@/features/nutrition-plan/hooks/use-active-plan';
import type { Section } from '@/features/nutrition-plan/questionnaire';
import type { UserProfile } from '@/services/api';

/**
 * The Profile tab's "Your plan" section, by account and `targets_mode`:
 * - basic: the default targets, read-only, and what "Build my plan · Premium" includes;
 * - premium, no plan yet: a prominent "Build my plan" above the starting targets;
 * - premium, active plan: the goal and its date, progress (check-ins, a later phase), the
 *   targets and the plan's texts, then Change plan and "Something changed?";
 * - logging without targets: a gentle note (and, for premium, "Something changed?") — no targets.
 */
export function PlanSection({ profile }: { profile: UserProfile }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const builder = usePlanBuilder();
  const premium = profile.plan === 'premium';
  const active = useActivePlan(premium && profile.targets_mode === 'plan', builder.version);
  const build = () => builder.open({ mode: 'build' });
  const change = () => builder.open({ mode: 'change' });
  // "Something changed?": the health questions again, and the gates re-run. Without targets the
  // body questions come too — a stop for age or weight can only clear through them.
  const recheck = (sections: Section[]) => builder.open({ mode: 'recheck', sections });

  if (profile.targets_mode === 'none' || !profile.targets) {
    return (
      <View style={styles.stack}>
        <Card padding={18}>
          <Text style={styles.noteTitle}>Nora isn’t setting targets for you right now</Text>
          <Text style={styles.noteBody}>
            You can keep logging what you eat and see everything it gives you. Calorie and macro targets stay hidden.
          </Text>
        </Card>
        {premium ? <SomethingChanged onPress={() => recheck(['body', 'health'])} /> : null}
      </View>
    );
  }

  if (!premium) {
    return (
      <View style={styles.stack}>
        <PlanCard targets={profile.targets} />
        <BuildPlanCard premium={false} />
      </View>
    );
  }

  if (profile.targets_mode === 'plan') {
    if (active.plan) {
      return (
        <View style={styles.stack}>
          {/* Weekly check-ins (next phase): the check-in card goes here, above the plan, while `profile.check_in_due`. */}
          <PlanDetails plan={active.plan} units={active.units} showProgress />
          <Button label="Change plan" variant="secondary" onPress={change} />
          <SomethingChanged onPress={() => recheck(['health'])} />
        </View>
      );
    }
    return (
      <View style={styles.stack}>
        <PlanCard targets={profile.targets} approximate />
        {active.loading ? (
          <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Loading your plan" />
        ) : active.error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>Couldn’t load your plan’s details. {active.error}</Text>
            <Text onPress={active.retry} accessibilityRole="button" style={styles.link}>
              Retry
            </Text>
          </View>
        ) : (
          <BuildPlanCard premium onPress={build} />
        )}
        {active.error ? <Button label="Change plan" variant="secondary" onPress={change} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <BuildPlanCard premium onPress={build} />
      <PlanCard targets={profile.targets} overline="Your starting targets" />
    </View>
  );
}

function SomethingChanged({ onPress }: { onPress: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Update your health answers; Nora checks your plan is still right for you"
      style={({ pressed }) => [styles.changed, pressed && styles.pressed]}>
      <Text style={styles.link}>Something changed?</Text>
      <Text style={styles.changedSub}>Health, medicines, pregnancy: update your answers</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    stack: { gap: spacing.md },
    noteTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary },
    noteBody: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.sm },
    error: { alignItems: 'center', gap: spacing.xs },
    errorText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
    link: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
    changed: { alignItems: 'center', paddingVertical: spacing.sm, gap: 2 },
    changedSub: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary },
    pressed: { opacity: 0.7 },
  });
