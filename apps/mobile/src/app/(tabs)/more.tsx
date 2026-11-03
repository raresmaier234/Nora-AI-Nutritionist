import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppearanceButton } from '@/components/common/appearance-button';
import { LegalLink } from '@/components/common/legal-link';
import { AccountCard } from '@/components/nutrition-plan/account-card';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/typography';
import { LEGAL_LINKS, useAuth } from '@/features/auth';
import { describeError } from '@/services/api';
import { Palette, fontFamily, fontSize, spacing, trackTight, useStyles } from '@/theme';

/**
 * The More tab: appearance, the account (details, sign out, deletion) and the legal links. The
 * nutrition plan that used to share this page with them is on the Strategy tab.
 */
export default function MoreScreen() {
  const styles = useStyles(makeStyles);
  const { user, profile, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState<'signOut' | 'delete' | null>(null);

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
      'This permanently deletes your Nora account, your food log, your plan and your answers. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void runDelete() },
      ],
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.title} accessibilityRole="header">
            More
          </Text>
          <AppearanceButton />
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
          <Text style={styles.note}>Deleting your account removes your food log, plan and answers for good.</Text>
        </View>

        <Text style={styles.legal}>
          <LegalLink link={LEGAL_LINKS.privacy} linkStyle={styles.legalLink} />
          {'  ·  '}
          <LegalLink link={LEGAL_LINKS.terms} linkStyle={styles.legalLink} />
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xxl },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: trackTight(fontSize.display),
      color: colors.textPrimary,
    },
    account: { gap: spacing.md },
    actions: { gap: spacing.md },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center' },
    legal: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary, textAlign: 'center' },
    legalLink: { color: colors.brandPrimary },
  });
