import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboard } from './useDashboard';

vi.mock('../services/api', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../services/api')>();
  return {
    ...original,
    apiClient: { health: vi.fn(), fires: vi.fn(), spread: vi.fn() },
  };
});

import { apiClient } from '../services/api';

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.health).mockResolvedValue({
      ok: true, model_online: false, models: [], configured_model: 'qwen',
    });
  });

  it('loads health and defaults the fire/spread layers on', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.health.status).toBe('success'));
    expect(result.current.health.data?.ok).toBe(true);
    expect(result.current.layers).toEqual({ fire: true, spread: true });
  });

  it('toggles a single layer without affecting the other', () => {
    const { result } = renderHook(() => useDashboard());
    act(() => result.current.toggleLayer('fire'));
    expect(result.current.layers).toEqual({ fire: false, spread: true });
  });
});
