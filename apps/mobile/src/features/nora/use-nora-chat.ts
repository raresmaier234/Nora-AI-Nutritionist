import { useRef, useState } from 'react';

import { chatWithNora, describeError, type NoraMessage } from '@/services/api';
import { toDateString } from '@/features/food/hooks/use-food-log';

/** What POST /nora/chat accepts: the latest 30 messages, Nora's own at most 8000 characters. */
const MAX_MESSAGES = 30;
const MAX_REPLY_CHARS = 8000;
/** The longest message the user can type (the API's limit). */
export const MAX_MESSAGE_CHARS = 2000;

export type ChatTurn = NoraMessage & { id: number };

/** The conversation as the API wants it: the latest messages, starting with one of the user's. */
function toSend(turns: ChatTurn[]): NoraMessage[] {
  const latest = turns.slice(-MAX_MESSAGES);
  const start = latest.findIndex((t) => t.role === 'user');
  return latest.slice(start).map((t) => ({ role: t.role, content: t.role === 'assistant' ? t.content.slice(0, MAX_REPLY_CHARS) : t.content }));
}

/**
 * A conversation with Nora. It lives in this screen's state only: nothing is saved on the phone
 * or the server, so it lasts while the app is open and is gone after sign-out or a restart.
 * Each message sends the whole conversation, and Nora sees today's log with it.
 */
export function useNoraChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  // Bumped by "New chat", so a reply to the old conversation doesn't land in the new one.
  const chatId = useRef(0);

  const request = (conversation: ChatTurn[]) => {
    const forChat = chatId.current;
    setSending(true);
    setError(null);
    chatWithNora(toSend(conversation), toDateString(new Date())).then(
      ({ reply }) => {
        if (forChat !== chatId.current) return;
        const id = nextId.current++;
        setTurns((t) => [...t, { id, role: 'assistant', content: reply }]);
        setSending(false);
      },
      (err: unknown) => {
        if (forChat !== chatId.current) return;
        setError(describeError(err));
        setSending(false);
      },
    );
  };

  /** Send a message; ignored while Nora is still answering. */
  const send = (text: string) => {
    const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content || sending) return;
    const conversation: ChatTurn[] = [...turns, { id: nextId.current++, role: 'user', content }];
    setTurns(conversation);
    request(conversation);
  };

  /** Ask again after an error: the last message is still the user's. */
  const retry = () => {
    if (!sending && turns.at(-1)?.role === 'user') request(turns);
  };

  const reset = () => {
    chatId.current += 1;
    setTurns([]);
    setSending(false);
    setError(null);
  };

  return { turns, sending, error, send, retry, reset };
}
