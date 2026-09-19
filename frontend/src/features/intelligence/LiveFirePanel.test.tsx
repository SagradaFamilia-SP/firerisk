import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { FireResponse } from '../../types/api';
import { LiveFirePanel } from './LiveFirePanel';

const idleFireSpread: FireSpread = { status: 'idle', data: null, error: null, hour: 3, setHour: vi.fn() };

const detection = {
  id: 'real-fire', latitude: 39.681, longitude: -6.347,
  acquired_at: '2026-09-19T14:42:00Z', satellite: 'N20', instrument: 'VIIRS',
  source: 'VIIRS_NOAA20_NRT' as const, confidence: 'high' as const,
  brightness: 341.2, brightness_ti5: 299.4, frp: 18.7, scan: 0.4, track: 0.5,
  daynight: 'night' as const,
};

function liveFires(data: FireResponse, selectedFireId: string | null = null): LiveFires {
  return {
    state: { status: 'success', data, error: null },
    viewport: { west: -7, south: 39, east: -5, north: 41, zoom: 7 },
    filters: { hours: 24, sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'], minConfidence: 'low' },
    selectedFireId,
    updateViewport: vi.fn(), updateFilters: vi.fn(), setSelectedFireId: vi.fn(),
  };
}

const meta = {
  sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'] as const,
  requested_hours: 24 as const, fetched_at: '2026-09-19T15:00:00Z',
  latest_acquisition: '2026-09-19T14:42:00Z', count: 1, stale: true, cache: 'hit' as const,
};

describe('LiveFirePanel', () => {
  it('shows real satellite detail, stale state and anomaly disclaimer', () => {
    render(<LiveFirePanel liveFires={liveFires({ detections: [detection], meta: { ...meta, sources: [...meta.sources] } }, detection.id)} fireSpread={idleFireSpread} />);
    expect(screen.getByText(/18.7 MW/)).toBeInTheDocument();
    expect(screen.getByText(/341.2 K/)).toBeInTheDocument();
    expect(screen.getByText(/Noche/)).toBeInTheDocument();
    expect(screen.getByText(/Datos en caché/)).toBeInTheDocument();
    expect(screen.getByText(/no confirma por sí sola un incendio/)).toBeInTheDocument();
  });

  it('states an empty fresh viewport without inventing a fire', () => {
    render(<LiveFirePanel liveFires={liveFires({ detections: [], meta: { ...meta, sources: [...meta.sources], count: 0, stale: false, latest_acquisition: null } })} fireSpread={idleFireSpread} />);
    expect(screen.getByText('Sin detecciones en esta vista.')).toBeInTheDocument();
    expect(screen.queryByText(/Detección VIIRS real/)).not.toBeInTheDocument();
  });
});
