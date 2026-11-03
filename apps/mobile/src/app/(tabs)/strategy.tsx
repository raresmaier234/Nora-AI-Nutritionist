import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanSection } from '@/components/nutrition-plan/plan-section';
import { useAuth } from '@/features/auth';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, useColors, useStyles } from '@/theme';

/**
 * The Strategy tab: the user's nutrition plan (`PlanSection`) — the daily targets everything
 * measures against, read-only, and the way to build or change a plan by answering questions
 * (apps/api/docs/plans/ai-nutrition-plan.md).
 */
export default function StrategyScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { profile, profileError, reloadProfile } = useAuth();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Strategy
          </Text>
          <Text style={styles.subtitle}>Your plan and the daily targets everything is measured against.</Text>
        </View>
        {profile ? (
          <PlanSection profile={profile} />
        ) : profileError ? (
          <View style={styles.loadError}>
            <Text style={styles.loadErrorText}>Couldn’t load your plan. {profileError}</Text>
            <Text onPress={reloadProfile} accessibilityRole="button" style={styles.retry}>
              Retry
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Loading your plan" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, letterSpacing: trackTight(fontSize.display), color: colors.textPrimary },
    subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 4 },
    loadError: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.bgSurfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSubtle },
    loadErrorText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
    retry: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
  });
