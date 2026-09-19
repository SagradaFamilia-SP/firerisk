import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type { FireFilters, FireResponse, MapViewport } from '../types/api';
import type { AsyncState } from './useDashboard';

const DEFAULT_FILTERS: FireFilters = {
  hours: 24,
  sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'],
  minConfidence: 'low',
};

export function useLiveFires() {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [filters, setFilters] = useState<FireFilters>(DEFAULT_FILTERS);
  const [state, setState] = useState<AsyncState<FireResponse>>({ status: 'idle', data: null, error: null });
  const [selectedFireId, setSelectedFireId] = useState<string | null>(null);
  const lastRequest = useRef<{ key: string; requestedAt: number } | null>(null);

  useEffect(() => {
    if (!viewport || viewport.zoom < 5 || filters.sources.length === 0) return;
    const requestKey = JSON.stringify({
      west: viewport.west.toFixed(4), south: viewport.south.toFixed(4),
      east: viewport.east.toFixed(4), north: viewport.north.toFixed(4),
      hours: filters.hours, sources: [...filters.sources].sort(), confidence: filters.minConfidence,
    });
    if (lastRequest.current?.key === requestKey && Date.now() - lastRequest.current.requestedAt < 300_000) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      lastRequest.current = { key: requestKey, requestedAt: Date.now() };
      setState((current) => ({ status: 'loading', data: current.data, error: null }));
      apiClient.fires(viewport, filters, controller.signal).then(
        (data) => {
          if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
        },
        (error: unknown) => {
          if ((error as Error).name !== 'AbortError') {
            setState((current) => ({ status: 'error', data: current.data, error: getErrorMessage(error) }));
          }
        },
      );
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, viewport]);

  const updateFilters = useCallback((change: Partial<FireFilters>) => {
    setFilters((current) => ({ ...current, ...change }));
  }, []);

  return useMemo(() => ({
    state, viewport, filters, selectedFireId,
    updateViewport: setViewport, updateFilters, setSelectedFireId,
  }), [filters, selectedFireId, state, updateFilters, viewport]);
}

export type LiveFires = ReturnType<typeof useLiveFires>;
