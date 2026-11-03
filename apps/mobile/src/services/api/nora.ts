import { apiRequest } from './client';
import type { NoraChatReply, NoraMessage } from './types';

/** Claude thinks before it answers: give it far longer than an ordinary request. */
const CHAT_TIMEOUT_MS = 60_000;

/**
 * Nora's answer to the conversation's last message (POST /nora/chat, premium only). `messages`
 * is the whole conversation, oldest first, starting and ending with the user; `date` is the
 * user's local day (YYYY-MM-DD), whose log Nora sees.
 */
export function chatWithNora(messages: NoraMessage[], date: string): Promise<NoraChatReply> {
  return apiRequest<NoraChatReply>('/nora/chat', { method: 'POST', body: { messages, date }, timeoutMs: CHAT_TIMEOUT_MS });
}
