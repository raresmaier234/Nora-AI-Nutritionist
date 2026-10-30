import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** A sign-in that failed; `message` is written for the user. */
export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInError';
  }
}

function client() {
  if (!supabase) throw new SignInError('Sign-in is not configured for this build of Nora.');
  return supabase;
}

/** Query and fragment parameters of the URL Supabase redirected back to. */
function redirectParams(url: string): URLSearchParams {
  const { search, hash } = new URL(url);
  const params = new URLSearchParams(search);
  new URLSearchParams(hash.replace(/^#/, '')).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

/**
 * Where Supabase sends the browser back to after Google: noraainutrition://auth/callback in
 * builds, exp://<Metro host>/--/auth/callback in Expo Go. It must be listed under Supabase →
 * Authentication → URL Configuration → Redirect URLs, or Supabase falls back to its Site URL.
 */
function googleRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

/**
 * Google, through Supabase in the system browser — no native module, so it works in Expo Go.
 * Google returns to Supabase's own callback, which redirects to `redirectTo` with a one-time
 * code; supabase-js swaps that code (plus the PKCE verifier it kept) for the session.
 *
 * Resolves true once signed in, false if the user closed the browser. Throws SignInError.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const auth = client().auth;
  const redirectTo = googleRedirectUrl();

  const { data, error } = await auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Always offer the account picker, so signing out and back in can switch accounts.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) throw new SignInError("Couldn't start Google sign-in. Check your connection and try again.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success') throw new SignInError("Couldn't open Google sign-in. Please try again.");

  const params = redirectParams(result.url);
  const failure = params.get('error_description') ?? params.get('error');
  if (failure) throw new SignInError(`Google sign-in failed: ${failure}`);
  const code = params.get('code');
  if (!code) throw new SignInError('Google sign-in didn’t finish. Please try again.');

  const { error: exchangeError } = await auth.exchangeCodeForSession(code);
  if (exchangeError) throw new SignInError(`Google sign-in failed: ${exchangeError.message}`);
  return true;
}

/** Sign in with Apple exists on iOS only (Android users sign in with Google). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

function isCanceled(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ERR_REQUEST_CANCELED';
}

/**
 * Apple's native sheet, then Supabase signs in with Apple's identity token. Apple puts the SHA-256
 * of our random nonce in that token; Supabase checks it against the raw nonce, so a stolen token
 * can't be replayed.
 *
 * Apple shares the user's name only on their very first sign-in, so it's saved to the Supabase
 * user's metadata then. Resolves with that name (null after the first time), or null if the
 * user cancelled. Throws SignInError.
 */
export async function signInWithApple(): Promise<{ fullName: string | null } | null> {
  const auth = client().auth;
  const nonce = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isCanceled(err)) return null;
    throw new SignInError('Sign in with Apple failed. Please try again.');
  }
  if (!credential.identityToken) throw new SignInError('Apple didn’t confirm who you are. Please try again.');

  const { error } = await auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce });
  if (error) throw new SignInError(`Sign in with Apple failed: ${error.message}`);

  const givenName = credential.fullName?.givenName ?? null;
  const familyName = credential.fullName?.familyName ?? null;
  const fullName = [givenName, credential.fullName?.middleName, familyName].filter(Boolean).join(' ') || null;
  if (fullName) {
    const { error: nameError } = await auth.updateUser({
      data: { full_name: fullName, given_name: givenName, family_name: familyName },
    });
    // Signed in either way; the name can also be set on the Profile tab.
    if (nameError && __DEV__) console.warn(`[auth/sign-in] Could not save Apple's name: ${nameError.message}`);
  }
  return { fullName };
}

/** What a Supabase email-code error means for the user. */
function emailCodeError(error: { code?: string; status?: number; message: string }, step: 'send' | 'verify'): string {
  if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many codes asked for. Wait a minute, then try again.';
  }
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
    return 'That email address doesn’t look right.';
  }
  if (error.code === 'otp_expired') return 'That code is wrong or has expired. Check the latest email, or send a new code.';
  if (error.code === 'otp_disabled' || error.code === 'email_provider_disabled') {
    return 'Signing in with email is turned off. Use Apple or Google instead.';
  }
  return step === 'send'
    ? `Couldn’t send the code: ${error.message}`
    : `Couldn’t sign in with that code: ${error.message}`;
}

/**
 * Email sign-in, step 1: Supabase emails a one-time code. The first time an address is used,
 * this also creates the account — there is no separate sign-up. No password is ever set.
 * Throws SignInError.
 */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new SignInError(emailCodeError(error, 'send'));
}

/** Email sign-in, step 2: the code from that email signs in. Throws SignInError. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new SignInError(emailCodeError(error, 'verify'));
}
