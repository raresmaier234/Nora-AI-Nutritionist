import type { Session, User } from '@supabase/supabase-js';
import { ReactNode, createContext, useEffect, useState } from 'react';

import { UserProfile, UserProfileUpdate, deleteMe, describeError, getMe, updateMe } from '@/services/api';
import {
  endSession,
  isAuthConfigured,
  sendEmailCode,
  signInWithApple as appleSignIn,
  signInWithGoogle as googleSignIn,
  supabase,
  verifyEmailCode,
} from '@/services/auth';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthContextValue = {
  /** 'loading' while the saved session is being restored at startup. */
  status: AuthStatus;
  /** False when the Supabase settings are missing from this build: nobody can sign in. */
  configured: boolean;
  /** Who is signed in, per Supabase: id, email, the provider used. Null when signed out. */
  user: User | null;
  /** Our profile (GET /users/me): name, plan, daily targets. Null while it loads or if it failed. */
  profile: UserProfile | null;
  /** Why the profile failed to load, for the user. */
  profileError: string | null;
  /** True once signed in, false if the user backed out. Throws SignInError. */
  signInWithGoogle: () => Promise<boolean>;
  /** True once signed in, false if the user backed out. Throws SignInError. */
  signInWithApple: () => Promise<boolean>;
  /** Emails a one-time sign-in code (creating the account the first time). Throws SignInError. */
  sendEmailCode: (email: string) => Promise<void>;
  /** Signs in with the emailed code. Throws SignInError. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Deletes the account and all its data, then signs out. Throws ApiError if it failed. */
  deleteAccount: () => Promise<void>;
  /** PATCH /users/me; resolves with the saved profile. Throws ApiError (422 for invalid targets). */
  updateProfile: (changes: UserProfileUpdate) => Promise<UserProfile>;
  reloadProfile: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/** The last profile response, and whose it was — it only counts while that user is signed in. */
type LoadedProfile = { userId: string; profile: UserProfile | null; error: string | null };

/**
 * Who is signed in, and their profile. The session comes from supabase-js, which restores it
 * from the phone at startup and keeps it fresh; the profile comes from our API once there is a
 * session, and again whenever a different user signs in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined while the saved session is being restored.
  const [session, setSession] = useState<Session | null | undefined>(() => (supabase ? undefined : null));
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    // Sign-in, sign-out, token refreshes — including the sign-out after a refused token.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMe()
      .then((profile) => {
        if (!cancelled) setLoaded({ userId, profile, error: null });
      })
      .catch((err: unknown) => {
        // A failed reload keeps the profile already on screen.
        if (!cancelled) setLoaded((prev) => ({ userId, profile: prev?.userId === userId ? prev.profile : null, error: describeError(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const current = loaded && loaded.userId === userId ? loaded : null;

  const signInWithApple = async () => {
    const result = await appleSignIn();
    if (!result) return false;
    if (result.fullName) {
      // Apple sends the name only on the first sign-in, and the API may already have created the
      // profile (on the app's first request) before the name reached Supabase. Save it there too.
      try {
        const me = await getMe();
        const saved = me.display_name ? me : await updateMe({ display_name: result.fullName });
        setLoaded({ userId: saved.id, profile: saved, error: null });
      } catch {
        // Signed in regardless; the name can be set on the Profile tab.
      }
    }
    return true;
  };

  const signOut = async () => {
    await endSession();
    setLoaded(null);
  };

  const deleteAccount = async () => {
    await deleteMe();
    // The Supabase user is gone too; clear this phone's session.
    await endSession();
    setLoaded(null);
  };

  const updateProfile = async (changes: UserProfileUpdate) => {
    const profile = await updateMe(changes);
    setLoaded({ userId: profile.id, profile, error: null });
    return profile;
  };

  const value: AuthContextValue = {
    status: session === undefined ? 'loading' : session ? 'signedIn' : 'signedOut',
    configured: isAuthConfigured,
    user,
    profile: current?.profile ?? null,
    profileError: current?.error ?? null,
    signInWithGoogle: googleSignIn,
    signInWithApple,
    sendEmailCode,
    verifyEmailCode,
    signOut,
    deleteAccount,
    updateProfile,
    reloadProfile: () => setReloadKey((k) => k + 1),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
