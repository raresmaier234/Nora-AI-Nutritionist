import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/common/splash-overlay';
import { loadFoodIconOverrides } from '@/features/food/icon-overrides';
import { Palette, loadSchemePreference, palettes } from '@/theme';

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
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera/barcode" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="camera/photo" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
    </ThemeProvider>
  );
}
