import type {
  ChatMessage,
  ChatResponse,
  FireFilters,
  FireResponse,
  HealthResponse,
  MapViewport,
  ReverseLocationResponse,
  SpreadRequest,
  SpreadResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const apiClient = {
  health: (signal?: AbortSignal) => request<HealthResponse>('/health', { signal }),
  fires: (viewport: MapViewport, filters: FireFilters, signal?: AbortSignal) => {
    // Leaflet reports raw map bounds, which can legitimately exceed +/-180
    // longitude at low zoom (e.g. a world view) or near the antimeridian.
    // The backend rejects out-of-range values with 422, so clamp here.
    const west = clamp(viewport.west, -180, 180);
    const east = clamp(viewport.east, -180, 180);
    const south = clamp(viewport.south, -90, 90);
    const north = clamp(viewport.north, -90, 90);
    const params = new URLSearchParams({
      west: String(west), south: String(south),
      east: String(east), north: String(north),
      hours: String(filters.hours), sources: filters.sources.join(','),
      min_confidence: filters.minConfidence,
    });
    return request<FireResponse>(`/fires?${params.toString()}`, { signal });
  },
  spread: (input: SpreadRequest, signal?: AbortSignal) =>
    request<SpreadResponse>('/spread', { method: 'POST', body: JSON.stringify(input), signal }),
  reverseLocation: (lat: number, lon: number, signal?: AbortSignal) => {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    return request<ReverseLocationResponse>(`/location/reverse?${params.toString()}`, { signal });
  },
  chat: (message: string, history: ChatMessage[], signal?: AbortSignal) =>
    request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify({ message, history }), signal }),
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Se ha producido un error inesperado';
}
