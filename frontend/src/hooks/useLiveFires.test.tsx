import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../services/api';
import type { FireDetection, FireResponse } from '../types/api';
import { useLiveFires } from './useLiveFires';

vi.mock('../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/api')>();
  return { ...original, apiClient: { ...original.apiClient, fires: vi.fn() } };
});

const response: FireResponse = {
  detections: [],
  meta: {
    sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'],
    requested_hours: 24 as const,
    fetched_at: '2026-09-19T15:00:00Z',
    latest_acquisition: null,
    count: 0,
    stale: false,
    cache: 'miss' as const,
  },
};

const detection = (id: string, latitude: number, longitude: number): FireDetection => ({
  id,
  latitude,
  longitude,
  acquired_at: '2026-09-19T10:34:00Z',
  satellite: 'N21',
  instrument: 'VIIRS',
  source: 'VIIRS_NOAA21_NRT',
  confidence: 'nominal',
  brightness: 305.4,
  brightness_ti5: 282.28,
  frp: 3.31,
  scan: 0.71,
  track: 0.75,
  daynight: 'night',
});

describe('useLiveFires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(apiClient.fires).mockResolvedValue(response);
  });
  afterEach(() => vi.useRealTimers());

  it('requests structured detections from the full map zoom', async () => {
    const { result } = renderHook(() => useLiveFires());
    act(() => result.current.updateViewport({ west: -180, south: -85, east: 180, north: 85, zoom: 2 }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(apiClient.fires).toHaveBeenCalledTimes(1);
  });

  it('debounces viewport changes and cancels the obsolete request', async () => {
    const { result } = renderHook(() => useLiveFires());
    act(() => result.current.updateViewport({ west: -7, south: 39, east: -5, north: 41, zoom: 6 }));
    await act(() => vi.advanceTimersByTimeAsync(350));
    const firstSignal = vi.mocked(apiClient.fires).mock.calls[0][2];
    act(() => result.current.updateViewport({ west: -8, south: 38, east: -4, north: 42, zoom: 7 }));
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(apiClient.fires).toHaveBeenCalledTimes(2);
    expect(firstSignal?.aborted).toBe(true);
  });

  it('retries the same viewport after an in-flight request for it gets aborted, instead of treating it as already fetched', async () => {
    // Leaflet can re-emit the *same* bounding box more than once in a row
    // (e.g. its own setup/resize handling) — each emission is still a new
    // object, so the fetch effect reruns and aborts whatever was still in
    // flight. A large response (tens of thousands of real detections) can
    // easily take over a second to arrive, so it's realistic for a second or
    // third same-viewport emission to abort it before it ever resolves.
    const viewport = { west: -7, south: 39, east: -5, north: 41, zoom: 6 };
    const neverSettles = new Promise<FireResponse>(() => undefined);
    let resolveSecondAttempt: (value: FireResponse) => void = () => undefined;
    const secondAttemptPending = new Promise<FireResponse>((resolve) => { resolveSecondAttempt = resolve; });
    vi.mocked(apiClient.fires)
      .mockReturnValueOnce(neverSettles)
      .mockReturnValueOnce(secondAttemptPending)
      .mockResolvedValueOnce(response);

    const { result } = renderHook(() => useLiveFires());

    act(() => result.current.updateViewport({ ...viewport }));
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(apiClient.fires).toHaveBeenCalledTimes(1); // 1st attempt in flight, never resolves

    act(() => result.current.updateViewport({ ...viewport })); // aborts the 1st attempt
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(apiClient.fires).toHaveBeenCalledTimes(2); // 2nd attempt in flight, not yet resolved

    act(() => result.current.updateViewport({ ...viewport })); // aborts the 2nd attempt mid-flight
    await act(() => vi.advanceTimersByTimeAsync(350));
    // The regression: the old code marked this exact viewport "fetched" the
    // instant the 2nd attempt *started*, before it could finish — so this
    // 3rd, identical-viewport request would have been silently skipped,
    // permanently stuck with no data for up to 5 minutes.
    expect(apiClient.fires).toHaveBeenCalledTimes(3);

    await act(async () => resolveSecondAttempt(response)); // let the abandoned attempt settle harmlessly
  });

  it('suppresses an unchanged request for five minutes', async () => {
    const { result } = renderHook(() => useLiveFires());
    const viewport = { west: -7, south: 39, east: -5, north: 41, zoom: 6 };
    act(() => result.current.updateViewport(viewport));
    await act(() => vi.advanceTimersByTimeAsync(350));
    act(() => result.current.updateViewport({ ...viewport }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(apiClient.fires).toHaveBeenCalledTimes(1);
  });

  it('keeps showing the previous markers while loading a new viewport, no flicker', async () => {
    const americanFire = detection('america-fire', 38.9355, -112.8171);
    const firstResponse = { ...response, detections: [americanFire] };
    let resolveSecond: (value: FireResponse) => void = () => undefined;
    const secondResponse = new Promise<FireResponse>((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(apiClient.fires).mockResolvedValueOnce(firstResponse).mockReturnValueOnce(secondResponse);

    const { result } = renderHook(() => useLiveFires());
    act(() => result.current.updateViewport({ west: -114, south: 31, east: -60, north: 54, zoom: 5 }));
    await act(() => vi.advanceTimersByTimeAsync(350));
    await act(async () => undefined);

    expect(result.current.state.data?.detections[0]?.id).toBe('america-fire');

    act(() => result.current.updateViewport({ west: -10, south: 35, east: 4, north: 44, zoom: 6 }));
    await act(() => vi.advanceTimersByTimeAsync(350));

    // Panning/zooming to a new viewport must not flash the markers to empty:
    // the previous batch stays on screen until the new one actually arrives.
    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.data?.detections[0]?.id).toBe('america-fire');

    await act(async () => resolveSecond(response));
    expect(result.current.state.status).toBe('success');
    expect(result.current.state.data?.detections).toEqual([]);
  });

  it('shows zero NASA detections without fetching when every source is deselected', async () => {
    const { result } = renderHook(() => useLiveFires());
    act(() => result.current.updateViewport({ west: -7, south: 39, east: -5, north: 41, zoom: 6 }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(apiClient.fires).toHaveBeenCalledTimes(1);

    act(() => result.current.updateFilters({ sources: [] }));
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(apiClient.fires).toHaveBeenCalledTimes(1); // no new request for an empty source list
    expect(result.current.state.status).toBe('success');
    expect(result.current.state.data?.detections).toEqual([]);
  });

  it('clears the selected fire when panning outside its viewport', async () => {
    const americanFire = detection('america-fire', 38.9355, -112.8171);
    vi.mocked(apiClient.fires).mockResolvedValueOnce({ ...response, detections: [americanFire] });

    const { result } = renderHook(() => useLiveFires());
    act(() => result.current.updateViewport({ west: -114, south: 31, east: -60, north: 54, zoom: 5 }));
    await act(() => vi.advanceTimersByTimeAsync(350));
    await act(async () => undefined);
    act(() => result.current.setSelectedFireId('america-fire'));

    act(() => result.current.updateViewport({ west: -10, south: 35, east: 4, north: 44, zoom: 6 }));

    expect(result.current.selectedFireId).toBeNull();
  });
});
