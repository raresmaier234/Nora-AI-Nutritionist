import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/common/splash-overlay';
import { AuthProvider, useAuth } from '@/features/auth';
import { loadFoodIconOverrides } from '@/features/food/icon-overrides';
import { Palette, loadSchemePreference, palettes, useColors, useStyles } from '@/theme';

SplashScreen.preventAutoHideAsync();
// Apply the saved Auto / Light / Dark choice while the splash screen is still up.
loadSchemePreference();
loadFoodIconOverrides();

/** React Navigation's theme in the app's own colors, so screen and modal backgrounds match. */
const navigationTheme = (base: Theme, colors: Palette): Theme => ({
  ...base,
  colors: {
    ...base.colors,
    primary: colors.brandPrimary,
    background: colors.bgApp,
    card: colors.bgSurfaceSolid,
    text: colors.textPrimary,
    border: colors.borderSubtle,
    notification: colors.stateError,
  },
});
const NAV_THEMES = { light: navigationTheme(DefaultTheme, palettes.light), dark: navigationTheme(DarkTheme, palettes.dark) };

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? NAV_THEMES.dark : NAV_THEMES.light}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Protected routes: signed out, only sign-in exists; signed in, everything but sign-in. When the
 * session changes (sign-in, sign-out, a refused token), Expo Router moves to the first screen the
 * guards allow — sign-in, or the tabs. Routes in neither group (the auth callback, dev screens)
 * are reachable either way.
 */
function RootStack() {
  const { status } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Until the saved session is restored it isn't known which screens exist yet.
  if ((!fontsLoaded && !fontError) || status === 'loading') return <Restoring />;
  const signedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera/barcode" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="camera/photo" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}

function Restoring() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.restoring}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    restoring: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgApp },
  });
