import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FireDetection } from '../../types/api';
import { FireRiskMap } from './FireRiskMap';

const detection = (over: Partial<FireDetection>): FireDetection => ({
  id: 'fire-1', latitude: 40.0, longitude: -6.0, acquired_at: '2026-09-19T10:00:00Z',
  satellite: 'N21', instrument: 'VIIRS', source: 'VIIRS_NOAA21_NRT', confidence: 'nominal',
  brightness: 300, brightness_ti5: null, frp: 3, scan: 0.4, track: 0.5, daynight: 'day',
  ...over,
});

const fitBounds = vi.fn();
const flyToBounds = vi.fn();
const flyTo = vi.fn();
const setView = vi.fn();
const mapContainer = document.createElement('div');
const overlayPane = document.createElement('div');
const observe = vi.fn();
const disconnect = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ eventHandlers }: { eventHandlers?: { tileerror?: () => void } }) =>
    <button type="button" onClick={() => eventHandlers?.tileerror?.()}>Simular fallo de tesela</button>,
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
  useMap: () => ({
    flyTo, setView, fitBounds, flyToBounds, invalidateSize: vi.fn(),
    // FireCanvasLayer manages its markers via raw Leaflet layer objects
    // (layerGroup().addTo(map)/.remove()), which call these on the map.
    addLayer: vi.fn(), removeLayer: vi.fn(), hasLayer: () => false,
    getContainer: () => mapContainer,
    getPane: () => overlayPane,
    once: vi.fn(),
    getBounds: () => ({ getWest: () => -7, getSouth: () => 39, getEast: () => -5, getNorth: () => 41 }), getZoom: () => 6,
  }),
  useMapEvents: () => ({ getBounds: () => ({ getWest: () => -7, getSouth: () => 39, getEast: () => -5, getNorth: () => 41 }), getZoom: () => 6 }),
}));

