import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Icons the user picked for a food, remembered on this device. Keyed by the food's name
 * (case- and space-insensitive), so a choice for "Whole milk" applies to every entry, search
 * result and ingredient with that name. Not synced to the server.
 */

const STORAGE_KEY = 'nora.foodIcons';

let overrides: Record<string, string> = {};
const listeners = new Set<() => void>();

const keyFor = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

function publish(next: Record<string, string>) {
  overrides = next;
  listeners.forEach((l) => l());
}

/** Restore saved choices. Called once at startup. */
export async function loadFoodIconOverrides(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) publish(JSON.parse(saved));
  } catch {
    // Storage unavailable or unreadable: icons fall back to automatic.
  }
}

/** Use `src` for this food from now on; null goes back to the automatic icon. */
export function setFoodIcon(name: string, src: string | null) {
  const key = keyFor(name);
  if (!key) return;
  const next = { ...overrides };
  if (src) next[key] = src;
  else delete next[key];
  publish(next);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

export function useFoodIconOverride(name: string): string | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => overrides[keyFor(name)],
  );
}
