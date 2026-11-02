import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, ChevronRightIcon } from '@/components/log/icons';
import { Card } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';

const PREMIUM_INCLUDES = [
  'A plan for your goal: lose fat, gain muscle, both at once, or maintain',
  'Calories, protein, carbs, fat and fibre set for your body and activity',
  'Coming soon: weekly check-ins that adjust the plan as you go',
  'Safety checks, so the plan fits your health',
];

/**
 * "Build my plan". For a premium account without a plan, a prominent button that opens the
 * questionnaire. For a basic account, what premium includes — no button: payments don't exist
 * yet, so premium is set by hand for now.
 */
export function BuildPlanCard({ premium, onPress }: { premium: boolean; onPress?: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);

  if (!premium) {
    return (
      <Card padding={18}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Build my plan</Text>
          <View style={styles.badge}>
            <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
            <Text style={styles.badgeText}>Premium</Text>
          </View>
        </View>
        <Text style={styles.body}>Answer a few questions and Nora sets your daily targets around you.</Text>
        <View style={styles.list}>
          {PREMIUM_INCLUDES.map((item) => (
            <View key={item} style={styles.item}>
              <View style={styles.check}>
                <CheckIcon size={10} color={colors.white} />
              </View>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Premium isn’t available in the app yet. Until then, these are your daily targets.</Text>
      </Card>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Build my plan"
      accessibilityHint="About 2 minutes of questions, then Nora sets your daily targets"
      style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
      <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
      <Text style={styles.ctaOverline}>About 2 minutes</Text>
      <Text style={styles.ctaTitle}>Build my plan</Text>
      <Text style={styles.ctaBody}>Tell Nora your goal, body and how active you are, and get calories and macros set for you.</Text>
      <View style={styles.ctaButton}>
        <Text style={styles.ctaButtonText}>Get started</Text>
        <ChevronRightIcon size={14} color={colors.indigo600} strokeWidth={2.8} />
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary },
    badge: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, overflow: 'hidden' },
    badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.nano, letterSpacing: trackWide(fontSize.nano), textTransform: 'uppercase', color: colors.textOnBrand },
    body: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary, marginTop: spacing.sm },
    list: { gap: spacing.sm, marginTop: spacing.md },
    item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    check: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandFill, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    itemText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textPrimary },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, lineHeight: 16, color: colors.textTertiary, marginTop: spacing.md },
    cta: { borderRadius: radius.lg, padding: spacing.xl, overflow: 'hidden', boxShadow: colors.glowPrimary },
    pressed: { opacity: 0.9 },
    ctaOverline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, letterSpacing: trackWide(fontSize.micro), textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' },
    ctaTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, letterSpacing: trackTight(fontSize.display), color: colors.white, marginTop: spacing.xs },
    ctaBody: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: 'rgba(255,255,255,0.92)', marginTop: spacing.sm },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: spacing.lg,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.white,
    },
    ctaButtonText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.indigo600 },
  });
