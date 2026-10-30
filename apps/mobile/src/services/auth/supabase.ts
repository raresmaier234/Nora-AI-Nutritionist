import './web-crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { encryptedStorage } from './encrypted-storage';

/**
 * The Supabase client, used for sign-in only: Supabase Auth runs Google and Apple sign-in and
 * issues the access token our API checks. App data never goes through Supabase; that's
 * `src/services/api/`. This is the one network client besides `apiRequest` (see AGENTS.md).
 *
 * Both settings are public by design (see .env.example). Without them the app still runs, but
 * `supabase` is null and the sign-in screen says sign-in isn't configured.
 */
function createSupabase(): SupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    if (__DEV__) {
      console.warn(
        '[auth/supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set, so ' +
          'sign-in is off. Set both in .env.local (see .env.example) and restart Metro.'
      );
    }
    return null;
  }
  try {
    return createClient(url, publishableKey, {
      auth: {
        storage: encryptedStorage,
        // Google sign-in returns a one-time code, swapped for the session together with a
        // verifier only this app holds, instead of tokens in the redirect URL.
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        // There is no browser URL here; the sign-in code reads the redirect itself.
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn(`[auth/supabase] Could not create the Supabase client: ${String(err)}`);
    return null;
  }
}

export const supabase = createSupabase();

export const isAuthConfigured = supabase !== null;

// Outside a browser, supabase-js only refreshes the access token in the background while told
// to. Do that while the app is in the foreground; a resumed app refreshes an expired token on
// its next request anyway.
if (supabase) {
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
