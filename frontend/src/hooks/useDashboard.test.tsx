import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '../services/api';
import type { SimulationResponse } from '../types/api';
import { DEFAULT_SCENARIO, useDashboard } from './useDashboard';

vi.mock('../services/api', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../services/api')>();
  return {
    ...original,
    apiClient: {
      health: vi.fn(), weather: vi.fn(), simulate: vi.fn(), generatePlan: vi.fn(),
    },
  };
});

const simulation = (risk: number): SimulationResponse => ({
  cells: [], propagation_polygon: [], assets: [],
  metrics: {
    territorial_risk: risk, top_asset: 'Planta', top_probability: risk,
    top_eta_min: 54, exposure_eur: 1_000_000, people_exposed: 4,
  },
  sources: [],
});

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.health).mockResolvedValue({
      ok: true, model_online: false, models: [], configured_model: 'qwen',
    });
    vi.mocked(apiClient.simulate).mockResolvedValue(simulation(82));
  });

  it('loads health and the initial simulation', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.simulation.status).toBe('success'));
    expect(result.current.scenario).toEqual(DEFAULT_SCENARIO);
    expect(result.current.health.data?.ok).toBe(true);
  });

  it('keeps the scenario when weather loading fails', async () => {
    vi.mocked(apiClient.weather).mockRejectedValueOnce(new ApiError(502, 'Meteorología no disponible'));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.simulation.status).toBe('success'));
    const before = result.current.scenario;
    await act(async () => result.current.loadWeather());
    expect(result.current.scenario).toEqual(before);
    expect(result.current.notice?.message).toContain('Meteorología');
  });

  it('keeps the newest result after rapid scenario changes', async () => {
    let resolveFirst: (value: SimulationResponse) => void = () => undefined;
    vi.mocked(apiClient.simulate)
      .mockImplementationOnce((_input, signal) => new Promise((resolve, reject) => {
        resolveFirst = resolve;
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }))
      .mockResolvedValueOnce(simulation(91));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(apiClient.simulate).toHaveBeenCalledTimes(1));
    act(() => result.current.updateScenario({ hour: 8 }));
    await waitFor(() => expect(result.current.simulation.data?.metrics.territorial_risk).toBe(91));
    await act(async () => resolveFirst(simulation(30)));
    expect(result.current.simulation.data?.metrics.territorial_risk).toBe(91);
  });
});
