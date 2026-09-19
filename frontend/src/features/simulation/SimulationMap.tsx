import { useCallback, useEffect } from 'react';
import { CircleMarker, LayerGroup, MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';

import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { SITE } from '../map/geo';

function ClickToSimulate({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function FocusOnPoint({ point }: { point: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 11), { duration: 1 });
  }, [point, map]);
  return null;
}

export function SimulationMap({ simulation }: { simulation: SimulationSpread }) {
  const { point, pick, data, hour } = simulation;
  const handlePick = useCallback((lat: number, lon: number) => pick(lat, lon), [pick]);
  const snapshot = data ? data.snapshots[Math.min(hour, data.max_hours)] : null;
  const rings: [number, number][][] = (snapshot?.rings ?? [])
    .map((ring) => ring.map((item): [number, number] => [item.lat, item.lon]))
    .filter((ring) => ring.length >= 3);

  return (
    <div className="map-canvas" aria-label="Mapa de simulación de incendios">
      <MapContainer center={SITE} zoom={7} minZoom={2} zoomControl={false} preferCanvas className="leaflet-map">
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri"
        />
        <ClickToSimulate onPick={handlePick} />
        {point && (
          <LayerGroup>
            <CircleMarker
              center={[point.lat, point.lon]}
              radius={9}
              pathOptions={{ color: '#fff', weight: 3, fillColor: '#ff5a3d', fillOpacity: 0.95 }}
            >
              <Tooltip direction="top" permanent>Punto de simulación</Tooltip>
            </CircleMarker>
          </LayerGroup>
        )}
        {rings.length > 0 && (
          <LayerGroup>
            {rings.map((ring, index) => (
              <Polygon key={index} positions={ring} pathOptions={{ color: '#ff2d1f', weight: 2.5, fillColor: '#ff5a3d', fillOpacity: 0.28 }}>
                <Tooltip>Propagación simulada · +{hour} h · radio máx {snapshot?.radius_km_max.toFixed(2)} km</Tooltip>
              </Polygon>
            ))}
          </LayerGroup>
        )}
        <FocusOnPoint point={point} />
      </MapContainer>
      {!point && (
        <div className="map-updating" role="status">Haz clic en cualquier punto del mapa para simular un incendio ahí</div>
      )}
    </div>
  );
}
