import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { ScenarioInput, SimulationResponse } from '../../types/api';
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

export function FireRiskMap({ scenario, simulation, layers, baseMap, selectedAssetId }: {
  scenario: ScenarioInput; simulation: SimulationResponse | null; layers: Record<LayerKey, boolean>;
  baseMap: 'satellite' | 'street'; selectedAssetId: string | null;
}) {
  const [tileFailed, setTileFailed] = useState(false);
  const tile = baseMap === 'satellite'
    ? { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' }
    : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };
  return (
    <div className="map-canvas" aria-label="Mapa de riesgo de incendio">
      <MapContainer center={SITE} zoom={12} minZoom={5} zoomControl={false} preferCanvas className="leaflet-map">
        <TileLayer key={baseMap} url={tile.url} attribution={tile.attribution} eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} />
        <MapOverlays scenario={scenario} simulation={simulation} layers={layers} />
        <MapController selectedAssetId={selectedAssetId} simulation={simulation} />
      </MapContainer>
      {tileFailed && <div className="map-warning" role="status">El mapa base no está disponible</div>}
    </div>
  );
}

