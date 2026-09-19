import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type { HealthResponse } from '../types/api';

export type AsyncState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: string };

export type LayerKey = 'fire' | 'spread';

const empty = <T,>(): AsyncState<T> => ({ status: 'idle', data: null, error: null });

export function useDashboard() {
  const [health, setHealth] = useState<AsyncState<HealthResponse>>(empty);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ fire: true, spread: true });
  const [baseMap, setBaseMap] = useState<'satellite' | 'street'>('satellite');

  useEffect(() => {
    const controller = new AbortController();
    setHealth({ status: 'loading', data: null, error: null });
    apiClient.health(controller.signal).then(
      (data) => setHealth({ status: 'success', data, error: null }),
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setHealth({ status: 'error', data: null, error: getErrorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, []);

  const toggleLayer = useCallback((layer: LayerKey) => {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }, []);

  return useMemo(() => ({
    health, layers, baseMap, toggleLayer, setBaseMap,
  }), [health, layers, baseMap, toggleLayer]);
}
