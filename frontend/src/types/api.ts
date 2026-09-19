export interface ScenarioInput {
  hour: number;
  wind_speed: number;
  wind_direction: number;
  temperature: number;
  humidity: number;
  hotspot_active: boolean;
  hotspot_x: number;
  hotspot_y: number;
}

export interface RiskCell { id: number; risk: number; fuel: number; slope: number }

export interface AffectedAsset {
  id: string; name: string; x: number; y: number; lat: number; lng: number;
  value_eur: number; people: number; criticality: number; icon: string;
  distance_km: number; probability: number; eta_min: number | null;
}

export interface SimulationResponse {
  cells: RiskCell[];
  propagation_polygon: number[][];
  assets: AffectedAsset[];
  metrics: {
    territorial_risk: number; top_asset: string; top_probability: number;
    top_eta_min: number | null; exposure_eur: number; people_exposed: number;
  };
  sources: Array<{ name: string; status: string; detail: string }>;
}

export interface HealthResponse {
  ok: boolean; model_online: boolean; models: string[]; configured_model: string;
}

export interface WeatherResponse {
  temperature: number; humidity: number; wind_speed: number; wind_direction: number;
  wind_gusts: number | null; time: string; source: string;
}

export interface Incident {
  type: string; location: string; temperature: number; humidity: number;
  wind_speed: number; wind_direction: number; horizon_hours: number;
  top_eta_min: number | null; territorial_risk: number;
}

export interface PlanAsset {
  id: string; name: string; lat: number; lng: number; value_eur: number;
  people: number; probability: number;
}

export interface AgentPlanRequest { incident: Incident; assets: PlanAsset[] }

export interface OperationalPlan {
  mode: 'local_model' | 'deterministic_fallback';
  summary: string; decision: string;
  actions: Array<{ priority: number; owner: string; action: string; deadline_min: number }>;
  message: string; confidence_note: string; model_error: string | null;
}

export type FirmsSource = 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';
export type FireConfidence = 'low' | 'nominal' | 'high';

export interface FireDetection {
  id: string; latitude: number; longitude: number; acquired_at: string;
  satellite: string; instrument: string; source: FirmsSource;
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
