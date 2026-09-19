import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FireReport } from '../../hooks/useFireReport';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { FireResponse } from '../../types/api';
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
