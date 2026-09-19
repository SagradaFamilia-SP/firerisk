import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../services/api';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { CameraFireDetection, FireDetection, FireResponse } from '../../types/api';
import { FireTable } from './FireTable';

vi.mock('../../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/api')>();
  return { ...original, apiClient: { ...original.apiClient, reverseLocation: vi.fn() } };
});

const detection = (over: Partial<FireDetection>): FireDetection => ({
  id: 'fire-1', latitude: 40.0, longitude: -6.0, acquired_at: '2026-09-19T10:00:00Z',
  satellite: 'N21', instrument: 'VIIRS', source: 'VIIRS_NOAA21_NRT', confidence: 'nominal',
  brightness: 300, brightness_ti5: null, frp: 3, scan: 0.4, track: 0.5, daynight: 'day',
  ...over,
});

const strongFire = detection({ id: 'strong', frp: 40, acquired_at: '2026-09-19T12:00:00Z', daynight: 'night', confidence: 'high' });
const weakFire = detection({ id: 'weak', frp: 1, acquired_at: '2026-09-19T08:00:00Z', daynight: 'day', confidence: 'low' });

const cameraFire = (over: Partial<CameraFireDetection> = {}): CameraFireDetection => ({
  id: 7, latitude: 41.4, longitude: 2.2, confidence: 0.82,
  label: 'Cámara en tiempo real', source: 'camera', detected_at: '2026-09-19T11:00:00Z',
  recording_url: null,
  ...over,
});

function fireResponse(detections: FireDetection[]): FireResponse {
  return {
    detections,
    meta: {
      sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'], requested_hours: 24, fetched_at: '2026-09-19T13:00:00Z',
      latest_acquisition: detections[0]?.acquired_at ?? null, count: detections.length, stale: false, cache: 'miss',
    },
  };
}

