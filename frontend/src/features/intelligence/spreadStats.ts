import type { SpreadResponse, SpreadSnapshot } from '../../types/api';
import { sortedFuelBreakdown } from '../map/spreadImpact';

type WeatherSample = SpreadResponse['weather'][number];

export interface SpreadGrowthPoint {
  hour: number;
  areaGrowthKm2: number;
  radiusGrowthKm: number;
}

export interface SpreadStats {
  snapshots: SpreadSnapshot[];
  horizon: SpreadSnapshot;
  series: {
    hours: number[];
    areaKm2: number[];
    radiusMaxKm: number[];
    intensityMaxKwM: number[];
  };
  milestones: {
    firstAreaOverOneKm2: SpreadSnapshot | null;
    peakIntensity: SpreadSnapshot;
    fastestGrowth: SpreadGrowthPoint;
  };
  weather: {
    samples: WeatherSample[];
    maxWind: WeatherSample | null;
  };
  fuelBreakdown: Array<[string, number]>;
}

export function snapshotAtHorizon(data: SpreadResponse): SpreadSnapshot {
  return data.snapshots[data.max_hours] ?? data.snapshots[data.snapshots.length - 1];
}

export function buildSpreadStats(data: SpreadResponse): SpreadStats {
  const snapshots = data.snapshots.slice(0, data.max_hours + 1);
  const horizon = snapshotAtHorizon(data);
  const peakIntensity = snapshots.reduce(
    (peak, snapshot) => (snapshot.intensity_kw_m_max > peak.intensity_kw_m_max ? snapshot : peak),
    snapshots[0] ?? horizon,
  );
  const firstAreaOverOneKm2 = snapshots.find((snapshot) => snapshot.area_km2 >= 1) ?? null;
  const fastestGrowth = snapshots.reduce<SpreadGrowthPoint>((fastest, snapshot, index) => {
    if (index === 0) return fastest;
    const previous = snapshots[index - 1];
    const growth = {
      hour: snapshot.hour,
      areaGrowthKm2: snapshot.area_km2 - previous.area_km2,
      radiusGrowthKm: snapshot.radius_km_max - previous.radius_km_max,
    };
    return growth.areaGrowthKm2 > fastest.areaGrowthKm2 ? growth : fastest;
  }, { hour: snapshots[0]?.hour ?? 0, areaGrowthKm2: 0, radiusGrowthKm: 0 });
  const maxWind = data.weather.reduce<WeatherSample | null>(
    (strongest, sample) => (!strongest || sample.wind_kmh > strongest.wind_kmh ? sample : strongest),
    null,
  );

  return {
    snapshots,
    horizon,
    series: {
      hours: snapshots.map((snapshot) => snapshot.hour),
      areaKm2: snapshots.map((snapshot) => snapshot.area_km2),
      radiusMaxKm: snapshots.map((snapshot) => snapshot.radius_km_max),
      intensityMaxKwM: snapshots.map((snapshot) => snapshot.intensity_kw_m_max),
    },
    milestones: {
      firstAreaOverOneKm2,
      peakIntensity,
      fastestGrowth,
    },
    weather: {
      samples: data.weather,
      maxWind,
    },
    fuelBreakdown: sortedFuelBreakdown(horizon.burned_area_by_fuel_km2),
  };
}

export function formatStatNumber(value: number, digits = 2): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function makeSvgLinePath(values: number[], width = 260, height = 92): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 0.001);
  return values.map((value, index) => {
    const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
    const y = height - (value / max) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}
