import { useEffect, useState } from 'react';
import { CircleMarker, LayerGroup, MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';

import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { SITE } from '../map/geo';

function MapController() {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [map]);
  // Keeps the map correctly sized through any container resize (e.g. a
  // panel opening) without animating — see FireRiskMap.tsx's MapController
  // for why `animate: false` matters (it would otherwise fight a concurrent
  // flyTo for control of the camera).
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, pan: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ClickToSimulate({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function FocusOnPoint({ point }: { point: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    // Same fix as the main map's SelectionAutoCenter: the shared canvas
    // renderer (preferCanvas) only reprojects its content at discrete
    // checkpoints, not every frame of a flyTo — mid-flight it just CSS-
    // scales the last painted frame, which for a wide starting view (many
    // fire dots) balloons into a solid-color blob covering the screen until
    // the flight ends. Fading the overlay pane out for the flight avoids
    // ever showing that stretched frame.
    const pane = map.getPane('overlayPane');
    if (pane) {
      pane.style.transition = 'opacity 200ms ease';
      pane.style.opacity = '0';
      map.once('moveend', () => { pane.style.opacity = '1'; });
    }
    map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 11), { duration: 1.1 });
  }, [point, map]);
  return null;
}

export function SimulationMap({ simulation, baseMap, initialView = 'global' }: {
  simulation: SimulationSpread; baseMap: 'satellite' | 'street'; initialView?: 'site' | 'global';
}) {
  const { point, pick, data, hour } = simulation;
  const [tileFailed, setTileFailed] = useState(false);
  const snapshot = data ? data.snapshots[Math.min(hour, data.max_hours)] : null;
  const rings: [number, number][][] = (snapshot?.rings ?? [])
    .map((ring) => ring.map((item): [number, number] => [item.lat, item.lon]))
    .filter((ring) => ring.length >= 3);
  const tile = baseMap === 'satellite'
    ? { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' }
    : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };

  return (
    <div className="map-canvas" aria-label="Mapa de simulación de incendios">
      <MapContainer center={initialView === 'global' ? [20, 0] : SITE} zoom={initialView === 'global' ? 2 : 12} minZoom={2} zoomControl={false} preferCanvas className="leaflet-map">
        <ZoomControl position="bottomright" />
        <TileLayer key={baseMap} url={tile.url} attribution={tile.attribution} eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} />
        <ClickToSimulate onPick={pick} />
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
        <MapController />
        <FocusOnPoint point={point} />
      </MapContainer>
      {tileFailed && <div className="map-warning" role="status">El mapa base no está disponible</div>}
    </div>
  );
}