function makeLiveFires(detections: FireDetection[], overrides: Partial<LiveFires> = {}): LiveFires {
  return {
    state: { status: 'success', data: fireResponse(detections), error: null },
    viewport: { west: -10, south: 35, east: 5, north: 45, zoom: 6 },
    filters: { hours: 24, sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'], minConfidence: 'low' },
    selectedFireId: null,
    updateViewport: vi.fn(), updateFilters: vi.fn(), setSelectedFireId: vi.fn(),
    ...overrides,
  };
}

describe('FireTable', () => {
  beforeEach(() => vi.mocked(apiClient.reverseLocation).mockResolvedValue({
    label: 'Talaván', place: 'Talaván', municipality: 'Cáceres', country: 'España',
    coordinates: '40.0000, -6.0000', attribution: '© OpenStreetMap contributors',
  }));

  it('renders every detection from the current map viewport', () => {
    render(<FireTable liveFires={makeLiveFires([strongFire, weakFire])} cameraFires={[]} onSelectFire={vi.fn()} />);
    expect(screen.getByText('40.0 MW · Alta')).toBeInTheDocument();
    expect(screen.getByText('1.0 MW · Baja')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 2 de 2 detecciones/)).toBeInTheDocument();
  });

  it('filters rows by a custom FRP range in the advanced panel', () => {
    render(<FireTable liveFires={makeLiveFires([strongFire, weakFire])} cameraFires={[]} onSelectFire={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    fireEvent.change(screen.getByLabelText('FRP mínimo en MW'), { target: { value: '25' } });
    expect(screen.getByText('40.0 MW · Alta')).toBeInTheDocument();
    expect(screen.queryByText('1.0 MW · Baja')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1 de 2 detecciones/)).toBeInTheDocument();
  });

  it('filters rows by a resolved country from the main search box', async () => {
    vi.mocked(apiClient.reverseLocation).mockImplementation((lat) => Promise.resolve({
      label: lat === 40.0 ? 'Talaván' : 'Fort McMurray', place: lat === 40.0 ? 'Talaván' : 'Fort McMurray',
      municipality: null, country: lat === 40.0 ? 'España' : 'Canadá',
      coordinates: '', attribution: '© OpenStreetMap contributors',
    }));
    const otherCountryFire = detection({ id: 'canada', latitude: 56.7, longitude: -111.4 });
    render(<FireTable liveFires={makeLiveFires([strongFire, otherCountryFire])} cameraFires={[]} onSelectFire={vi.fn()} />);
    // Real (non-fake) timers here: two rows resolve one at a time, 1s apart,
    // to respect Nominatim's rate limit — longer than the default findBy timeout.
    await screen.findByText('España', {}, { timeout: 3_000 });
    await screen.findByText('Canadá', {}, { timeout: 3_000 });

    fireEvent.change(screen.getByPlaceholderText('Filtrar por ciudad, municipio o país resuelto…'), { target: { value: 'canad' } });
    expect(screen.queryByText('España')).not.toBeInTheDocument();
    expect(screen.getByText('Canadá')).toBeInTheDocument();
  });

  it('filters rows by day/night', () => {
    render(<FireTable liveFires={makeLiveFires([strongFire, weakFire])} cameraFires={[]} onSelectFire={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Día o noche'), { target: { value: 'night' } });
    expect(screen.getByText(/Mostrando 1 de 2 detecciones/)).toBeInTheDocument();
  });

  it('sorts by intensity when the column header is clicked', () => {
    render(<FireTable liveFires={makeLiveFires([weakFire, strongFire])} cameraFires={[]} onSelectFire={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Intensidad \(FRP\)/ }));
    const rows = screen.getAllByRole('row').slice(1); // drop header row
    expect(within(rows[0]).getByText('1.0 MW · Baja')).toBeInTheDocument();
  });

  it('calls onSelectFire when "Ver en mapa" is clicked', () => {
    const onSelectFire = vi.fn();
    render(<FireTable liveFires={makeLiveFires([strongFire])} cameraFires={[]} onSelectFire={onSelectFire} />);
    fireEvent.click(screen.getByRole('button', { name: /Ver en mapa/ }));
    expect(onSelectFire).toHaveBeenCalledWith('strong');
  });

  it('shows an empty state when no fires match the active filters', () => {
    render(<FireTable liveFires={makeLiveFires([weakFire])} cameraFires={[]} onSelectFire={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    fireEvent.change(screen.getByLabelText('FRP mínimo en MW'), { target: { value: '25' } });
    expect(screen.getByText('Ningún incendio coincide con los filtros actuales.')).toBeInTheDocument();
  });

  it('prompts to load data before any viewport has been fetched', () => {
    render(<FireTable liveFires={makeLiveFires([]) } cameraFires={[]} onSelectFire={vi.fn()} />);
    // no detections yet
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('includes camera-detected fires alongside NASA detections, labeled by source', () => {
    render(<FireTable liveFires={makeLiveFires([strongFire])} cameraFires={[cameraFire()]} onSelectFire={vi.fn()} />);
    expect(screen.getByText('Fuente')).toBeInTheDocument();
    expect(screen.queryByText('Satélite')).not.toBeInTheDocument();
    expect(screen.getByText('Cámara Vonage')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 2 de 2 detecciones/)).toBeInTheDocument();
  });

  it('hides camera detections via their own toggle, independent of the NASA source checkboxes', () => {
    render(<FireTable liveFires={makeLiveFires([strongFire])} cameraFires={[cameraFire()]} onSelectFire={vi.fn()} />);
    expect(screen.getByText(/Mostrando 2 de 2 detecciones/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Cámara' }));
    expect(screen.queryByText('Cámara Vonage')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1 de 1 detecciones/)).toBeInTheDocument();
  });

  it('shows camera detections even before any NASA viewport data has loaded', () => {
    render(
      <FireTable
        liveFires={makeLiveFires([], { state: { status: 'idle', data: null, error: null } })}
        cameraFires={[cameraFire()]}
        onSelectFire={vi.fn()}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Cámara Vonage')).toBeInTheDocument();
  });
});
