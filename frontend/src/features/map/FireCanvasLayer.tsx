import { useEffect, useRef } from 'react';
import { circleMarker, layerGroup, type CircleMarker, type CircleMarkerOptions, type LayerGroup } from 'leaflet';
import { useMap } from 'react-leaflet';

import type { FireDetection } from '../../types/api';

const fireRadius = (fire: FireDetection, selected: boolean) => {
  if (selected) return 9;
  const frp = fire.frp ?? 0;
  return Math.max(3.5, Math.min(7.5, 3.5 + Math.log10(frp + 1) * 2.3));
};

const fireStyle = (fire: FireDetection, selected: boolean): CircleMarkerOptions => ({
  radius: fireRadius(fire, selected),
  color: fire.confidence === 'high' ? '#ffe08a' : '#ff8b57',
  weight: selected ? 3 : 1,
  fillColor: '#f0442f',
  fillOpacity: 0.82,
});

/**
 * Renders every NASA fire detection as a raw Leaflet circle marker instead of
 * one react-leaflet <CircleMarker> component per fire. At real-world volumes
 * (tens to hundreds of thousands of simultaneous global detections),
 * mounting that many React component instances took 6-15 seconds — long
 * enough to look like the dots simply weren't there, and like they vanished
 * on every pan (the old set unmounts immediately; the new set takes just as
 * long to reappear). Creating the same number of plain Leaflet layers on the
 * map's own shared canvas renderer (`preferCanvas` on the MapContainer) skips
 * React's reconciliation entirely, so every real detection can be shown, not
 * just a capped sample.
 */
export function FireCanvasLayer({ fires, selectedFireId, onSelectFire, visible }: {
  fires: FireDetection[]; selectedFireId: string | null; onSelectFire: (id: string | null) => void; visible: boolean;
}) {
  const map = useMap();
  const groupRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  const firesRef = useRef(fires);
  firesRef.current = fires;
  const onSelectFireRef = useRef(onSelectFire);
  onSelectFireRef.current = onSelectFire;
  const previousSelectedId = useRef<string | null>(null);

  useEffect(() => {
    const group = layerGroup();
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
      markersRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (visible) group.addTo(map);
    else group.remove();
  }, [map, visible]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    const markers = new Map<string, CircleMarker>();
    for (const fire of fires) {
      const marker = circleMarker([fire.latitude, fire.longitude], fireStyle(fire, fire.id === selectedFireId));
      marker.bindTooltip(
        `${fire.satellite} · ${fire.confidence} · FRP ${fire.frp !== null ? fire.frp.toFixed(1) : '—'} MW`,
        { direction: 'top' },
      );
      marker.bindPopup(
        `<strong>Detección VIIRS real</strong><br>${new Date(fire.acquired_at).toLocaleString('es-ES')}<br>`
        + `FRP: ${fire.frp !== null ? fire.frp.toFixed(1) : '—'} MW`,
      );
      marker.on('click', () => onSelectFireRef.current(fire.id));
      marker.addTo(group);
      markers.set(fire.id, marker);
    }
    markersRef.current = markers;
    // Deliberately not depending on `selectedFireId`: the effect below
    // restyles just the one or two affected markers on a selection change
    // instead of rebuilding this entire set — the difference between an
    // instant click and re-creating a hundred thousand layers per click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fires]);

  useEffect(() => {
    const markers = markersRef.current;
    const previous = previousSelectedId.current;
    if (previous && previous !== selectedFireId) {
      const previousFire = firesRef.current.find((item) => item.id === previous);
      const previousMarker = markers.get(previous);
      if (previousFire && previousMarker) previousMarker.setStyle(fireStyle(previousFire, false));
    }
    if (selectedFireId) {
      const currentFire = firesRef.current.find((item) => item.id === selectedFireId);
      const currentMarker = markers.get(selectedFireId);
      if (currentFire && currentMarker) currentMarker.setStyle(fireStyle(currentFire, true));
    }
    previousSelectedId.current = selectedFireId;
  }, [selectedFireId]);

  return null;
}
