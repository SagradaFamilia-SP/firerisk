import { useEffect, useMemo, useState } from 'react';

import { apiClient } from '../services/api';
import type { ReverseLocationResponse } from '../types/api';
import type { AsyncState } from './useDashboard';

const idle: AsyncState<ReverseLocationResponse> = { status: 'idle', data: null, error: null };

export function useReverseLocation(fire: { latitude: number; longitude: number } | null) {
  const [state, setState] = useState<AsyncState<ReverseLocationResponse>>(idle);

  useEffect(() => {
    if (!fire) {
      setState(idle);
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ status: 'loading', data: current.data, error: null }));
    apiClient.reverseLocation(fire.latitude, fire.longitude, controller.signal).then(
      (data) => setState({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setState({ status: 'error', data: null, error: 'Ubicación no disponible' });
        }
      },
    );
    return () => controller.abort();
  }, [fire]);

  return useMemo(() => state, [state]);
}
