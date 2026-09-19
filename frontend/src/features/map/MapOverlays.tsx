import { Circle, CircleMarker, LayerGroup, Polygon, Polyline, Popup, Rectangle, Tooltip } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { ScenarioInput, SimulationResponse } from '../../types/api';
import { destination, FIRE, percentagePolygonToCoordinates } from './geo';

const perimeter: [number, number][] = [[39.735, -6.292], [39.734, -6.245], [39.708, -6.237], [39.697, -6.275], [39.709, -6.299]];

export function MapOverlays({ scenario, simulation, layers }: {
  scenario: ScenarioInput; simulation: SimulationResponse | null; layers: Record<LayerKey, boolean>;
}) {
  const spreadPolygon = percentagePolygonToCoordinates(simulation?.propagation_polygon ?? []);
  return (
    <>
      {layers.risk && <LayerGroup>{[11500, 8500, 5600, 3100].map((radius, index) => <Circle key={radius} center={FIRE} radius={radius} pathOptions={{ color: ['#e9b949', '#f59e3d', '#f36b32', '#ef4444'][index], weight: 1, fillOpacity: 0.025 + index * 0.018 }} />)}</LayerGroup>}
      {layers.fire && scenario.hotspot_active && <LayerGroup><CircleMarker center={FIRE} radius={12} pathOptions={{ color: '#ff7a45', weight: 3, fillColor: '#ef3f34', fillOpacity: 0.92 }}><Tooltip direction="top">Foco térmico VIIRS · confianza 82%</Tooltip></CircleMarker><Circle center={FIRE} radius={1200} pathOptions={{ color: '#ff6246', dashArray: '8 8', fillOpacity: 0.05 }} /></LayerGroup>}
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

