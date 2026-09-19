import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FireRiskMap } from './FireRiskMap';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ eventHandlers }: { eventHandlers?: { tileerror?: () => void } }) =>
    <button type="button" onClick={() => eventHandlers?.tileerror?.()}>Simular fallo de tesela</button>,
  WMSTileLayer: ({ layers, url }: { layers: string; url: string }) => <span>WMS {url} {layers}</span>,
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
  useMap: () => ({ flyTo: vi.fn(), invalidateSize: vi.fn(), getBounds: () => ({ getWest: () => -7, getSouth: () => 39, getEast: () => -5, getNorth: () => 41 }), getZoom: () => 6 }),
  useMapEvents: () => ({ getBounds: () => ({ getWest: () => -7, getSouth: () => 39, getEast: () => -5, getNorth: () => 41 }), getZoom: () => 6 }),
}));

describe('FireRiskMap', () => {
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
    expect(screen.queryByText(/Foco térmico VIIRS/)).not.toBeInTheDocument();
  });
});
