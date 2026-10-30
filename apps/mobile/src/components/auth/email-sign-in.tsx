import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AlertIcon } from '@/components/log/icons';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/features/auth';
import { SignInError } from '@/services/auth';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';

/** Supabase lets an address ask for a new code once a minute. */
const RESEND_SECONDS = 60;

type EmailSignInProps = {
  /** Another sign-in is running; don't start this one. */
  disabled?: boolean;
  /** Tells the screen when this form is busy, so it can hold the other buttons. */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Sign in with an emailed one-time code — no password. Step one asks for the email and has
 * Supabase send the code (creating the account the first time); step two takes the code.
 */
export function EmailSignIn({ disabled, onBusyChange }: EmailSignInProps) {
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [email, setEmail] = useState('');
  /** The address the code went to; set once it's sent, which moves to step two. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof SignInError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  const send = (to: string) =>
    run(async () => {
      await sendEmailCode(to);
      setSentTo(to);
      setCode('');
      setResendIn(RESEND_SECONDS);
    });
  // Signing in swaps this screen for the tabs, so there is nothing to do after it.
  const verify = () => run(() => verifyEmailCode(sentTo!, code.trim()));

  const trimmed = email.trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const codeLooksValid = /^\d{6,10}$/.test(code.trim());
  const locked = disabled || busy;

  return (
    <View style={styles.root}>
      {sentTo === null ? (
        <>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            accessibilityLabel="Email address"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            editable={!locked}
            onSubmitEditing={() => emailLooksValid && !locked && send(trimmed)}
          />
          <Button label={busy ? 'Sending…' : 'Email me a sign-in code'} variant="secondary" disabled={!emailLooksValid || locked} onPress={() => send(trimmed)} />
        </>
      ) : (
        <>
          <Text style={styles.sent}>
            We sent a code to <Text style={styles.sentTo}>{sentTo}</Text>. It may take a minute — check spam too.
          </Text>
          <Field
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            placeholder="Code from the email"
            accessibilityLabel="Sign-in code"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={10}
            returnKeyType="done"
            editable={!locked}
            onSubmitEditing={() => codeLooksValid && !locked && verify()}
            // Spaced-out digits read like a code; the placeholder stays normal text.
            style={code ? styles.codeField : null}
          />
          <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={!codeLooksValid || locked} onPress={verify} />
          <View style={styles.links}>
            <Pressable
              onPress={() => {
                setSentTo(null);
                setCode('');
                setError(null);
              }}
              disabled={locked}
              accessibilityRole="button"
              hitSlop={8}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
            <Pressable onPress={() => send(sentTo)} disabled={locked || resendIn > 0} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, resendIn > 0 && styles.linkDisabled]}>
                {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {busy ? <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Working" /> : null}
      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <AlertIcon size={16} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { gap: spacing.md },
    sent: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary, textAlign: 'center' },
    sentTo: { fontFamily: fontFamily.bold, color: colors.textPrimary },
    codeField: { textAlign: 'center', letterSpacing: 6, fontSize: fontSize.h2 },
    links: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
    link: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },
    linkDisabled: { color: colors.textTertiary },
    error: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.dangerTint,
    },
    errorText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.small, lineHeight: 19, color: colors.errorText },
  });
