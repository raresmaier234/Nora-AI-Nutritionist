import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EnergyCard } from '@/components/dashboard/energy-card';
import { TrendCard } from '@/components/dashboard/trend-card';
import { WeekCard } from '@/components/dashboard/week-card';
import { useDashboard } from '@/features/dashboard/use-dashboard';
import { useTargets } from '@/features/food/hooks/use-targets';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';

/**
 * The Dashboard tab, where the app opens: this week's eating against the targets, eating against
 * burning, and the last two weeks' calories — each a card that says in a sentence what its chart
 * shows. Numbers come from GET /meals/summary and reload whenever the tab comes into view.
 */
export default function DashboardScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const targets = useTargets();
  const { data, error, retry } = useDashboard();
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.overline}>{dateLine}</Text>
          <Text style={styles.title} accessibilityRole="header">
            Dashboard
          </Text>
        </View>

        {data ? (
          <>
            <WeekCard week={data.week} today={data.today} targets={targets} />
            <EnergyCard week={data.week} today={data.today} maintenance={data.maintenance} />
            <TrendCard days={data.trend} target={targets?.kcal ?? null} />
          </>
        ) : error ? (
          <View style={styles.loadError}>
            <Text style={styles.loadErrorText}>Couldn’t load your week. {error}</Text>
            <Text onPress={retry} accessibilityRole="button" style={styles.retry}>
              Retry
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={colors.brandPrimary} style={styles.spinner} accessibilityLabel="Loading your week" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
    overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: trackWide(fontSize.micro) },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, letterSpacing: trackTight(fontSize.display), color: colors.textPrimary, marginTop: 2 },
    spinner: { marginTop: spacing.xxl },
    loadError: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bgSurfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSubtle },
    loadErrorText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
    retry: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
  });
