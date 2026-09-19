import { useCallback, useEffect, useRef, useState } from 'react';
import { latLngBounds, type LatLngBounds } from 'leaflet';
import { MapContainer, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { FireDetection, MapViewport, SpreadResponse } from '../../types/api';
import { SITE } from './geo';
import { MapOverlays } from './MapOverlays';

// The fullest extent the fire ever reaches, so the very first fit-bounds on
// play already frames the whole animation — otherwise fitting to hour 0/1
// (a tiny ~100 m ring) leaves the view too tight, and the fire visibly grows
// past the edges of the frame for the rest of the playback.
function boundsForFullSpread(data: SpreadResponse): LatLngBounds | null {
  for (let hour = data.max_hours; hour >= 0; hour -= 1) {
    const points = data.snapshots[hour]?.rings.flat() ?? [];
    if (points.length >= 3) return latLngBounds(points.map((point): [number, number] => [point.lat, point.lon]));
  }
  return null;
}

function MapController() {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [map]);
  return null;
}

function ViewportObserver({ onViewport }: { onViewport: (viewport: MapViewport) => void }) {
  const emit = useCallback((map: ReturnType<typeof useMap>) => {
    const bounds = map.getBounds();
    onViewport({
      west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(),
      north: bounds.getNorth(), zoom: map.getZoom(),
    });
  }, [onViewport]);
  const map = useMapEvents({ moveend: () => emit(map), zoomend: () => emit(map) });
  useEffect(() => emit(map), [emit, map]);
  return null;
}

function SpreadAutoFocus({ fireSpread, followSpread }: { fireSpread: FireSpread; followSpread: boolean }) {
  const map = useMap();
  const hasFocusedPlayback = useRef(false);
  const focusedCenter = useRef<string | null>(null);
  useEffect(() => {
    // A fire switch mid-playback never toggles `followSpread` off, so track the
    // fire's own identity too: otherwise the camera stays parked on whichever
    // fire it last focused and never re-centers on the newly selected one.
    const centerKey = fireSpread.data ? `${fireSpread.data.center.lat},${fireSpread.data.center.lon}` : null;
    if (centerKey !== focusedCenter.current) {
      focusedCenter.current = centerKey;
      hasFocusedPlayback.current = false;
    }
    if (!followSpread) {
      hasFocusedPlayback.current = false;
      return;
    }
    if (hasFocusedPlayback.current || !fireSpread.data) return;
    const { center } = fireSpread.data;
    const bounds = boundsForFullSpread(fireSpread.data)
      ?? latLngBounds([center.lat - 0.01, center.lon - 0.01], [center.lat + 0.01, center.lon + 0.01]);
    hasFocusedPlayback.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.fitBounds(bounds.pad(0.35), { animate: false, padding: [42, 42], maxZoom: 13 });
      return;
    }
    // flyToBounds gives a smooth, cinematic pan+zoom to the target no matter
    // how far/zoomed-out the map currently is. Plain fitBounds only animates
    // for a small zoom delta — for a big jump (e.g. from the global view) it
    // just snaps the view instantly instead of easing into it.
    map.flyToBounds(bounds.pad(0.35), { padding: [42, 42], maxZoom: 13, duration: 1.4 });
  }, [fireSpread.data, followSpread, map]);
  return null;
}

export function FireRiskMap({ layers, baseMap, initialView = 'site', fires, selectedFireId, onSelectFire, onViewport, fireSpread, followSpread = false }: {
  layers: Record<LayerKey, boolean>;
  baseMap: 'satellite' | 'street'; initialView?: 'site' | 'global';
  fires: FireDetection[]; selectedFireId: string | null;
  onSelectFire: (id: string | null) => void; onViewport: (viewport: MapViewport) => void;
  fireSpread: FireSpread; followSpread?: boolean;
}) {
  const [tileFailed, setTileFailed] = useState(false);
  const tile = baseMap === 'satellite'
    ? { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' }
    : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };
  return (
    <div className="map-canvas" aria-label="Mapa de riesgo de incendio">
      <MapContainer center={initialView === 'global' ? [20, 0] : SITE} zoom={initialView === 'global' ? 2 : 12} minZoom={2} zoomControl={false} preferCanvas className="leaflet-map">
        <ZoomControl position="bottomright" />
        <TileLayer key={baseMap} url={tile.url} attribution={tile.attribution} eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} />
        <MapOverlays layers={layers} fires={fires} selectedFireId={selectedFireId} onSelectFire={onSelectFire} fireSpread={fireSpread} />
        <MapController />
        <SpreadAutoFocus fireSpread={fireSpread} followSpread={followSpread} />
        <ViewportObserver onViewport={onViewport} />
      </MapContainer>
      {tileFailed && <div className="map-warning" role="status">El mapa base no está disponible</div>}
    </div>
  );
}
