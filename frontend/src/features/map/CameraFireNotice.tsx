import { Flame, MapPinned, X } from 'lucide-react';
import { useMemo } from 'react';

import { useReverseLocation } from '../../hooks/useReverseLocation';
import type { CameraFireDetection } from '../../types/api';

export function CameraFireNotice({ notification, onDismiss, onViewOnMap }: {
  notification: CameraFireDetection | null; onDismiss: () => void; onViewOnMap: (id: number) => void;
}) {
  // Memoized on the notification's own identity (its id), not recreated on
  // every render — otherwise a fresh `{latitude, longitude}` literal each
  // time re-triggers useReverseLocation's effect (it depends on this object's
  // identity), spamming the geocoding API for as long as the alert is shown.
  const point = useMemo(
    () => (notification ? { latitude: notification.latitude, longitude: notification.longitude } : null),
    [notification],
  );
  const reverseLocation = useReverseLocation(point);
  if (!notification) return null;
  const placeLabel = reverseLocation.status === 'success'
    ? (reverseLocation.data.place || reverseLocation.data.label)
    : `${notification.latitude.toFixed(4)}, ${notification.longitude.toFixed(4)}`;
  return (
    <div className="camera-fire-alert" role="alert">
      <div className="camera-fire-alert__icon"><Flame size={26} /></div>
      <div className="camera-fire-alert__body">
        <strong>Fuego detectado por cámara en {placeLabel}</strong>
        <span>{notification.latitude.toFixed(4)}, {notification.longitude.toFixed(4)} · confianza {(notification.confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="camera-fire-alert__actions">
        <button
          type="button"
          className="camera-fire-alert__view"
          onClick={() => onViewOnMap(notification.id)}
        >
          <MapPinned size={14} /> Ver en el mapa
        </button>
      </div>
      <button type="button" className="camera-fire-alert__close" aria-label="Cerrar aviso" onClick={onDismiss}><X size={16} /></button>
    </div>
  );
}
