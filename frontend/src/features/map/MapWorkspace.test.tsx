import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MapWorkspace } from './MapWorkspace';

vi.mock('./FireRiskMap', () => ({
  FireRiskMap: ({ initialView }: { initialView: 'site' | 'global' }) => (
    <div data-testid="fire-risk-map" data-initial-view={initialView} />
  ),
}));

vi.mock('./MapToolbar', () => ({
  MapToolbar: () => <div data-testid="map-toolbar" />,
}));

vi.mock('./ForecastTimeline', () => ({
  ForecastTimeline: () => <div data-testid="forecast-timeline" />,
}));

const dashboard = {
  layers: { fire: true, spread: true },
  baseMap: 'satellite',
  setBaseMap: () => undefined,
};

const liveFires = {
  state: { status: 'idle' as const, data: null, error: null },
  selectedFireId: null,
  setSelectedFireId: () => undefined,
  updateViewport: () => undefined,
};

const fireSpread = {
  status: 'idle' as const,
  data: null,
  error: null,
  hour: 0,
  setHour: () => undefined,
};

describe('MapWorkspace', () => {
  it('starts in the full map view', () => {
    render(<MapWorkspace dashboard={dashboard as never} liveFires={liveFires as never} fireSpread={fireSpread} />);

    expect(screen.getByTestId('fire-risk-map')).toHaveAttribute('data-initial-view', 'global');
  });
});
