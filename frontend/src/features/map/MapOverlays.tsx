import { CircleMarker, LayerGroup, Polygon, Popup, Tooltip } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { FireDetection } from '../../types/api';

const fireRadius = (fire: FireDetection, selected: boolean) => {
  if (selected) return 9;
  const frp = fire.frp ?? 0;
  return Math.max(3.5, Math.min(7.5, 3.5 + Math.log10(frp + 1) * 2.3));
};

export function MapOverlays({ layers, fires, selectedFireId, onSelectFire, fireSpread }: {
  layers: Record<LayerKey, boolean>;
  fires: FireDetection[]; selectedFireId: string | null; onSelectFire: (id: string | null) => void;
  fireSpread: FireSpread;
}) {
  const fireHour = fireSpread.data ? Math.min(fireSpread.hour, fireSpread.data.max_hours) : 0;
  const fireSnapshot = fireSpread.data?.snapshots[fireHour] ?? null;
  const firePolygon: [number, number][] = fireSnapshot && fireSnapshot.radius_km_max > 0
    ? fireSnapshot.polygon.map((point): [number, number] => [point.lat, point.lon])
    : [];
  return (
    <>
      {layers.fire && <LayerGroup>{fires.map((fire) => <CircleMarker
        key={fire.id}
        center={[fire.latitude, fire.longitude]}
        radius={fireRadius(fire, selectedFireId === fire.id)}
        pathOptions={{ color: fire.confidence === 'high' ? '#ffe08a' : '#ff8b57', weight: selectedFireId === fire.id ? 3 : 1, fillColor: '#f0442f', fillOpacity: 0.82 }}
        eventHandlers={{ click: () => onSelectFire(fire.id) }}
      ><Tooltip direction="top">{fire.satellite} · {fire.confidence} · FRP {fire.frp?.toFixed(1) ?? '—'} MW</Tooltip><Popup><strong>Detección VIIRS real</strong><br />{new Date(fire.acquired_at).toLocaleString('es-ES')}<br />FRP: {fire.frp?.toFixed(1) ?? '—'} MW</Popup></CircleMarker>)}</LayerGroup>}
      {layers.spread && firePolygon.length >= 3 && <Polygon positions={firePolygon} pathOptions={{ color: '#ff2d1f', weight: 2.5, fillColor: '#ff5a3d', fillOpacity: 0.28 }}>
        <Tooltip>Propagación direccional real · +{fireHour} h · radio máx {fireSnapshot?.radius_km_max.toFixed(2)} km</Tooltip>
      </Polygon>}
    </>
  );
}
