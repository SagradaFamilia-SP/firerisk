import { useMemo } from 'react';
import { svg } from 'leaflet';
import { CircleMarker, LayerGroup, Polygon, Tooltip } from 'react-leaflet';

import type { LayerKey } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { CameraFireDetection, FireDetection } from '../../types/api';
import { cameraDetectionId } from './cameraFireToDetection';
import { FireCanvasLayer } from './FireCanvasLayer';

export function MapOverlays({ layers, fires, cameraFires, selectedFireId, onSelectFire, fireSpread }: {
  layers: Record<LayerKey, boolean>;
  fires: FireDetection[]; cameraFires: CameraFireDetection[]; selectedFireId: string | null;
  onSelectFire: (id: string | null) => void;
  fireSpread: FireSpread;
}) {
  // The map's shared canvas renderer (`preferCanvas`, for the tens of
  // thousands of fire dots) only repaints its raster at discrete checkpoints
  // — mid-flyTo it just CSS-scales the last painted frame to match the
  // in-progress zoom. For a small polygon like the propagation ring, that
  // makes it visibly balloon past its real size for the length of the
  // animation. SVG paths instead redraw as real vectors on every frame, so
  // giving this one layer its own SVG renderer keeps it geometrically
  // correct throughout the camera flight instead of only after it settles.
  const spreadRenderer = useMemo(() => svg(), []);
  const fireHour = fireSpread.data ? Math.min(fireSpread.hour, fireSpread.data.max_hours) : 0;
  const fireSnapshot = fireSpread.data?.snapshots[fireHour] ?? null;
  const fireRings: [number, number][][] = (fireSnapshot?.rings ?? [])
    .map((ring) => ring.map((point): [number, number] => [point.lat, point.lon]))
    .filter((ring) => ring.length >= 3);
  return (
    <>
      <FireCanvasLayer fires={fires} selectedFireId={selectedFireId} onSelectFire={onSelectFire} visible={layers.fire} />
      {layers.spread && fireRings.length > 0 && <LayerGroup>{fireRings.map((ring, index) => <Polygon key={index} positions={ring} renderer={spreadRenderer} pathOptions={{ color: '#ff2d1f', weight: 2.5, fillColor: '#ff5a3d', fillOpacity: 0.28 }}>
        <Tooltip>Propagación real (rejilla) · +{fireHour} h · radio máx {fireSnapshot?.radius_km_max.toFixed(2)} km</Tooltip>
      </Polygon>)}</LayerGroup>}
      {layers.camera && <LayerGroup>{cameraFires.map((fire) => {
        const id = cameraDetectionId(fire.id);
        const selected = selectedFireId === id;
        return (
          <CircleMarker
            key={id}
            center={[fire.latitude, fire.longitude]}
            radius={selected ? 11 : 8}
            pathOptions={{ color: '#bfe3ff', weight: selected ? 3 : 2, fillColor: '#4ca7ee', fillOpacity: 0.85 }}
            eventHandlers={{ click: () => onSelectFire(id) }}
          >
            <Tooltip direction="top">{fire.label} · confianza {(fire.confidence * 100).toFixed(0)}%</Tooltip>
          </CircleMarker>
        );
      })}</LayerGroup>}
    </>
  );
}
