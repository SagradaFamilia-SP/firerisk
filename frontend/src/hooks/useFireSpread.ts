import { useEffect, useRef, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type { FireDetection, SpreadResponse } from '../types/api';
import type { AsyncState } from './useDashboard';
import type { LiveFires } from './useLiveFires';

const empty: AsyncState<SpreadResponse> = { status: 'idle', data: null, error: null };

/**
 * Owns both the spread simulation for the selected fire AND the timeline hour,
 * so the slider only ever drives this real simulation (never a mock scenario).
 */
export function useFireSpread(liveFires: LiveFires) {
  const detectionsRef = useRef<FireDetection[]>([]);
  detectionsRef.current = liveFires.state.data?.detections ?? [];
  const [state, setState] = useState<AsyncState<SpreadResponse>>(empty);
  const [hour, setHour] = useState(0);

  useEffect(() => {
    const fireId = liveFires.selectedFireId;
    const fire = fireId ? detectionsRef.current.find((item) => item.id === fireId) : undefined;
    setHour(0);
    if (!fire) {
      setState(empty);
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ status: 'loading', data: current.data, error: null }));
    apiClient.spread({ lat: fire.latitude, lon: fire.longitude }, controller.signal).then(
      (data) => setState({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setState((current) => ({ status: 'error', data: current.data, error: getErrorMessage(error) }));
        }
      },
    );
    return () => controller.abort();
  }, [liveFires.selectedFireId]);

  return { ...state, hour, setHour };
}

export type FireSpread = ReturnType<typeof useFireSpread>;
