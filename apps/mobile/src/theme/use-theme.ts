import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { Palette, Scheme, palettes } from './colors';

/**
 * Night mode. The app follows the phone's light/dark setting unless the user picks Light or
 * Dark in the app. The choice goes through `Appearance.setColorScheme`, so React Native's
 * `useColorScheme()` — and native UI: tab bar, keyboard, status bar — follow it too.
 */

export type SchemePreference = 'system' | Scheme;

const STORAGE_KEY = 'nora.colorScheme';

let preference: SchemePreference = 'system';
const listeners = new Set<() => void>();

function apply(next: SchemePreference) {
  preference = next;
  Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  listeners.forEach((l) => l());
}

/** Restore the saved choice. Called once at startup, while the splash screen is up. */
export async function loadSchemePreference(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') apply(saved);
  } catch {
    // Storage unavailable: keep following the phone.
  }
}

export function setSchemePreference(next: SchemePreference) {
  apply(next);
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
}

export function useSchemePreference(): SchemePreference {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => preference,
  );
}

export function useTheme(): { scheme: Scheme; colors: Palette } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme] };
}

export const useColors = (): Palette => useTheme().colors;

/**
 * Styles for the active theme. `factory` must be defined at module level
 * (`const makeStyles = (colors: Palette) => StyleSheet.create({...})`), so they are rebuilt
 * only when the theme changes.
 */
export function useStyles<T>(factory: (colors: Palette, scheme: Scheme) => T): T {
  const { scheme, colors } = useTheme();
  return useMemo(() => factory(colors, scheme), [factory, colors, scheme]);
}
