import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../services/api';
import type { FireResponse } from '../types/api';
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

describe('useLiveFires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(apiClient.fires).mockResolvedValue(response);
  });
  afterEach(() => vi.useRealTimers());

  it('does not request structured detections below zoom 5', async () => {
    const { result } = renderHook(() => useLiveFires());
    act(() => result.current.updateViewport({ west: -7, south: 39, east: -5, north: 41, zoom: 4 }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(apiClient.fires).not.toHaveBeenCalled();
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
});
