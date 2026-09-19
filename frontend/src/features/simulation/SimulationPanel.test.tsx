import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../services/api';
import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import type { ReverseLocationResponse, SpreadResponse } from '../../types/api';
import { SimulationPanel } from './SimulationPanel';

vi.mock('../../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/api')>();
  return { ...original, apiClient: { ...original.apiClient, reverseLocation: vi.fn() } };
});

const location: ReverseLocationResponse = {
  label: 'Talaván, Cáceres', place: 'Talaván', municipality: 'Cáceres', country: 'España',
  coordinates: '39.7178, -6.2631', attribution: '© OpenStreetMap contributors',
};

const emptySnapshot = (hour: number) => ({
  hour, radius_km_min: 0, radius_km_max: 0, radius_km_mean: 0, area_km2: 0, rings: [],
  intensity_kw_m_min: 0, intensity_kw_m_mean: 0, intensity_kw_m_max: 0, burned_area_by_fuel_km2: {},
});

// The real backend always returns one snapshot per hour, indexed by hour
// (see build_snapshots), so `snapshots[max_hours]` is a safe last-hour
// lookup — this fixture must honor that same invariant.
const response: SpreadResponse = {
  center: { lat: 39.7178, lon: -6.2631 },
  max_hours: 12,
  terrain_source: 'open-meteo-dem',
  fuel_source: 'esa-worldcover',
  ignition_points: [{ lat: 39.7178, lon: -6.2631 }],
  weather: [{ time: '2026-09-19T12:00:00Z', wind_kmh: 18, wind_from_deg: 220, temperature_c: 31, rh_pct: 22 }],
  snapshots: [
    ...Array.from({ length: 12 }, (_, hour) => emptySnapshot(hour)),
    {
      hour: 12, radius_km_min: 0.8, radius_km_max: 1.4, radius_km_mean: 1.1, area_km2: 3.2, rings: [],
      intensity_kw_m_min: 500, intensity_kw_m_mean: 1800, intensity_kw_m_max: 4200,
      burned_area_by_fuel_km2: { 'Tall grass': 2.0, 'Closed timber litter': 1.2 },
    },
  ],
  warning: 'Simulación experimental.',
  model_notes: [],
  scenario: { frp_mw: 4.9, brightness_k: 336.6, spread_multiplier: 1 },
};

function simulationAt(hour: number): SimulationSpread {
  return {
    point: { lat: 39.7178, lon: -6.2631 },
    pick: vi.fn(), clear: vi.fn(),
    scenario: { frpMw: 4.9, brightnessK: 336.6 },
    updateScenario: vi.fn(),
    status: 'success', data: response, error: null,
    hour, setHour: vi.fn(),
  };
}

describe('SimulationPanel', () => {
  it('does not render the right panel before a point is picked', () => {
    const simulation: SimulationSpread = {
      point: null, pick: vi.fn(), clear: vi.fn(), status: 'idle', data: null, error: null, hour: 0, setHour: vi.fn(),
      scenario: { frpMw: 4.9, brightnessK: 336.6 }, updateScenario: vi.fn(),
    };
    const { container } = render(<SimulationPanel simulation={simulation} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the resolved locality and country instead of raw coordinates', async () => {
    vi.mocked(apiClient.reverseLocation).mockResolvedValue(location);
    render(<SimulationPanel simulation={simulationAt(12)} />);
    await waitFor(() => expect(screen.getAllByText('Talaván').length).toBeGreaterThan(0));
    expect(screen.getByText('España')).toBeInTheDocument();
    expect(screen.getByText('39.7178, -6.2631')).toBeInTheDocument();
  });

  it('reports potential damage as a severity rating plus a real land-cover breakdown', async () => {
    vi.mocked(apiClient.reverseLocation).mockResolvedValue(location);
    render(<SimulationPanel simulation={simulationAt(12)} />);
    expect(screen.getByText('Daños potenciales a +12 h')).toBeInTheDocument();
    // 4200 kW/m falls in the "extreme" suppression-difficulty band.
    expect(screen.getByText('Extrema')).toBeInTheDocument();
    expect(screen.getByText('Tall grass')).toBeInTheDocument();
    expect(screen.getByText('2.00 km²')).toBeInTheDocument();
    expect(screen.getByText('Closed timber litter')).toBeInTheDocument();
  });

  it('omits the damage section while there is no burned area yet', async () => {
    vi.mocked(apiClient.reverseLocation).mockResolvedValue(location);
    const noBurn: SimulationSpread = {
      ...simulationAt(0),
      status: 'success',
      error: null,
      data: {
        ...response,
        snapshots: response.snapshots.map((snapshot) => ({ ...snapshot, area_km2: 0, burned_area_by_fuel_km2: {} })),
      },
    };
    render(<SimulationPanel simulation={noBurn} />);
    await waitFor(() => expect(screen.getAllByText('Talaván').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Daños potenciales/)).not.toBeInTheDocument();
  });
});
