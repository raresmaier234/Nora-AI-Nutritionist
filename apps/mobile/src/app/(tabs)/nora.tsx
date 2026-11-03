import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckIcon, SparkleIcon } from '@/components/log/icons';
import { NoraChat } from '@/components/nora/nora-chat';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';

const NORA_INCLUDES = [
  'Questions about any food or meal you’ve logged',
  'Ideas for what to eat next, around what’s left of your day',
  'Your plan and targets explained in plain words',
  'Answers in English or Romanian',
];

/**
 * The Nora tab: a chat with Nora, the in-app assistant (POST /nora/chat). Premium only: a basic
 * account sees what Nora does instead — no button, as premium is set by hand until payments exist.
 */
export default function NoraScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { profile, profileError, reloadProfile } = useAuth();

  if (profile?.plan === 'premium') {
    return <NoraChat name={profile.display_name} withoutTargets={profile.targets_mode === 'none'} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Nora
          </Text>
          <Text style={styles.subtitle}>Your nutrition assistant, in a chat.</Text>
        </View>
        {profile ? (
          <Card padding={18}>
            <View style={styles.titleRow}>
              <View style={styles.mark}>
                <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
                <SparkleIcon size={16} color={colors.white} fill={colors.white} strokeWidth={1.4} />
              </View>
              <Text style={styles.cardTitle}>Ask Nora</Text>
              <View style={styles.badge}>
                <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
                <Text style={styles.badgeText}>Premium</Text>
              </View>
            </View>
            <Text style={styles.body}>Chat with Nora about your meals. Nora sees what you’ve logged today, so every idea fits your day.</Text>
            <View style={styles.list}>
              {NORA_INCLUDES.map((item) => (
                <View key={item} style={styles.item}>
                  <View style={styles.check}>
                    <CheckIcon size={10} color={colors.white} />
                  </View>
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>Premium isn’t available in the app yet.</Text>
          </Card>
        ) : profileError ? (
          <View style={styles.loadError}>
            <Text style={styles.loadErrorText}>Couldn’t load your account. {profileError}</Text>
            <Text onPress={reloadProfile} accessibilityRole="button" style={styles.retry}>
              Retry
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Loading" />
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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    mark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    cardTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary },
    badge: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, overflow: 'hidden' },
    badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.nano, letterSpacing: trackWide(fontSize.nano), textTransform: 'uppercase', color: colors.textOnBrand },
    body: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary, marginTop: spacing.md },
    list: { gap: spacing.sm, marginTop: spacing.md },
    item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    check: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandFill, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    itemText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textPrimary },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, lineHeight: 16, color: colors.textTertiary, marginTop: spacing.md },
    loadError: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.bgSurfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSubtle },
    loadErrorText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
    retry: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
  });
