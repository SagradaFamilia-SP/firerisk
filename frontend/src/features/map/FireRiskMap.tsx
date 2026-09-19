import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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

function ViewportObserver({ onViewport, suppressUntilRef }: {
  onViewport: (viewport: MapViewport) => void; suppressUntilRef: RefObject<number>;
}) {
  const emit = useCallback((map: ReturnType<typeof useMap>) => {
    // `map.invalidateSize()` fires its own synchronous 'moveend' — with the
    // map still at its *old* position — whenever the container's size
    // actually changed, regardless of its `pan` option. Left unguarded, that
    // phantom move looks exactly like the user panning away from whatever
    // fire was just selected, and deselects it a moment before the real
    // fly-to even starts. Skip viewport updates during that short window.
    if (Date.now() < suppressUntilRef.current) return;
    const bounds = map.getBounds();
    onViewport({
      west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(),
      north: bounds.getNorth(), zoom: map.getZoom(),
    });
  }, [onViewport, suppressUntilRef]);
  const map = useMapEvents({ moveend: () => emit(map), zoomend: () => emit(map) });
  useEffect(() => emit(map), [emit, map]);
  return null;
}

// A neutral "not too close, not too far" zoom for a freshly clicked point —
// close enough to read the terrain around it, far enough to still show
// where it sits relative to nearby detections.
const SELECTION_ZOOM = 12;

function SelectionAutoCenter({ fires, selectedFireId, suppressUntilRef }: {
  fires: FireDetection[]; selectedFireId: string | null; suppressUntilRef: RefObject<number>;
}) {
  const map = useMap();
  const centeredFireId = useRef<string | null>(null);
  // Read the latest `fires` through a ref instead of a dependency: this effect
  // must only restart its timer when the *selection* changes, not every time
  // a background fetch hands back a new `fires` array reference (which would
  // cancel the pending centering — via the cleanup below — before it ever fires).
  const firesRef = useRef(fires);
  firesRef.current = fires;

  useEffect(() => {
    if (!selectedFireId) {
      // Deselecting clears the memory of what's already centered, so
      // re-picking the same fire later (after panning away from it) centers
      // it again instead of silently doing nothing.
      centeredFireId.current = null;
      return;
    }
    if (selectedFireId === centeredFireId.current) return;
    const fire = firesRef.current.find((item) => item.id === selectedFireId);
    if (!fire) return;
    centeredFireId.current = selectedFireId;
    const target: [number, number] = [fire.latitude, fire.longitude];

    // Selecting a fire can simultaneously open the telemetry panel (a CSS
    // width transition on `.workspace`) or reveal a map that was hidden
    // behind the incident table — either way the map's container is still
    // resizing/settling. Flying immediately makes Leaflet animate against a
    // moving, stale-sized viewport: the pan looks janky and can land off the
    // real target. Waiting a beat for layout to settle, then telling Leaflet
    // to re-measure before flying, fixes both.
    const timer = window.setTimeout(() => {
      // Covers invalidateSize's own synchronous phantom moveend; well clear
      // of it by the time flyTo's single real moveend fires ~1.3s later.
      suppressUntilRef.current = Date.now() + 400;
      map.invalidateSize();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        map.setView(target, SELECTION_ZOOM, { animate: false });
        return;
      }
      map.flyTo(target, SELECTION_ZOOM, { duration: 1.3 });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [selectedFireId, map, suppressUntilRef]);
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
  // Shared between SelectionAutoCenter and ViewportObserver so a programmatic
  // re-center's own side effects (see ViewportObserver) don't get mistaken
  // for the user panning away from what was just selected.
  const suppressViewportUntilRef = useRef(0);
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
        <SelectionAutoCenter fires={fires} selectedFireId={selectedFireId} suppressUntilRef={suppressViewportUntilRef} />
        <SpreadAutoFocus fireSpread={fireSpread} followSpread={followSpread} />
        <ViewportObserver onViewport={onViewport} suppressUntilRef={suppressViewportUntilRef} />
      </MapContainer>
      {tileFailed && <div className="map-warning" role="status">El mapa base no está disponible</div>}
    </div>
  );
}
