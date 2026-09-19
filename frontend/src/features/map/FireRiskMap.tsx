import { useCallback, useEffect, useRef, useState } from 'react';
import { latLngBounds } from 'leaflet';
import { MapContainer, TileLayer, useMap, useMapEvents, WMSTileLayer, ZoomControl } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { FireDetection, MapViewport } from '../../types/api';
import { SITE } from './geo';
import { MapOverlays } from './MapOverlays';

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
  useEffect(() => {
    if (!followSpread) {
      hasFocusedPlayback.current = false;
      return;
    }
    if (hasFocusedPlayback.current || !fireSpread.data) return;
    const snapshot = fireSpread.data.snapshots[Math.min(fireSpread.hour, fireSpread.data.max_hours)];
    if (!snapshot || snapshot.polygon.length < 3) return;
    const bounds = latLngBounds(snapshot.polygon.map((point) => [point.lat, point.lon]));
    hasFocusedPlayback.current = true;
    map.fitBounds(bounds.pad(0.35), {
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: 0.55,
      padding: [42, 42],
      maxZoom: 13,
    });
  }, [fireSpread.data, fireSpread.hour, followSpread, map]);
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
        {layers.fire && <WMSTileLayer
          url="/api/fires/wms"
          layers="fires_viirs_noaa20_24,fires_viirs_noaa21_24"
          format="image/png"
          transparent
          version="1.1.1"
          attribution="NASA FIRMS"
        />}
        <MapOverlays layers={layers} fires={fires} selectedFireId={selectedFireId} onSelectFire={onSelectFire} fireSpread={fireSpread} />
        <MapController />
        <SpreadAutoFocus fireSpread={fireSpread} followSpread={followSpread} />
        <ViewportObserver onViewport={onViewport} />
      </MapContainer>
      {tileFailed && <div className="map-warning" role="status">El mapa base no está disponible</div>}
    </div>
  );
}
