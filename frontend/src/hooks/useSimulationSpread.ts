import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type { SpreadResponse } from '../types/api';
import type { AsyncState } from './useDashboard';

export interface SimulationPoint { lat: number; lon: number }
export interface SimulationScenario { frpMw: number; brightnessK: number }

const empty: AsyncState<SpreadResponse> = { status: 'idle', data: null, error: null };
const DEFAULT_SCENARIO: SimulationScenario = { frpMw: 4.9, brightnessK: 336.6 };

/**
 * Runs the same real spread simulation as a selected live fire, but for an
 * arbitrary point the user clicks on the map — "what would happen if a fire
 * started here" rather than "what is this real fire doing".
 */
export function useSimulationSpread() {
  const [point, setPointState] = useState<SimulationPoint | null>(null);
  const [scenario, setScenario] = useState<SimulationScenario>(DEFAULT_SCENARIO);
  const [state, setState] = useState<AsyncState<SpreadResponse>>(empty);
  const [hour, setHour] = useState(0);

  useEffect(() => {
    setHour(0);
    if (!point) {
      setState(empty);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState({ status: 'loading', data: null, error: null });
      apiClient.spread({
        lat: point.lat,
        lon: point.lon,
        frp_mw: scenario.frpMw,
        brightness_k: scenario.brightnessK,
      }, controller.signal).then(
        (data) => setState({ status: 'success', data, error: null }),
        (error: unknown) => {
          if ((error as Error).name !== 'AbortError') {
            setState({ status: 'error', data: null, error: getErrorMessage(error) });
          }
        },
      );
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [point, scenario]);

  const pick = useCallback((lat: number, lon: number) => setPointState({ lat, lon }), []);
  const clear = useCallback(() => setPointState(null), []);
  const updateScenario = useCallback((change: Partial<SimulationScenario>) => {
    setScenario((current) => ({ ...current, ...change }));
  }, []);

  return useMemo(() => ({
    point, pick, clear, scenario, updateScenario, ...state, hour, setHour,
  }), [point, pick, clear, scenario, updateScenario, state, hour]);
}

export type SimulationSpread = ReturnType<typeof useSimulationSpread>;
