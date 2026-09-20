import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FireReport } from '../../hooks/useFireReport';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { FireResponse, SpreadResponse } from '../../types/api';
import { LiveFirePanel } from './LiveFirePanel';

const idleFireSpread: FireSpread = { status: 'idle', data: null, error: null, hour: 3, setHour: vi.fn() };

const idleFireReport: FireReport = {
  status: 'idle', error: null, pendingDownload: false, download: vi.fn(), dismiss: vi.fn(),
};

const detection = {
  id: 'real-fire', latitude: 39.681, longitude: -6.347,
  acquired_at: '2026-09-19T14:42:00Z', satellite: 'N20', instrument: 'VIIRS',
  source: 'VIIRS_NOAA20_NRT' as const, confidence: 'high' as const,
  brightness: 341.2, brightness_ti5: 299.4, frp: 18.7, scan: 0.4, track: 0.5,
  daynight: 'night' as const,
};

const emptySnapshot = (hour: number) => ({
  hour, radius_km_min: 0, radius_km_max: 0, radius_km_mean: 0, area_km2: 0, rings: [],
  intensity_kw_m_min: 0, intensity_kw_m_mean: 0, intensity_kw_m_max: 0, burned_area_by_fuel_km2: {},
});

const spreadResponse: SpreadResponse = {
  center: { lat: 39.681, lon: -6.347 },
  max_hours: 12,
  terrain_source: 'open-meteo-dem',
  fuel_source: 'esa-worldcover',
  ignition_points: [{ lat: 39.681, lon: -6.347 }],
  weather: [
    { time: '2026-09-19T14:00:00Z', wind_kmh: 18, wind_from_deg: 220, temperature_c: 31, rh_pct: 22 },
    { time: '2026-09-19T15:00:00Z', wind_kmh: 24, wind_from_deg: 245, temperature_c: 33, rh_pct: 18 },
  ],
  snapshots: [
    ...Array.from({ length: 12 }, (_, hour) => ({
      ...emptySnapshot(hour),
      radius_km_max: hour * 0.1,
      radius_km_mean: hour * 0.08,
      area_km2: hour * 0.15,
      intensity_kw_m_max: hour * 120,
      intensity_kw_m_mean: hour * 90,
    })),
    {
      hour: 12, radius_km_min: 0.8, radius_km_max: 1.9, radius_km_mean: 1.2, area_km2: 4.4, rings: [],
      intensity_kw_m_min: 450, intensity_kw_m_mean: 1400, intensity_kw_m_max: 3100,
      burned_area_by_fuel_km2: { 'Tall grass': 2.7, 'Closed timber litter': 1.7 },
    },
  ],
  warning: 'Simulación experimental.',
  model_notes: [
    'ROS calculado con Rothermel y ajustado por viento, pendiente y combustible Anderson.',
    'La intensidad usa Byram: I = H * w * r.',
  ],
  scenario: { frp_mw: 18.7, brightness_k: 341.2, spread_multiplier: 1.34 },
};

const loadedFireSpread: FireSpread = {
  status: 'success', data: spreadResponse, error: null, hour: 12, setHour: vi.fn(),
};

