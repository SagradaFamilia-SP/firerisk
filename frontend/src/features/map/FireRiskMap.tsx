import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, WMSTileLayer } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { FireDetection, MapViewport, ScenarioInput, SimulationResponse } from '../../types/api';
import { SITE } from './geo';
import { MapOverlays } from './MapOverlays';

function MapController({ selectedAssetId, simulation }: { selectedAssetId: string | null; simulation: SimulationResponse | null }) {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [map]);
  useEffect(() => {
    const asset = simulation?.assets.find((item) => item.id === selectedAssetId);
    if (asset) map.flyTo([asset.lat, asset.lng], 14, { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.7 });
  }, [map, selectedAssetId, simulation]);
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

export function FireRiskMap({ scenario, simulation, layers, baseMap, selectedAssetId, initialView = 'site', fires, selectedFireId, onSelectFire, onViewport }: {
  scenario: ScenarioInput; simulation: SimulationResponse | null; layers: Record<LayerKey, boolean>;
  baseMap: 'satellite' | 'street'; selectedAssetId: string | null; initialView?: 'site' | 'global';
  fires: FireDetection[]; selectedFireId: string | null;
  onSelectFire: (id: string | null) => void; onViewport: (viewport: MapViewport) => void;
}) {
  const [tileFailed, setTileFailed] = useState(false);
  const tile = baseMap === 'satellite'
    ? { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' }
    : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };
  return (
    <div className="map-canvas" aria-label="Mapa de riesgo de incendio">
      <MapContainer center={initialView === 'global' ? [20, 0] : SITE} zoom={initialView === 'global' ? 2 : 12} minZoom={2} zoomControl={false} preferCanvas className="leaflet-map">
        <TileLayer key={baseMap} url={tile.url} attribution={tile.attribution} eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} />
        {layers.fire && <WMSTileLayer
          url="/api/fires/wms"
          layers="fires_viirs_noaa20_24,fires_viirs_noaa21_24"
          format="image/png"
          transparent
          version="1.1.1"
          attribution="NASA FIRMS"
        />}
        <MapOverlays scenario={scenario} simulation={simulation} layers={layers} fires={fires} selectedFireId={selectedFireId} onSelectFire={onSelectFire} />
        <MapController selectedAssetId={selectedAssetId} simulation={simulation} />
        <ViewportObserver onViewport={onViewport} />
      </MapContainer>
      {tileFailed && <div className="map-warning" role="status">El mapa base no está disponible</div>}
    </div>
  );
}
