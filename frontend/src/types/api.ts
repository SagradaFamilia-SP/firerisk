export interface HealthResponse {
  ok: boolean; model_online: boolean; models: string[]; configured_model: string;
}

export type FirmsSource = 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';
export type FireSource = FirmsSource | 'CAMERA';
export type FireConfidence = 'low' | 'nominal' | 'high';

export interface FireDetection {
  id: string; latitude: number; longitude: number; acquired_at: string;
  satellite: string; instrument: string; source: FireSource;
  confidence: FireConfidence; brightness: number; brightness_ti5: number | null;
  frp: number | null; scan: number | null; track: number | null;
  daynight: 'day' | 'night';
}

export interface FireResponse {
  detections: FireDetection[];
  meta: {
    sources: FirmsSource[]; requested_hours: 24 | 48 | 72; fetched_at: string;
    latest_acquisition: string | null; count: number; stale: boolean; cache: 'hit' | 'miss';
  };
}

export interface MapViewport {
  west: number; south: number; east: number; north: number; zoom: number;
}

export interface FireFilters {
  hours: 24 | 48 | 72; sources: FirmsSource[]; minConfidence: FireConfidence;
}

export interface SpreadRequest { lat: number; lon: number; max_hours?: number }

export interface SpreadPoint { lat: number; lon: number }

export interface SpreadSnapshot {
  hour: number; radius_km_min: number; radius_km_max: number; radius_km_mean: number;
  area_km2: number; rings: SpreadPoint[][];
  intensity_kw_m_min: number; intensity_kw_m_mean: number; intensity_kw_m_max: number;
}

export interface SpreadResponse {
  center: SpreadPoint; max_hours: number; terrain_source: 'open-meteo-dem' | 'flat-fallback';
  fuel_source: 'esa-worldcover' | 'fallback-grass';
  ignition_points: SpreadPoint[];
  weather: Array<{ time: string; wind_kmh: number; wind_from_deg: number; temperature_c: number; rh_pct: number }>;
  snapshots: SpreadSnapshot[];
  warning: string;
  model_notes: string[];
}

export interface ReverseLocationResponse {
  label: string; place: string; municipality: string | null; country: string | null;
  coordinates: string; attribution: string;
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface ChatSummary {
  region: string | null; hours: 24 | 48 | 72; count: number;
  confidence_counts: Record<FireConfidence, number>; max_frp: number | null;
  generated_at: string; narrative_source: 'model' | 'fallback' | 'unconfigured';
}

export interface ChatResponse { reply: string; fires: FireDetection[]; summary: ChatSummary }

export interface CameraFireDetection {
  id: number; latitude: number; longitude: number; confidence: number;
  label: string; source: 'camera'; detected_at: string;
  recording_url: string | null;
}
