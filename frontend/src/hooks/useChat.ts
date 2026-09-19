import { useCallback, useMemo, useRef, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type { ChatResponse } from '../types/api';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fires?: ChatResponse['fires'];
  summary?: ChatResponse['summary'];
}

let nextId = 0;
const newId = () => `chat-${Date.now()}-${nextId++}`;

export function useChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback((message: string) => {
    const trimmed = message.trim();
    if (trimmed === '' || pending) return;

    const history = entries.map((entry) => ({ role: entry.role, content: entry.content }));
    setEntries((current) => [...current, { id: newId(), role: 'user' as const, content: trimmed }]);
    setPending(true);
    setError(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    apiClient.chat(trimmed, history, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setEntries((current) => [
          ...current,
          { id: newId(), role: 'assistant' as const, content: data.reply, fires: data.fires, summary: data.summary },
        ]);
        setPending(false);
      },
      (err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setError(getErrorMessage(err));
        setPending(false);
      },
    );
  }, [entries, pending]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setEntries([]);
    setError(null);
    setPending(false);
  }, []);

  return useMemo(() => ({ entries, pending, error, send, reset }), [entries, pending, error, send, reset]);
}

export type Chat = ReturnType<typeof useChat>;
