import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Palette, Scheme, fontFamily, fontSize, radius, spacing, useStyles, useTheme } from '@/theme';

type GoogleSignInButtonProps = {
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
};

/**
 * "Continue with Google", in Google's sign-in button branding: the full-colour G on white with a
 * grey outline in light mode, on near-black in dark mode. Same height and shape as Apple's
 * button above it.
 */
export function GoogleSignInButton({ onPress, busy, disabled }: GoogleSignInButtonProps) {
  const { scheme } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [styles.button, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={BRAND[scheme].text} /> : <GoogleLogo />}
      <Text style={styles.label}>Continue with Google</Text>
    </Pressable>
  );
}

/** Google's sign-in button colours (developers.google.com/identity/branding-guidelines). */
const BRAND: Record<Scheme, { fill: string; stroke: string; text: string }> = {
  light: { fill: '#FFFFFF', stroke: '#747775', text: '#1F1F1F' },
  dark: { fill: '#131314', stroke: '#8E918F', text: '#E3E3E3' },
};

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

// Google's colours, not the app palette — only the scheme matters.
const makeStyles = (colors: Palette, scheme: Scheme) =>
  StyleSheet.create({
    button: {
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: BRAND[scheme].stroke,
      backgroundColor: BRAND[scheme].fill,
    },
    disabled: { opacity: 0.6 },
    pressed: { opacity: 0.85 },
    label: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: BRAND[scheme].text },
  });
