import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../services/api';
import type { SpreadResponse } from '../types/api';
import { useSimulationSpread } from './useSimulationSpread';

vi.mock('../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/api')>();
  return { ...original, apiClient: { ...original.apiClient, spread: vi.fn() } };
});

const response: SpreadResponse = {
  center: { lat: 40.1, lon: -3.5 },
  max_hours: 12,
  terrain_source: 'open-meteo-dem',
  fuel_source: 'esa-worldcover',
  ignition_points: [{ lat: 40.1, lon: -3.5 }],
  weather: [{ time: '2026-09-19T12:00:00Z', wind_kmh: 12, wind_from_deg: 220, temperature_c: 28, rh_pct: 35 }],
  snapshots: [{
    hour: 0, radius_km_min: 0.05, radius_km_max: 0.2, radius_km_mean: 0.1, area_km2: 0.02,
    rings: [], intensity_kw_m_min: 0, intensity_kw_m_mean: 0, intensity_kw_m_max: 0, burned_area_by_fuel_km2: {},
  }],
  warning: 'Simulación experimental.',
  model_notes: [],
  scenario: { frp_mw: 4.9, brightness_k: 336.6, spread_multiplier: 1 },
};

describe('useSimulationSpread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(apiClient.spread).mockResolvedValue(response);
  });
  afterEach(() => vi.useRealTimers());

  it('starts idle with no picked point', () => {
    const { result } = renderHook(() => useSimulationSpread());
    expect(result.current.point).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('fetches a spread simulation for a clicked point', async () => {
    const { result } = renderHook(() => useSimulationSpread());
    act(() => result.current.pick(41.2, -5.1));
    expect(result.current.point).toEqual({ lat: 41.2, lon: -5.1 });
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(apiClient.spread).toHaveBeenCalledWith({
      lat: 41.2, lon: -5.1, frp_mw: 4.9, brightness_k: 336.6,
    }, expect.any(AbortSignal));
    await act(async () => undefined);
    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual(response);
  });

  it('re-fetches when a different point is picked, resetting the hour', async () => {
    const { result } = renderHook(() => useSimulationSpread());
    act(() => result.current.pick(41.2, -5.1));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => undefined);
    act(() => result.current.setHour(6));
    expect(result.current.hour).toBe(6);

    act(() => result.current.pick(38.0, -1.0));
    expect(result.current.hour).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(apiClient.spread).toHaveBeenCalledTimes(2);
    await act(async () => undefined);
    expect(result.current.point).toEqual({ lat: 38.0, lon: -1.0 });
  });

  it('clears the point and returns to idle', async () => {
    const { result } = renderHook(() => useSimulationSpread());
    act(() => result.current.pick(41.2, -5.1));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => undefined);
    act(() => result.current.clear());
    expect(result.current.point).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
  });

  it('re-fetches when scenario power or brightness changes', async () => {
    const { result } = renderHook(() => useSimulationSpread());
    act(() => result.current.pick(41.2, -5.1));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => undefined);

    act(() => result.current.updateScenario({ frpMw: 30, brightnessK: 380 }));
    await act(() => vi.advanceTimersByTimeAsync(250));

    expect(apiClient.spread).toHaveBeenLastCalledWith({
      lat: 41.2, lon: -5.1, frp_mw: 30, brightness_k: 380,
    }, expect.any(AbortSignal));
  });
});
