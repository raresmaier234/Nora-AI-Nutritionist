import { Redirect } from 'expo-router';

/**
 * Where Google sign-in returns to (`Linking.createURL('auth/callback')`). On iOS the browser
 * session hands that URL straight back to `signInWithGoogle()`, which swaps its code for the
 * session. Android also delivers it to the app as a deep link, and Expo Router opens it like
 * any other URL — this route just moves on, to the tabs once signed in or back to sign-in.
 */
export default function AuthCallbackRoute() {
  return <Redirect href="/" />;
}
