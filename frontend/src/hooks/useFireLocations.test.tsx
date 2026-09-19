import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../services/api';
import type { ReverseLocationResponse } from '../types/api';
import { useFireLocations } from './useFireLocations';

vi.mock('../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/api')>();
  return { ...original, apiClient: { ...original.apiClient, reverseLocation: vi.fn() } };
});

const location: ReverseLocationResponse = {
  label: 'Talaván, Cáceres', place: 'Talaván', municipality: 'Cáceres',
  country: 'España', coordinates: '39.9337, -6.3560', attribution: '© OpenStreetMap contributors',
};

describe('useFireLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('resolves a fire id to a reverse-geocoded label', async () => {
    vi.mocked(apiClient.reverseLocation).mockResolvedValue(location);
    const { result } = renderHook(() => useFireLocations());

    act(() => result.current.resolve('fire-1', 39.9337, -6.356));
    expect(result.current.labels['fire-1']).toEqual({ status: 'loading' });

    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(apiClient.reverseLocation).toHaveBeenCalledWith(39.9337, -6.356);
    expect(result.current.labels['fire-1']).toEqual({ status: 'success', data: location });
  });

  it('never issues a second lookup for an id already requested', async () => {
    vi.mocked(apiClient.reverseLocation).mockResolvedValue(location);
    const { result } = renderHook(() => useFireLocations());

    act(() => result.current.resolve('fire-1', 39.9337, -6.356));
    act(() => result.current.resolve('fire-1', 39.9337, -6.356));
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(apiClient.reverseLocation).toHaveBeenCalledTimes(1);
  });

  it('staggers concurrent lookups instead of firing them in parallel', async () => {
    vi.mocked(apiClient.reverseLocation).mockResolvedValue(location);
    const { result } = renderHook(() => useFireLocations());

    act(() => {
      result.current.resolve('fire-1', 39.9337, -6.356);
      result.current.resolve('fire-2', 40.0, -6.0);
    });

    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(apiClient.reverseLocation).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(apiClient.reverseLocation).toHaveBeenCalledTimes(2);
  });

  it('marks a failed lookup as an error rather than leaving it stuck loading', async () => {
    vi.mocked(apiClient.reverseLocation).mockRejectedValue(new Error('geocoding down'));
    const { result } = renderHook(() => useFireLocations());

    act(() => result.current.resolve('fire-1', 39.9337, -6.356));
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(result.current.labels['fire-1']).toEqual({ status: 'error' });
  });
});
