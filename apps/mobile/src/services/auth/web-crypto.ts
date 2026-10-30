import * as Crypto from 'expo-crypto';

/**
 * The two WebCrypto calls supabase-js makes for Google sign-in's PKCE flow, which React Native's
 * JS engine doesn't provide: `crypto.getRandomValues` for the code verifier (without it,
 * supabase-js falls back to Math.random) and `crypto.subtle.digest` for its SHA-256 challenge
 * (without it, it sends the verifier itself, the "plain" method). Both come from expo-crypto,
 * which is included in Expo Go. Supabase's Expo guide gets the first one from
 * react-native-get-random-values, which Expo Go no longer includes.
 *
 * Deliberately partial: nothing else of `crypto.subtle` exists, so don't use supabase-js's
 * `getClaims()` (it verifies signatures with WebCrypto). Our API is what verifies tokens.
 */
if (typeof globalThis.crypto === 'undefined') {
  const getRandomValues = <T extends ArrayBufferView | null>(array: T): T =>
    Crypto.getRandomValues(array as unknown as Uint8Array) as unknown as T;
  const digest = (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> =>
    Crypto.digest((typeof algorithm === 'string' ? algorithm : algorithm.name) as Crypto.CryptoDigestAlgorithm, data);

  Object.defineProperty(globalThis, 'crypto', {
    value: { getRandomValues, subtle: { digest } },
    configurable: true,
  });
}
