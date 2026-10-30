import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppearanceButton } from '@/components/common/appearance-button';
import { LegalLink } from '@/components/common/legal-link';
import { AccountCard } from '@/components/nutrition-plan/account-card';
import { ChangePlanSheet } from '@/components/nutrition-plan/change-plan-sheet';
import { PlanCard } from '@/components/nutrition-plan/plan-card';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/typography';
import { LEGAL_LINKS, useAuth } from '@/features/auth';
import { describeError } from '@/services/api';
import { Palette, fontFamily, fontSize, radius, spacing, trackTight, useColors, useStyles } from '@/theme';

/** Room under the content so its end can scroll clear of the tab bar. */
const TAB_BAR_CLEARANCE = 96;

/**
 * The Profile tab: the user's nutrition plan first — the daily targets everything measures
 * against, read-only; "Change plan" is the only way to change them (by answering questions, once
 * the plan builder exists: apps/api/docs/plans/ai-nutrition-plan.md). Account details, sign out
 * and account deletion sit in a section at the bottom.
 */
export default function ProfileScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { user, profile, profileError, reloadProfile, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState<'signOut' | 'delete' | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);

  const runSignOut = async () => {
    setBusy('signOut');
    try {
      await signOut();
    } finally {
      setBusy(null);
    }
  };

  const runDelete = async () => {
    setBusy('delete');
    try {
      await deleteAccount();
    } catch (err) {
      Alert.alert('Account not deleted', `${describeError(err)} Your account and data are unchanged; please try again.`);
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your Nora account, your food log and your daily targets. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void runDelete() },
      ],
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.title} accessibilityRole="header">
            Profile
          </Text>
          <AppearanceButton />
        </View>

        <View>
          <SectionLabel>Your plan</SectionLabel>
          {profile ? (
            <View style={styles.plan}>
              <PlanCard targets={profile.targets} />
              <Button label="Change plan" variant="secondary" onPress={() => setChangingPlan(true)} />
            </View>
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
        </View>

        <View style={styles.account}>
          <SectionLabel>Account</SectionLabel>
          <AccountCard
            name={profile?.display_name ?? null}
            email={profile?.email ?? user?.email ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            plan={profile?.plan ?? null}
            provider={typeof user?.app_metadata.provider === 'string' ? user.app_metadata.provider : null}
          />
          <View style={styles.actions}>
            <Button label={busy === 'signOut' ? 'Signing out…' : 'Sign out'} variant="secondary" onPress={runSignOut} disabled={busy !== null} />
            <Button
              label={busy === 'delete' ? 'Deleting…' : 'Delete account'}
              variant="destructive"
              onPress={confirmDelete}
              disabled={busy !== null}
            />
          </View>
          <Text style={styles.note}>Deleting your account removes your food log and targets for good.</Text>
        </View>

        <Text style={styles.legal}>
          <LegalLink link={LEGAL_LINKS.privacy} linkStyle={styles.legalLink} />
          {'  ·  '}
          <LegalLink link={LEGAL_LINKS.terms} linkStyle={styles.legalLink} />
        </Text>
      </ScrollView>

      <ChangePlanSheet visible={changingPlan} onClose={() => setChangingPlan(false)} />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.xxl },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: trackTight(fontSize.display),
      color: colors.textPrimary,
    },
    loadError: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.bgSurfaceSolid,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    loadErrorText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
    retry: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
    plan: { gap: spacing.md },
    account: { gap: spacing.md },
    actions: { gap: spacing.md },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center' },
    legal: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary, textAlign: 'center' },
    legalLink: { color: colors.brandPrimary },
  });
