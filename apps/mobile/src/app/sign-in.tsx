import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { EmailSignIn } from '@/components/auth/email-sign-in';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { LegalLink } from '@/components/common/legal-link';
import { AlertIcon } from '@/components/log/icons';
import { LEGAL_LINKS, useAuth } from '@/features/auth';
import { SignInError, googleRedirectUrl, isAppleSignInAvailable } from '@/services/auth';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, useStyles, useTheme } from '@/theme';

type Provider = 'google' | 'apple';
type Message = { kind: 'error' | 'info'; text: string };

/**
 * The only screen a signed-out user sees (see the guards in src/app/_layout.tsx). Sign in with
 * Apple on iPhone (Apple's own button, as App Review expects), Google everywhere, or a one-time
 * code sent by email — no passwords. There is no sign-up: the first sign-in creates the account.
 * Once signed in, the guards swap this screen for the tabs.
 */
export default function SignInScreen() {
  const { configured, signInWithGoogle, signInWithApple } = useAuth();
  const { scheme, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const anyBusy = busy !== null || emailBusy;
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (provider: Provider) => {
    setBusy(provider);
    setMessage(null);
    try {
      const signedIn = await (provider === 'google' ? signInWithGoogle() : signInWithApple());
      // Backing out of Apple's sheet needs no comment; a closed browser might be a mistake.
      if (!signedIn && provider === 'google') setMessage({ kind: 'info', text: 'Google sign-in was cancelled.' });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof SignInError ? err.message : 'Something went wrong while signing in. Please try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.hero}>
          <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={styles.mark}>
            <LeafGlyph color={colors.white} />
          </LinearGradient>
          <Text style={styles.name} accessibilityRole="header">
            Nora
          </Text>
          <Text style={styles.tagline}>Your AI nutritionist</Text>
          <Text style={styles.pitch}>Log what you eat, see everything it gives you, and stay on top of your daily targets.</Text>
        </View>

        <View style={styles.actions}>
          {configured ? (
            <>
              {appleAvailable ? (
                <View pointerEvents={anyBusy ? 'none' : 'auto'} style={anyBusy && styles.dimmed}>
                  <AppleAuthentication.AppleAuthenticationButton
                    // The native button takes its style once; remount it when night mode changes.
                    key={scheme}
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={
                      scheme === 'dark'
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    cornerRadius={25}
                    style={styles.appleButton}
                    onPress={() => signIn('apple')}
                  />
                </View>
              ) : null}
              <GoogleSignInButton onPress={() => signIn('google')} busy={busy === 'google'} disabled={anyBusy} />
              {__DEV__ ? (
                // Must be in Supabase's Redirect URLs, or Google sign-in ends on the Site URL.
                <Text selectable style={styles.devNote}>
                  Dev · Google returns to {googleRedirectUrl()}
                </Text>
              ) : null}
              <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <EmailSignIn disabled={busy !== null} onBusyChange={setEmailBusy} />
            </>
          ) : (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Sign-in is not configured</Text>
              <Text style={styles.noticeText}>
                This build of Nora has no Supabase settings, so nobody can sign in.
                {__DEV__
                  ? ' Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example), then restart Metro.'
                  : ''}
              </Text>
            </View>
          )}

          {message ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.message, message.kind === 'error' ? styles.messageError : styles.messageInfo]}>
              {message.kind === 'error' ? <AlertIcon size={16} color={colors.errorText} /> : null}
              <Text style={[styles.messageText, message.kind === 'error' && styles.messageTextError]}>{message.text}</Text>
            </View>
          ) : null}

          <Text style={styles.legal}>
            By continuing you agree to Nora’s <LegalLink link={LEGAL_LINKS.terms} style={styles.legalName} linkStyle={styles.legalLink} />{' '}
            and acknowledge its <LegalLink link={LEGAL_LINKS.privacy} style={styles.legalName} linkStyle={styles.legalLink} />.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A leaf (Lucide "leaf", ISC licence) for the brand mark. */
function LeafGlyph({ color }: { color: string }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <Path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </Svg>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    content: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.xxxl * 2,
      paddingBottom: spacing.xl,
      gap: spacing.xxxl,
    },
    hero: { alignItems: 'center' },
    mark: {
      width: 76,
      height: 76,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.glowPrimary,
      marginBottom: spacing.xl,
    },
    name: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display2,
      letterSpacing: trackTight(fontSize.display2),
      color: colors.textPrimary,
    },
    tagline: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.brandPrimary, marginTop: spacing.xs },
    pitch: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.body,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.lg,
      maxWidth: 300,
    },
    actions: { gap: spacing.md },
    appleButton: { width: '100%', height: 50 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
    dividerText: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textTertiary },
    dimmed: { opacity: 0.6 },
    devNote: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, textAlign: 'center' },
    notice: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.warningTint,
      gap: spacing.xs,
    },
    noticeTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.amberText },
    noticeText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary },
    message: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    },
    messageError: { backgroundColor: colors.dangerTint },
    messageInfo: { backgroundColor: colors.surfaceMuted },
    messageText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary },
    messageTextError: { color: colors.errorText },
    legal: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.micro,
      lineHeight: 16,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    legalName: { fontFamily: fontFamily.bold, color: colors.textSecondary },
    legalLink: { color: colors.brandPrimary },
  });
