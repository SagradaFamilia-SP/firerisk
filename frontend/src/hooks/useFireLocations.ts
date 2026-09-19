import { useCallback, useRef, useState } from 'react';

import { apiClient } from '../services/api';
import type { ReverseLocationResponse } from '../types/api';

export type FireLocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ReverseLocationResponse }
  | { status: 'error' };

const RESOLVE_DELAY_MS = 1_000;

/**
 * Lazily reverse-geocodes fire detections one at a time (city/municipio labels
 * aren't part of the FIRMS payload). Requests are queued with a small gap
 * between them instead of firing in parallel, since Nominatim's usage policy
 * expects roughly one request per second from a given client; the backend
 * also caches each coordinate for 24h, so repeated lookups across renders or
 * table pages are cheap regardless.
 */
export function useFireLocations() {
  const [labels, setLabels] = useState<Record<string, FireLocationState>>({});
  const requested = useRef<Set<string>>(new Set());
  const queue = useRef<Promise<void>>(Promise.resolve());

  const resolve = useCallback((id: string, lat: number, lon: number) => {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    setLabels((current) => ({ ...current, [id]: { status: 'loading' } }));
    queue.current = queue.current
      .then(() => new Promise<void>((wake) => window.setTimeout(wake, RESOLVE_DELAY_MS)))
      .then(() => apiClient.reverseLocation(lat, lon).then(
        (data) => setLabels((current) => ({ ...current, [id]: { status: 'success', data } })),
        () => setLabels((current) => ({ ...current, [id]: { status: 'error' } })),
      ));
  }, []);

  return { labels, resolve };
}

export type FireLocations = ReturnType<typeof useFireLocations>;
