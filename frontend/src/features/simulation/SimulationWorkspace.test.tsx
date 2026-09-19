import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { SimulationWorkspace } from './SimulationWorkspace';

vi.mock('./SimulationMap', () => ({
  SimulationMap: () => <div aria-label="Mapa de simulación">map</div>,
}));

vi.mock('./SimulationPanel', () => ({
  SimulationPanel: () => <aside aria-label="Simulación de incendio">panel</aside>,
}));

vi.mock('../map/MapToolbar', () => ({
  MapToolbar: () => <div data-testid="map-toolbar" />,
}));

vi.mock('../map/ForecastTimeline', () => ({
  ForecastTimeline: () => <div data-testid="forecast-timeline" />,
}));

const dashboard = {
  baseMap: 'street',
  setBaseMap: vi.fn(),
};

function simulation(point: SimulationSpread['point']): SimulationSpread {
  return {
    point,
    pick: vi.fn(),
    clear: vi.fn(),
    scenario: { frpMw: 4.9, brightnessK: 336.6 },
    updateScenario: vi.fn(),
    status: 'idle',
    data: null,
    error: null,
    hour: 0,
    setHour: vi.fn(),
  };
}

describe('SimulationWorkspace', () => {
  it('shows the start prompt as a map card before a point is selected', () => {
    render(<SimulationWorkspace dashboard={dashboard as never} simulation={simulation(null)} />);

    expect(screen.getByLabelText('Instrucciones de simulación')).toBeInTheDocument();
    expect(screen.getByText('¿Qué pasaría si hay un incendio aquí?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Simulación de incendio')).not.toBeInTheDocument();
  });

  it('opens the right simulation panel after a point is selected', () => {
    render(<SimulationWorkspace dashboard={dashboard as never} simulation={simulation({ lat: 39.7, lon: -6.2 })} />);

    expect(screen.queryByLabelText('Instrucciones de simulación')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Simulación de incendio')).toBeInTheDocument();
  });
});
