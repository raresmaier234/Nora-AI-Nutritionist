import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/** The signed-in user's access token, for our API's Authorization header; null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type RefreshResult =
  | { status: 'refreshed'; token: string }
  /** The session is over (refresh token revoked or expired, user deleted…): sign out. */
  | { status: 'expired' }
  /** Supabase couldn't be reached; the session may still be fine. */
  | { status: 'unreachable' };

/**
 * A new access token after our API refused `rejected`. If another request has already refreshed
 * the session, its token is used rather than refreshing again.
 */
export async function refreshAccessToken(rejected: string): Promise<RefreshResult> {
  if (!supabase) return { status: 'expired' };
  const current = await getAccessToken();
  if (current && current !== rejected) return { status: 'refreshed', token: current };

  const { data, error } = await supabase.auth.refreshSession();
  if (error && isAuthRetryableFetchError(error)) return { status: 'unreachable' };
  const token = data.session?.access_token;
  return token ? { status: 'refreshed', token } : { status: 'expired' };
}

/**
 * Signs out on this phone only: Supabase revokes this session and supabase-js clears it, which
 * takes the app back to the sign-in screen. Sessions on the user's other devices stay signed in.
 */
export async function endSession(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error && __DEV__) console.warn(`[auth/session] Sign-out reported: ${error.message}`);
}