function liveFires(data: FireResponse, selectedFireId: string | null = null, setSelectedFireId = vi.fn()): LiveFires {
  return {
    state: { status: 'success', data, error: null },
    viewport: { west: -7, south: 39, east: -5, north: 41, zoom: 7 },
    filters: { hours: 24, sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'], minConfidence: 'low' },
    selectedFireId,
    updateViewport: vi.fn(), updateFilters: vi.fn(), setSelectedFireId,
  };
}

const meta = {
  sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'] as const,
  requested_hours: 24 as const, fetched_at: '2026-09-19T15:00:00Z',
  latest_acquisition: '2026-09-19T14:42:00Z', count: 1, stale: true, cache: 'hit' as const,
};

describe('LiveFirePanel', () => {
  it('shows real satellite detail, stale state and anomaly disclaimer', () => {
    render(<LiveFirePanel liveFires={liveFires({ detections: [detection], meta: { ...meta, sources: [...meta.sources] } }, detection.id)} fireSpread={idleFireSpread} fireReport={idleFireReport} selectedFire={detection} />);
    expect(screen.getByText(/18.7 MW/)).toBeInTheDocument();
    expect(screen.getByText(/341.2 K/)).toBeInTheDocument();
    expect(screen.getByText(/Noche/)).toBeInTheDocument();
    expect(screen.getByText(/Datos en caché/)).toBeInTheDocument();
    expect(screen.getByText(/no confirma por sí sola un incendio/)).toBeInTheDocument();
  });

  it('opens a right-side selected fire menu with location and close action', () => {
    const setSelectedFireId = vi.fn();
    render(<LiveFirePanel liveFires={liveFires({ detections: [detection], meta: { ...meta, sources: [...meta.sources] } }, detection.id, setSelectedFireId)} fireSpread={idleFireSpread} fireReport={idleFireReport} selectedFire={detection} />);
    expect(screen.getByRole('region', { name: 'Detalle del fuego seleccionado' })).toBeInTheDocument();
    expect(screen.getByText('Incendio seleccionado')).toBeInTheDocument();
    expect(screen.getByText('39.6810, -6.3470')).toBeInTheDocument();
    expect(screen.getByText('FRP 18.7 MW')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle del fuego' }));
    expect(setSelectedFireId).toHaveBeenCalledWith(null);
  });

  it('opens a propagation statistics modal from the selected fire drawer', () => {
    render(<LiveFirePanel liveFires={liveFires({ detections: [detection], meta: { ...meta, sources: [...meta.sources] } }, detection.id)} fireSpread={loadedFireSpread} fireReport={idleFireReport} selectedFire={detection} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver estadísticas de propagación' }));

    expect(screen.getByRole('dialog', { name: 'Estadísticas de propagación' })).toBeInTheDocument();
    expect(screen.getByText('Modelo de propagación')).toBeInTheDocument();
    expect(screen.getAllByText('4,40 km²').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,90 km').length).toBeGreaterThan(0);
    expect(screen.getByText('3100 kW/m')).toBeInTheDocument();
    expect(screen.getAllByText('1,34x').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tall grass').length).toBeGreaterThan(0);
    expect(screen.getByText(/Rothermel/)).toBeInTheDocument();
  });

  it('shows the resolved locality and country instead of raw coordinates once reverse geocoding succeeds', () => {
    render(
      <LiveFirePanel
        liveFires={liveFires({ detections: [detection], meta: { ...meta, sources: [...meta.sources] } }, detection.id)}
        fireSpread={idleFireSpread}
        fireReport={idleFireReport}
        selectedFire={detection}
        reverseLocation={{
          status: 'success',
          data: {
            label: 'Valle del Tajo, Cáceres',
            place: 'Valle del Tajo',
            municipality: 'Cáceres',
            country: 'España',
            coordinates: '39.6810, -6.3470',
            attribution: '© OpenStreetMap contributors',
          },
          error: null,
        }}
      />,
    );
    expect(screen.getByText('Valle del Tajo')).toBeInTheDocument();
    expect(screen.getByText('España')).toBeInTheDocument();
    expect(screen.getByText('39.6810, -6.3470')).toBeInTheDocument();
  });

  it('falls back to raw coordinates while reverse geocoding is still resolving', () => {
    render(
      <LiveFirePanel
        liveFires={liveFires({ detections: [detection], meta: { ...meta, sources: [...meta.sources] } }, detection.id)}
        fireSpread={idleFireSpread}
        fireReport={idleFireReport}
        selectedFire={detection}
        reverseLocation={{ status: 'loading', data: null, error: null }}
      />,
    );
    expect(screen.getByText('Resolviendo…')).toBeInTheDocument();
  });

  it('states an empty fresh viewport without inventing a fire', () => {
    render(<LiveFirePanel liveFires={liveFires({ detections: [], meta: { ...meta, sources: [...meta.sources], count: 0, stale: false, latest_acquisition: null } })} fireSpread={idleFireSpread} fireReport={idleFireReport} selectedFire={null} />);
    expect(screen.getByText('Sin detecciones en esta vista.')).toBeInTheDocument();
    expect(screen.queryByText(/Detección VIIRS real/)).not.toBeInTheDocument();
  });
});
