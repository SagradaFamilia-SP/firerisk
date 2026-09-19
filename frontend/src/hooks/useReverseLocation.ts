import { useEffect, useMemo, useRef, useState } from 'react';

import { apiClient } from '../services/api';
import type { ReverseLocationResponse } from '../types/api';
import type { AsyncState } from './useDashboard';

const idle: AsyncState<ReverseLocationResponse> = { status: 'idle', data: null, error: null };

export function useReverseLocation(fire: { latitude: number; longitude: number } | null) {
  const [state, setState] = useState<AsyncState<ReverseLocationResponse>>(idle);
  const fireRef = useRef(fire);
  fireRef.current = fire;

  useEffect(() => {
    const current = fireRef.current;
    if (!current) {
      setState(idle);
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({ status: 'loading', data: prev.data, error: null }));
    apiClient.reverseLocation(current.latitude, current.longitude, controller.signal).then(
      (data) => setState({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setState({ status: 'error', data: null, error: 'Ubicación no disponible' });
        }
      },
    );
    return () => controller.abort();
    // Depending on the coordinates (not the `fire` object's identity) means a
    // caller passing a fresh `{ latitude, longitude }` literal on every
    // render — as the simulation panel does — doesn't trigger a fetch loop:
    // each resolved lookup would otherwise create a new object, which would
    // re-run this effect, which would resolve again, forever.
  }, [fire?.latitude, fire?.longitude]);

  return useMemo(() => state, [state]);
}
