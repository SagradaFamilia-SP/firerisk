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