describe('FireRiskMap', () => {
  beforeEach(() => {
    fitBounds.mockClear();
    flyToBounds.mockClear();
    flyTo.mockClear();
    setView.mockClear();
    observe.mockClear();
    disconnect.mockClear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({ observe, disconnect }));
  });

  it('contains tile failure without hiding map controls', () => {
    render(
      <FireRiskMap
        layers={{ fire: true, spread: true, camera: true }}
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
        scenario: { frp_mw: 4.9, brightness_k: 336.6, spread_multiplier: 1 },
        snapshots: [
          {
            hour: 0, radius_km_min: 0, radius_km_mean: 0, radius_km_max: 0, area_km2: 0, rings: [],
            intensity_kw_m_min: 0, intensity_kw_m_mean: 0, intensity_kw_m_max: 0, burned_area_by_fuel_km2: {},
          },
          {
            hour: 1,
            radius_km_min: 0.1,
            radius_km_mean: 0.2,
            radius_km_max: 0.3,
            area_km2: 0.1,
            rings: [[{ lat: 39.7, lon: -6.2 }, { lat: 39.71, lon: -6.19 }, { lat: 39.69, lon: -6.18 }]],
            intensity_kw_m_min: 500, intensity_kw_m_mean: 800, intensity_kw_m_max: 1200, burned_area_by_fuel_km2: {},
          },
          {
            hour: 2,
            radius_km_min: 0.2,
            radius_km_mean: 0.3,
            radius_km_max: 0.4,
            area_km2: 0.2,
            rings: [[{ lat: 39.7, lon: -6.2 }, { lat: 39.72, lon: -6.18 }, { lat: 39.68, lon: -6.17 }]],
            intensity_kw_m_min: 600, intensity_kw_m_mean: 900, intensity_kw_m_max: 1400, burned_area_by_fuel_km2: {},
          },
        ],
      },
    };

    const { rerender } = render(
      <FireRiskMap
        layers={{ fire: true, spread: true, camera: true }}
        baseMap="satellite"
        fires={[]}
        selectedFireId={null}
        onSelectFire={vi.fn()}
        onViewport={vi.fn()}
        fireSpread={fireSpread}
        followSpread
      />,
    );

    // A smooth flyToBounds is used (not the instant-snap-on-big-zoom
    // fitBounds) so the zoom into the fire always eases in, never jumps.
    expect(flyToBounds).toHaveBeenCalledTimes(1);
    expect(fitBounds).not.toHaveBeenCalled();
    // The timeline is at hour 1, but the very first fit must already frame
    // the fire's fullest eventual extent (hour 2's larger ring here), not
    // just the tiny current-hour ring — otherwise the fire visibly grows
    // past the edges of the frame for the rest of the playback.
    const firstCallBounds = flyToBounds.mock.calls[0][0];
    expect(firstCallBounds.contains([39.68, -6.17])).toBe(true);

    rerender(
      <FireRiskMap
        layers={{ fire: true, spread: true, camera: true }}
        baseMap="satellite"
        fires={[]}
        selectedFireId={null}
        onSelectFire={vi.fn()}
        onViewport={vi.fn()}
        fireSpread={{ ...fireSpread, hour: 2 }}
        followSpread
      />,
    );

    expect(flyToBounds).toHaveBeenCalledTimes(1);
  });

  it('skips the flight animation and snaps instantly when reduced motion is preferred', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const fireSpread = {
      status: 'success' as const,
      error: null,
      hour: 0,
      setHour: vi.fn(),
      data: {
        center: { lat: 39.7, lon: -6.2 },
        max_hours: 1,
        terrain_source: 'flat-fallback' as const,
        fuel_source: 'fallback-grass' as const,
        ignition_points: [{ lat: 39.7, lon: -6.2 }],
        weather: [],
        warning: '',
        model_notes: [],
        scenario: { frp_mw: 4.9, brightness_k: 336.6, spread_multiplier: 1 },
        snapshots: [
          {
            hour: 0,
            radius_km_min: 0.1,
            radius_km_mean: 0.2,
            radius_km_max: 0.3,
            area_km2: 0.1,
            rings: [[{ lat: 39.7, lon: -6.2 }, { lat: 39.71, lon: -6.19 }, { lat: 39.69, lon: -6.18 }]],
            intensity_kw_m_min: 0, intensity_kw_m_mean: 0, intensity_kw_m_max: 0, burned_area_by_fuel_km2: {},
          },
        ],
      },
    };

    render(
      <FireRiskMap
        layers={{ fire: true, spread: true, camera: true }}
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
    expect(fitBounds.mock.calls[0][1]).toMatchObject({ animate: false });
    expect(flyToBounds).not.toHaveBeenCalled();
  });

  it('centers on a clicked fire at a medium zoom, and again when a different fire is picked', () => {
    vi.useFakeTimers();
    try {
      const fireA = detection({ id: 'fire-a', latitude: 40.0, longitude: -6.0 });
      const fireB = detection({ id: 'fire-b', latitude: 41.5, longitude: -3.2 });
      const idleFireSpread = { status: 'idle' as const, data: null, error: null, hour: 0, setHour: vi.fn() };

      const { rerender } = render(
        <FireRiskMap
          layers={{ fire: true, spread: true, camera: true }}
          baseMap="satellite"
          fires={[fireA, fireB]}
          selectedFireId="fire-a"
          onSelectFire={vi.fn()}
          onViewport={vi.fn()}
          fireSpread={idleFireSpread}
        />,
      );

      // The fly-to is deliberately delayed (to let a simultaneous panel/layout
      // transition settle before Leaflet measures the container), so it must
      // not have fired yet on the same tick as the click.
      expect(flyTo).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(flyTo).toHaveBeenCalledTimes(1);
      expect(flyTo).toHaveBeenCalledWith([40.0, -6.0], 12, expect.objectContaining({ duration: expect.any(Number) }));

      // Dragging to another point and clicking it re-centers on the new fire.
      rerender(
        <FireRiskMap
          layers={{ fire: true, spread: true, camera: true }}
          baseMap="satellite"
          fires={[fireA, fireB]}
          selectedFireId="fire-b"
          onSelectFire={vi.fn()}
          onViewport={vi.fn()}
          fireSpread={idleFireSpread}
        />,
      );
      vi.advanceTimersByTime(300);

      expect(flyTo).toHaveBeenCalledTimes(2);
      expect(flyTo).toHaveBeenLastCalledWith([41.5, -3.2], 12, expect.objectContaining({ duration: expect.any(Number) }));
    } finally {
      vi.useRealTimers();
    }
  });
});
