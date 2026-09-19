import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncState } from '../../hooks/useDashboard';
import { AppShell } from './AppShell';

const dashboard = {
  health: {
    status: 'success',
    data: { ok: true, model_online: false, models: [], configured_model: 'qwen' },
    error: null,
  } satisfies AsyncState<{ ok: boolean; model_online: boolean; models: string[]; configured_model: string }>,
  layers: { fire: true, spread: true },
  toggleLayer: () => undefined,
};

const liveFires = {
  state: { status: 'idle' as const, data: null, error: null },
  viewport: null,
  filters: { hours: 24 as const, sources: ['VIIRS_NOAA20_NRT' as const, 'VIIRS_NOAA21_NRT' as const], minConfidence: 'low' as const },
  selectedFireId: null,
  updateViewport: () => undefined,
  updateFilters: () => undefined,
  setSelectedFireId: () => undefined,
};

const selectedDetection = {
  id: 'fire-215',
  latitude: 40.7341,
  longitude: -86.436,
  acquired_at: '2026-09-19T08:07:00Z',
  satellite: 'N21',
  instrument: 'VIIRS',
  source: 'VIIRS_NOAA21_NRT' as const,
  confidence: 'nominal' as const,
  brightness: 299.7,
  brightness_ti5: null,
  frp: 0.7,
  scan: 0.43,
  track: 0.46,
  daynight: 'night' as const,
};

const selectedLiveFires = {
  ...liveFires,
  selectedFireId: selectedDetection.id,
  state: {
    status: 'success' as const,
    data: {
      detections: [selectedDetection],
      meta: {
        sources: ['VIIRS_NOAA21_NRT' as const],
        requested_hours: 24 as const,
        fetched_at: '2026-09-19T13:21:03Z',
        latest_acquisition: '2026-09-19T08:07:00Z',
        count: 1,
        stale: false,
        cache: 'hit' as const,
      },
    },
    error: null,
  },
};

const fireSpread = {
  status: 'idle' as const,
  data: null,
  error: null,
  hour: 0,
  setHour: () => undefined,
};

const chat = {
  entries: [],
  pending: false,
  error: null,
  send: () => undefined,
  reset: () => undefined,
};

const fireReport = {
  status: 'idle' as const,
  error: null,
  pendingDownload: false,
  download: () => undefined,
  dismiss: () => undefined,
};

const simulation = {
  point: null,
  pick: () => undefined,
  clear: () => undefined,
  status: 'idle' as const,
  data: null,
  error: null,
  hour: 0,
  setHour: () => undefined,
};

describe('AppShell tactical layout', () => {
  it('renders the IGNIS tactical chrome around the live map workspace', () => {
    render(
      <AppShell
        dashboard={dashboard as never}
        liveFires={liveFires}
        fireSpread={fireSpread}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    expect(screen.getByText('Vista sin foco seleccionado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Activo asignado')).not.toBeInTheDocument();
    expect(screen.getByText('MONITORIZACIÓN')).toBeInTheDocument();
    expect(screen.getByAltText('PYROS')).toBeInTheDocument();
    expect(screen.getByText('Mapa')).toBeInTheDocument();
    expect(screen.getByText('Tabla de incendios')).toBeInTheDocument();
    expect(screen.getByText('Simulación de incendios')).toBeInTheDocument();
    expect(screen.getByText('API OPERATIVA')).toBeInTheDocument();
    expect(screen.getByText('FALLBACK PREPARADO')).toBeInTheDocument();
    expect(screen.getByLabelText('Mapa táctico')).toBeInTheDocument();
  });

  it('keeps the right telemetry panel hidden until a fire is selected', () => {
    const { rerender } = render(
      <AppShell
        dashboard={dashboard as never}
        liveFires={liveFires}
        fireSpread={fireSpread}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    expect(screen.queryByLabelText('Inteligencia operativa')).not.toBeInTheDocument();

    rerender(
      <AppShell
        dashboard={dashboard as never}
        liveFires={{ ...liveFires, selectedFireId: 'fire-1' }}
        fireSpread={fireSpread}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    expect(screen.getByLabelText('Inteligencia operativa')).toBeInTheDocument();
  });

  it('updates header and sidebar location when a fire is selected', () => {
    render(
      <AppShell
        dashboard={dashboard as never}
        liveFires={selectedLiveFires}
        fireSpread={fireSpread}
        reverseLocation={{
          status: 'success',
          data: {
            label: 'Valle del Tajo, Cáceres',
            place: 'Valle del Tajo',
            municipality: 'Cáceres',
            country: 'España',
            coordinates: '40.7341, -86.4360',
            attribution: '© OpenStreetMap contributors',
          },
          error: null,
        }}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    expect(screen.getByText('Valle del Tajo, Cáceres (40.7341, -86.4360)')).toBeInTheDocument();
    expect(screen.queryByText('Talaván Norte')).not.toBeInTheDocument();
  });

  it('closes the right telemetry window from its header button', () => {
    const setSelectedFireId = vi.fn();
    render(
      <AppShell
        dashboard={dashboard as never}
        liveFires={{ ...selectedLiveFires, setSelectedFireId }}
        fireSpread={fireSpread}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana de telemetría' }));
    expect(setSelectedFireId).toHaveBeenCalledWith(null);
  });

  it('hides the telemetry panel when switching to the fire table, keeping the selection for when the map returns', () => {
    render(
      <AppShell
        dashboard={dashboard as never}
        liveFires={{ ...liveFires, selectedFireId: 'fire-1' }}
        fireSpread={fireSpread}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    expect(screen.getByLabelText('Inteligencia operativa')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tabla de incendios/ }));
    expect(screen.queryByLabelText('Inteligencia operativa')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mapa/ }));
    expect(screen.getByLabelText('Inteligencia operativa')).toBeInTheDocument();
  });

  it('collapses and expands the tactical sidebar from its toggle button', () => {
    render(
      <AppShell
        dashboard={dashboard as never}
        liveFires={liveFires}
        fireSpread={fireSpread}
        chat={chat}
        fireReport={fireReport}
        simulation={simulation}
        map={<div aria-label="Mapa táctico">map</div>}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Plegar menú' });
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Contexto territorial')).toHaveClass('is-collapsed');
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument();
  });
});
