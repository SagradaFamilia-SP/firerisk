import { describe, expect, it } from 'vitest';

import type { SpreadResponse, SpreadSnapshot } from '../../types/api';
import { buildSpreadStats } from './spreadStats';

const snapshot = (hour: number, area: number, radius: number, intensity: number): SpreadSnapshot => ({
  hour,
  radius_km_min: Math.max(0, radius - 0.2),
  radius_km_mean: radius * 0.8,
  radius_km_max: radius,
  area_km2: area,
  rings: [],
  intensity_kw_m_min: intensity * 0.4,
  intensity_kw_m_mean: intensity * 0.7,
  intensity_kw_m_max: intensity,
  burned_area_by_fuel_km2: hour === 12 ? { 'Tall grass': 2.5, Shrubland: 1.2 } : {},
});

const spread: SpreadResponse = {
  center: { lat: 40, lon: -6 },
  max_hours: 12,
  terrain_source: 'open-meteo-dem',
  fuel_source: 'esa-worldcover',
  ignition_points: [{ lat: 40, lon: -6 }],
  weather: [
    { time: '2026-09-20T10:00:00Z', wind_kmh: 14, wind_from_deg: 210, temperature_c: 30, rh_pct: 24 },
    { time: '2026-09-20T11:00:00Z', wind_kmh: 22, wind_from_deg: 230, temperature_c: 32, rh_pct: 18 },
  ],
  snapshots: [
    snapshot(0, 0, 0, 0),
    snapshot(1, 0.2, 0.3, 300),
    snapshot(2, 0.7, 0.6, 900),
    snapshot(3, 1.4, 0.9, 1500),
    snapshot(4, 2.8, 1.2, 2100),
    snapshot(5, 4.6, 1.5, 1800),
    snapshot(6, 5.1, 1.7, 1700),
    snapshot(7, 5.6, 1.9, 1600),
    snapshot(8, 6.2, 2.0, 1550),
    snapshot(9, 6.9, 2.2, 1500),
    snapshot(10, 7.7, 2.4, 1450),
    snapshot(11, 8.3, 2.6, 1400),
    snapshot(12, 9.1, 2.8, 1350),
  ],
  warning: 'Simulación experimental.',
  model_notes: ['ROS calculado con Rothermel.'],
  scenario: { frp_mw: 20, brightness_k: 345, spread_multiplier: 1.4 },
};

describe('buildSpreadStats', () => {
  it('extracts temporal series and operational milestones from spread snapshots', () => {
    const stats = buildSpreadStats(spread);

    expect(stats.horizon.hour).toBe(12);
    expect(stats.series.areaKm2).toEqual([0, 0.2, 0.7, 1.4, 2.8, 4.6, 5.1, 5.6, 6.2, 6.9, 7.7, 8.3, 9.1]);
    expect(stats.milestones.firstAreaOverOneKm2?.hour).toBe(3);
    expect(stats.milestones.peakIntensity.hour).toBe(4);
    expect(stats.milestones.fastestGrowth.hour).toBe(5);
    expect(stats.milestones.fastestGrowth.areaGrowthKm2).toBeCloseTo(1.8);
    expect(stats.weather.maxWind?.wind_kmh).toBe(22);
    expect(stats.fuelBreakdown[0]).toEqual(['Tall grass', 2.5]);
  });
});
