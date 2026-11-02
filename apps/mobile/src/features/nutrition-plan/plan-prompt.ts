import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * The "Build my plan" prompt after a premium user's first sign-in is offered once per user: once
 * answered (Build my plan, Not now or closed) it isn't shown on this phone again.
 */

const key = (userId: string) => `nora.planPrompt.${userId}`;

/** True once this user has answered the prompt on this phone. Storage failures count as answered. */
export async function wasPlanPromptAnswered(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) !== null;
  } catch {
    // Better to skip a prompt than to show it every time storage misbehaves.
    return true;
  }
}

export async function rememberPlanPromptAnswered(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), 'answered');
  } catch {
    // Not critical: at worst it's offered once more.
  }
}
