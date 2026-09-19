import { CircleMarker, LayerGroup, Polygon, Polyline, Popup, Rectangle, Tooltip } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { FireDetection, ScenarioInput, SimulationResponse } from '../../types/api';
import { destination, percentagePolygonToCoordinates } from './geo';

const perimeter: [number, number][] = [[39.735, -6.292], [39.734, -6.245], [39.708, -6.237], [39.697, -6.275], [39.709, -6.299]];

export function MapOverlays({ scenario, simulation, layers, fires, selectedFireId, onSelectFire }: {
  scenario: ScenarioInput; simulation: SimulationResponse | null; layers: Record<LayerKey, boolean>;
  fires: FireDetection[]; selectedFireId: string | null; onSelectFire: (id: string | null) => void;
}) {
  const spreadPolygon = percentagePolygonToCoordinates(simulation?.propagation_polygon ?? []);
  return (
    <>
      {layers.fire && <LayerGroup>{fires.map((fire) => <CircleMarker
        key={fire.id}
        center={[fire.latitude, fire.longitude]}
        radius={selectedFireId === fire.id ? 10 : Math.max(4, Math.min(9, 3 + Math.sqrt(fire.frp ?? 0) / 2))}
        pathOptions={{ color: fire.confidence === 'high' ? '#ffe08a' : '#ff8b57', weight: selectedFireId === fire.id ? 3 : 1, fillColor: '#f0442f', fillOpacity: 0.82 }}
        eventHandlers={{ click: () => onSelectFire(fire.id) }}
      ><Tooltip direction="top">{fire.satellite} · {fire.confidence} · FRP {fire.frp?.toFixed(1) ?? '—'} MW</Tooltip><Popup><strong>Detección VIIRS real</strong><br />{new Date(fire.acquired_at).toLocaleString('es-ES')}<br />FRP: {fire.frp?.toFixed(1) ?? '—'} MW</Popup></CircleMarker>)}</LayerGroup>}
      {layers.spread && spreadPolygon.length >= 3 && <Polygon positions={spreadPolygon} pathOptions={{ color: '#ff6b3d', weight: 3, dashArray: '10 7', fillColor: '#ff7a32', fillOpacity: 0.24 }}><Tooltip>Propagación estimada · +{scenario.hour} h</Tooltip></Polygon>}
      {layers.wind && <LayerGroup>{Array.from({ length: 48 }, (_, index) => {
        const row = Math.floor(index / 8); const col = index % 8;
        const start: [number, number] = [39.66 + row * 0.019, -6.39 + col * 0.026];
        return <Polyline key={index} positions={[start, destination(start, scenario.wind_direction, 0.75)]} pathOptions={{ color: index % 3 === 0 ? '#f6b94a' : '#e7d06a', opacity: 0.55, weight: 1.25 }} />;
      })}</LayerGroup>}
      {layers.assets && <LayerGroup>
        <Polygon positions={perimeter} pathOptions={{ color: '#49a6ff', weight: 2, fillColor: '#1675bb', fillOpacity: 0.12 }}><Tooltip>Perímetro Talaván Norte</Tooltip></Polygon>
        {Array.from({ length: 24 }, (_, index) => { const row = Math.floor(index / 6); const col = index % 6; const lat = 39.706 + row * 0.006; const lng = -6.288 + col * 0.007; return <Rectangle key={index} bounds={[[lat, lng], [lat + 0.003, lng + 0.005]]} pathOptions={{ color: '#79c9ff', weight: 0.5, fillColor: '#217bb4', fillOpacity: 0.42 }} />; })}
        {(simulation?.assets ?? []).map((asset) => <CircleMarker key={asset.id} center={[asset.lat, asset.lng]} radius={8} pathOptions={{ color: asset.probability >= 70 ? '#ff7952' : '#62b8ff', fillColor: '#0b1a27', fillOpacity: 1, weight: 3 }}><Popup><strong>{asset.name}</strong><br />Afección: {asset.probability}%<br />Distancia: {asset.distance_km} km</Popup></CircleMarker>)}
      </LayerGroup>}
    </>
  );
}
