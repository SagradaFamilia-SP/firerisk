import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import { isCameraDetectionId } from '../features/map/cameraFireToDetection';
import type { FireFilters, FireResponse, MapViewport } from '../types/api';
import type { AsyncState } from './useDashboard';

const DEFAULT_FILTERS: FireFilters = {
  hours: 24,
  sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'],
  minConfidence: 'low',
};
const MIN_FIRE_FETCH_ZOOM = 2;

// A small buffer around the viewport's own size, so a fire right at the edge
// isn't dropped by rounding/padding differences between the map's reported
// bounds and the fire's exact point — e.g. right after a programmatic
// fitBounds (auto-focusing the selected fire), which must never itself
// deselect the very fire it just framed.
function viewportContainsFire(viewport: MapViewport, fire: { latitude: number; longitude: number }) {
  const latBuffer = (viewport.north - viewport.south) * 0.15;
  const lonBuffer = (viewport.east - viewport.west) * 0.15;
  return (
    fire.latitude >= viewport.south - latBuffer
    && fire.latitude <= viewport.north + latBuffer
    && fire.longitude >= viewport.west - lonBuffer
    && fire.longitude <= viewport.east + lonBuffer
  );
}

export function useLiveFires() {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [filters, setFilters] = useState<FireFilters>(DEFAULT_FILTERS);
  const [state, setState] = useState<AsyncState<FireResponse>>({ status: 'idle', data: null, error: null });
  const [selectedFireId, setSelectedFireId] = useState<string | null>(null);
  const lastRequest = useRef<{ key: string; requestedAt: number } | null>(null);
  // Read via a ref (not a `state` dependency) so this callback's identity stays
  // stable: react-leaflet's ViewportObserver re-emits the viewport whenever this
  // identity changes, which would otherwise re-run the fetch effect below and
  // cancel/reschedule it every time `state` updates — a self-sustaining loop
  // that never lets a request finish once a fire is selected.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!viewport || viewport.zoom < MIN_FIRE_FETCH_ZOOM) return;
    if (filters.sources.length === 0) {
      // No NASA source selected — show zero NASA detections instead of
      // leaving whatever was fetched before every source got deselected,
      // so "camera only" is a real, independent state, not a stale mix.
      setState({
        status: 'success',
        data: {
          detections: [],
          meta: {
            sources: [], requested_hours: filters.hours, fetched_at: new Date().toISOString(),
            latest_acquisition: null, count: 0, stale: false, cache: 'hit',
          },
        },
        error: null,
      });
      return;
    }
    const requestKey = JSON.stringify({
      west: viewport.west.toFixed(4), south: viewport.south.toFixed(4),
      east: viewport.east.toFixed(4), north: viewport.north.toFixed(4),
      hours: filters.hours, sources: [...filters.sources].sort(), confidence: filters.minConfidence,
    });
    if (lastRequest.current?.key === requestKey && Date.now() - lastRequest.current.requestedAt < 300_000) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      // Keep showing the previously loaded markers while the new viewport's
      // detections load, instead of flashing everything to empty on every
      // pan/zoom — they get replaced once the fresh batch actually arrives.
      setState((current) => ({ status: 'loading', data: current.data, error: null }));
      apiClient.fires(viewport, filters, controller.signal).then(
        (data) => {
          if (controller.signal.aborted) return;
          // Only a request that actually finished marks this viewport as
          // "recently fetched". A large response (tens of thousands of real
          // detections) can take over a second to arrive; if a later
          // viewport/zoom event aborts it first, marking it done *before*
          // that (as this used to) would wedge the map with zero markers for
          // up to 5 minutes — the abort is silent, but the dedup cache still
          // thought this exact viewport was already satisfied.
          lastRequest.current = { key: requestKey, requestedAt: Date.now() };
          setState({ status: 'success', data, error: null });
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

  const updateViewport = useCallback((nextViewport: MapViewport) => {
    setViewport(nextViewport);
    setSelectedFireId((currentSelectedFireId) => {
      if (!currentSelectedFireId) return currentSelectedFireId;
      // Camera detections aren't fetched per-viewport (unlike NASA fires), so
      // panning/zooming away from one should never auto-deselect it.
      if (isCameraDetectionId(currentSelectedFireId)) return currentSelectedFireId;
      const selectedFire = stateRef.current.data?.detections.find((fire) => fire.id === currentSelectedFireId);
      if (!selectedFire || viewportContainsFire(nextViewport, selectedFire)) return currentSelectedFireId;
      return null;
    });
  }, []);

  return useMemo(() => ({
    state, viewport, filters, selectedFireId,
    updateViewport, updateFilters, setSelectedFireId,
  }), [filters, selectedFireId, state, updateFilters, updateViewport, viewport]);
}

export type LiveFires = ReturnType<typeof useLiveFires>;
