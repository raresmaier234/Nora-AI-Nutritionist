import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Where supabase-js keeps the session, following Supabase's Expo guide ("LargeSecureStore"): a
 * session is bigger than SecureStore's ~2 KB per value, so each value is encrypted with a random
 * AES-256 key that lives in SecureStore (iOS Keychain / Android Keystore), and only the
 * ciphertext goes to AsyncStorage. The guide encrypts with aes-js (AES-CTR) and
 * react-native-get-random-values; this uses expo-crypto's AES-GCM instead: native,
 * authenticated, and included in Expo Go.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// supabase-js reads and writes its keys without a lock, so two writes of the same key could
// interleave their key and ciphertext writes. Running every operation in turn rules that out.
let queue: Promise<unknown> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function remove(name: string) {
  await AsyncStorage.removeItem(name);
  await SecureStore.deleteItemAsync(name);
}

export const encryptedStorage = {
  getItem: (name: string) =>
    inTurn(async (): Promise<string | null> => {
      const sealed = await AsyncStorage.getItem(name);
      const keyBase64 = sealed ? await SecureStore.getItemAsync(name) : null;
      if (!sealed || !keyBase64) return null;
      try {
        const key = await AESEncryptionKey.import(keyBase64, 'base64');
        return decoder.decode(await aesDecryptAsync(AESSealedData.fromCombined(sealed), key));
      } catch {
        // Tampered with, or its key is gone (e.g. restored onto another phone): signed out.
        await remove(name);
        return null;
      }
    }),

  setItem: (name: string, value: string) =>
    inTurn(async () => {
      const saved = await SecureStore.getItemAsync(name);
      const key = saved ? await AESEncryptionKey.import(saved, 'base64') : await AESEncryptionKey.generate();
      if (!saved) await SecureStore.setItemAsync(name, await key.encoded('base64'));
      const sealed = await aesEncryptAsync(encoder.encode(value), key);
      await AsyncStorage.setItem(name, await sealed.combined('base64'));
    }),

  removeItem: (name: string) => inTurn(() => remove(name)),
};
