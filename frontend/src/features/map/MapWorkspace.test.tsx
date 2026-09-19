import { fireEvent, render, screen } from '@testing-library/react';
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

  it('opens the Vonage YOLO streaming panel for a selected fire', () => {
    render(
      <MapWorkspace
        dashboard={dashboard as never}
        liveFires={{ ...liveFires, selectedFireId: 'fire-1' } as never}
        fireSpread={fireSpread}
      />,
    );

    const cameraButton = screen.getByRole('button', { name: /abrir streaming vonage yolo/i });
    fireEvent.click(cameraButton);

    expect(screen.getByRole('dialog', { name: /vonage connected streaming/i })).toBeInTheDocument();
    expect(screen.getByText(/Vonage connected/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Vonage YOLO real time camera/i)).toHaveAttribute('src', '/api/video/camera');
  });

  it('hides the Vonage YOLO camera action until a fire is selected', () => {
    render(<MapWorkspace dashboard={dashboard as never} liveFires={liveFires as never} fireSpread={fireSpread} />);

    expect(screen.queryByRole('button', { name: /abrir streaming vonage yolo/i })).not.toBeInTheDocument();
  });
});
