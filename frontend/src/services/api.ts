import type {
  FireFilters,
  FireResponse,
  HealthResponse,
  MapViewport,
  SpreadRequest,
  SpreadResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    try {
      const payload = await response.json() as { detail?: string | Array<{ msg: string }> };
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) message = payload.detail.map((item) => item.msg).join('. ');
    } catch {
      // The stable status-based message remains useful for a non-JSON proxy failure.
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export const apiClient = {
  health: (signal?: AbortSignal) => request<HealthResponse>('/health', { signal }),
  fires: (viewport: MapViewport, filters: FireFilters, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      west: String(viewport.west), south: String(viewport.south),
      east: String(viewport.east), north: String(viewport.north),
      hours: String(filters.hours), sources: filters.sources.join(','),
      min_confidence: filters.minConfidence,
    });
    return request<FireResponse>(`/fires?${params.toString()}`, { signal });
  },
  spread: (input: SpreadRequest, signal?: AbortSignal) =>
    request<SpreadResponse>('/spread', { method: 'POST', body: JSON.stringify(input), signal }),
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Se ha producido un error inesperado';
}
