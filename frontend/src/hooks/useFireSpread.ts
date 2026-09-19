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
    // Unlike the other async hooks, never carry the previous value into this
    // loading/error state: `data` here is a single fire's simulation, and
    // keeping the old fire's polygon/radius around under the newly selected
    // fire's name (e.g. after a transient weather-fetch failure) is actively
    // misleading, not resilient — the map camera and the detail panel would
    // both go on describing the fire the user just left.
    setState({ status: 'loading', data: null, error: null });
    apiClient.spread({ lat: fire.latitude, lon: fire.longitude }, controller.signal).then(
      (data) => setState({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setState({ status: 'error', data: null, error: getErrorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, [liveFires.selectedFireId]);

  return { ...state, hour, setHour };
}

export type FireSpread = ReturnType<typeof useFireSpread>;
