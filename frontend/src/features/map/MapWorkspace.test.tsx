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
  layers: { fire: true, spread: true, camera: true },
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

const cameraFires = {
  fires: [],
  status: 'idle' as const,
  error: null,
  notification: null,
  dismissNotification: () => undefined,
};

describe('MapWorkspace', () => {
  it('starts in the full map view', () => {
    render(<MapWorkspace dashboard={dashboard as never} liveFires={liveFires as never} fireSpread={fireSpread} cameraFires={cameraFires} />);

    expect(screen.getByTestId('fire-risk-map')).toHaveAttribute('data-initial-view', 'global');
  });

  it('opens the Vonage YOLO streaming panel for a selected fire', () => {
    render(
      <MapWorkspace
        dashboard={dashboard as never}
        liveFires={{ ...liveFires, selectedFireId: 'fire-1' } as never}
        fireSpread={fireSpread}
        cameraFires={cameraFires}
      />,
    );

    const cameraButton = screen.getByRole('button', { name: /abrir streaming vonage yolo/i });
    fireEvent.click(cameraButton);

    expect(screen.getByRole('dialog', { name: /vonage connected streaming/i })).toBeInTheDocument();
    expect(screen.getByText(/Vonage connected/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Vonage YOLO real time camera/i)).toHaveAttribute('src', '/api/video/camera');
  });

  it('opens the live camera stream with coordinates for a selected camera fire before its recording is ready', () => {
    render(
      <MapWorkspace
        dashboard={dashboard as never}
        liveFires={{ ...liveFires, selectedFireId: 'camera-12' } as never}
        fireSpread={fireSpread}
        cameraFires={{
          ...cameraFires,
          fires: [{
            id: 12,
            latitude: 41.3874,
            longitude: 2.1686,
            confidence: 0.86,
            label: 'Cámara en tiempo real',
            source: 'camera',
            detected_at: '2026-09-20T10:00:00Z',
            recording_url: null,
          }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir streaming vonage yolo/i }));

    expect(screen.getByTitle(/Vonage YOLO real time camera/i)).toHaveAttribute(
      'src',
      '/api/video/camera-live?lat=41.3874&lon=2.1686',
    );
  });

  it('renders a playable video for a selected camera fire with a saved recording', () => {
    render(
      <MapWorkspace
        dashboard={dashboard as never}
        liveFires={{ ...liveFires, selectedFireId: 'camera-12' } as never}
        fireSpread={fireSpread}
        cameraFires={{
          ...cameraFires,
          fires: [{
            id: 12,
            latitude: 41.3874,
            longitude: 2.1686,
            confidence: 0.86,
            label: 'Cámara en tiempo real',
            source: 'camera',
            detected_at: '2026-09-20T10:00:00Z',
            recording_url: '/camera-fires/12/recording',
          }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir streaming vonage yolo/i }));

    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('controls');
    expect(video?.querySelector('source')).toHaveAttribute('src', '/api/camera-fires/12/recording');
  });

  it('hides the Vonage YOLO camera action until a fire is selected', () => {
    render(<MapWorkspace dashboard={dashboard as never} liveFires={liveFires as never} fireSpread={fireSpread} cameraFires={cameraFires} />);

    expect(screen.queryByRole('button', { name: /abrir streaming vonage yolo/i })).not.toBeInTheDocument();
  });
});
