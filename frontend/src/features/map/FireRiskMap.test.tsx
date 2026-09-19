import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FireRiskMap } from './FireRiskMap';

const fitBounds = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ eventHandlers }: { eventHandlers?: { tileerror?: () => void } }) =>
    <button type="button" onClick={() => eventHandlers?.tileerror?.()}>Simular fallo de tesela</button>,
  WMSTileLayer: ({ layers, url }: { layers: string; url: string }) => <span>WMS {url} {layers}</span>,
  ZoomControl: ({ position }: { position: string }) => <div aria-label="Control de zoom">Zoom {position} + -</div>,
  Circle: () => null,
  CircleMarker: () => null,
  LayersControl: ({ children }: { children: ReactNode }) => <>{children}</>,
  LayerGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  Marker: ({ children }: { children: ReactNode }) => <>{children}</>,
  Polygon: () => null,
  Polyline: () => null,
  Popup: ({ children }: { children: ReactNode }) => <>{children}</>,
  Rectangle: () => null,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  useMap: () => ({ flyTo: vi.fn(), fitBounds, invalidateSize: vi.fn(), getBounds: () => ({ getWest: () => -7, getSouth: () => 39, getEast: () => -5, getNorth: () => 41 }), getZoom: () => 6 }),
  useMapEvents: () => ({ getBounds: () => ({ getWest: () => -7, getSouth: () => 39, getEast: () => -5, getNorth: () => 41 }), getZoom: () => 6 }),
}));

describe('FireRiskMap', () => {
  beforeEach(() => {
    fitBounds.mockClear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it('contains tile failure without hiding map controls', () => {
    render(
      <FireRiskMap
        layers={{ fire: true, spread: true }}
        baseMap="satellite"
        fires={[]}
        selectedFireId={null}
        onSelectFire={vi.fn()}
        onViewport={vi.fn()}
        fireSpread={{ status: 'idle', data: null, error: null, hour: 0, setHour: vi.fn() }}
      />,
    );
    expect(screen.getByLabelText('Mapa de riesgo de incendio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simular fallo de tesela' }));
    expect(screen.getByText('El mapa base no está disponible')).toBeInTheDocument();
    expect(screen.getByText(/fires_viirs_noaa20_24/)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/fires\/wms/)).toBeInTheDocument();
    expect(screen.getByLabelText('Control de zoom')).toHaveTextContent('bottomright');
    expect(screen.getByLabelText('Control de zoom')).toHaveTextContent('+ -');
    expect(screen.queryByText(/Foco térmico VIIRS/)).not.toBeInTheDocument();
  });

  it('auto-focuses spread once per playback so manual zoom is not overridden', () => {
    const fireSpread = {
      status: 'success' as const,
      error: null,
      hour: 1,
      setHour: vi.fn(),
      data: {
        center: { lat: 39.7, lon: -6.2 },
        max_hours: 12,
        terrain_source: 'flat-fallback' as const,
        fuel_source: 'fallback-grass' as const,
        ignition_points: [{ lat: 39.7, lon: -6.2 }],
        weather: [],
        warning: '',
        model_notes: [],
        snapshots: [
          { hour: 0, radius_km_min: 0, radius_km_mean: 0, radius_km_max: 0, area_km2: 0, rings: [] },
          {
            hour: 1,
            radius_km_min: 0.1,
            radius_km_mean: 0.2,
            radius_km_max: 0.3,
            area_km2: 0.1,
            rings: [[{ lat: 39.7, lon: -6.2 }, { lat: 39.71, lon: -6.19 }, { lat: 39.69, lon: -6.18 }]],
          },
          {
            hour: 2,
            radius_km_min: 0.2,
            radius_km_mean: 0.3,
            radius_km_max: 0.4,
            area_km2: 0.2,
            rings: [[{ lat: 39.7, lon: -6.2 }, { lat: 39.72, lon: -6.18 }, { lat: 39.68, lon: -6.17 }]],
          },
        ],
      },
    };

    const { rerender } = render(
      <FireRiskMap
        layers={{ fire: true, spread: true }}
        baseMap="satellite"
        fires={[]}
        selectedFireId={null}
        onSelectFire={vi.fn()}
        onViewport={vi.fn()}
        fireSpread={fireSpread}
        followSpread
      />,
    );

    expect(fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <FireRiskMap
        layers={{ fire: true, spread: true }}
        baseMap="satellite"
        fires={[]}
        selectedFireId={null}
        onSelectFire={vi.fn()}
        onViewport={vi.fn()}
        fireSpread={{ ...fireSpread, hour: 2 }}
        followSpread
      />,
    );

    expect(fitBounds).toHaveBeenCalledTimes(1);
  });
});
