import { Camera, Check, MapPinned, Pencil, RotateCw, Video, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { CameraFires } from '../../hooks/useCameraFires';
import { apiUrl } from '../../services/api';

type CameraStatus = 'idle' | 'locating' | 'streaming';
type LocationSource = 'gps' | 'fallback' | 'manual';

// Used only when the browser's geolocation fails outright (see
// GEOLOCATION_ERROR_REASONS below) — the camera's real-world location, so the
// fallback still points at wherever this computer's camera actually is
// instead of the app's unrelated default map center (`SITE` in `map/geo.ts`).
const CAMERA_FALLBACK_LOCATION: { lat: number; lon: number } = { lat: 41.36915, lon: 2.18889 };

const GEOLOCATION_TIMEOUT_MS = 15_000;
// A recent cached OS-level fix (up to 5 min old) is still useful and lets the
// browser skip a slow fresh GPS/Wi-Fi lookup that often blows the timeout.
const GEOLOCATION_MAX_AGE_MS = 5 * 60_000;

const GEOLOCATION_ERROR_REASONS: Record<number, string> = {
  1: 'Permiso de ubicación denegado por el navegador',
  // A permission-denied error on a device where the browser's own site
  // permission is already "Allow" almost always means the OS-level location
  // toggle for that browser is off, not the site permission — that's the
  // single most common cause of "ya di permiso pero no funciona".
  2: 'Ubicación no disponible: revisa que los Servicios de Ubicación del sistema estén activados para este navegador',
  3: 'Tiempo de espera agotado obteniendo la ubicación',
};

export function CamerasWorkspace({ cameraFires, onViewOnMap }: { cameraFires: CameraFires; onViewOnMap: (id: number) => void }) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  const applyFallbackLocation = useCallback((reason: string) => {
    setCoordinates(CAMERA_FALLBACK_LOCATION);
    setLocationSource('fallback');
    setLocationError(reason);
    setStatus('streaming');
  }, []);

  const resolveLocation = useCallback(() => {
    setLocationError(null);
    if (!navigator.geolocation) {
      applyFallbackLocation('Este navegador no soporta geolocalización');
      return;
    }
    const onSuccess = (position: GeolocationPosition) => {
      setCoordinates({ lat: position.coords.latitude, lon: position.coords.longitude });
      setLocationSource('gps');
      setLocationError(null);
      setStatus('streaming');
    };
    const describeError = (error: GeolocationPositionError) => {
      const reason = GEOLOCATION_ERROR_REASONS[error.code] || 'No se pudo obtener la ubicación';
      // The browser's own `message` is non-standard but, on Chrome/Safari,
      // often names the exact underlying failure (e.g. a CoreLocation error
      // on macOS) — worth surfacing verbatim since our own code-based guess
      // can be wrong even when permissions are genuinely fine.
      return error.message ? `${reason} — detalle del navegador: ${error.message}` : reason;
    };
    // High accuracy (GPS/Wi-Fi fusion) fails outright on some laptops/browser
    // combos that only support the coarser network-based lookup — retrying
    // once with it turned off recovers those cases instead of going straight
    // to the hardcoded fallback location.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => navigator.geolocation.getCurrentPosition(
        onSuccess,
        (error) => applyFallbackLocation(describeError(error)),
        { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: GEOLOCATION_MAX_AGE_MS },
      ),
      { enableHighAccuracy: true, timeout: 6_000, maximumAge: GEOLOCATION_MAX_AGE_MS },
    );
  }, [applyFallbackLocation]);

  const addCamera = useCallback(() => {
    setStatus('locating');
    resolveLocation();
  }, [resolveLocation]);

  const stopCamera = useCallback(() => {
    setStatus('idle');
    setCoordinates(null);
    setLocationSource(null);
    setLocationError(null);
    setEditingLocation(false);
  }, []);

  const startEditingLocation = useCallback(() => {
    setManualLat(coordinates ? String(coordinates.lat) : '');
    setManualLon(coordinates ? String(coordinates.lon) : '');
    setEditingLocation(true);
  }, [coordinates]);

  const applyManualLocation = useCallback(() => {
    const lat = Number.parseFloat(manualLat);
    const lon = Number.parseFloat(manualLon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) return;
    setCoordinates({ lat, lon });
    setLocationSource('manual');
    setLocationError(null);
    setEditingLocation(false);
  }, [manualLat, manualLon]);

  return (
    <div className="cameras-workspace">
      <header className="cameras-workspace__head">
        <span className="eyebrow">Cámaras</span>
        <h1>Detección de fuego en tiempo real</h1>
        <p>Publica la cámara de este ordenador a través de Vonage y corre YOLO sobre el vídeo recibido para detectar fuego o humo en directo.</p>
      </header>

      {status !== 'streaming' && (
        <div className="camera-card camera-card--empty">
          <div className="camera-card__icon"><Camera size={24} /></div>
          <div className="camera-card__copy">
            <strong>{status === 'locating' ? 'Ubicando cámara…' : 'Sin cámaras activas'}</strong>
            <p>Conecta la cámara de este ordenador para iniciar la detección de fuego en tiempo real.</p>
          </div>
          <button type="button" className="camera-add-button" disabled={status === 'locating'} onClick={addCamera}>
            <Video size={14} /> Agregar cámara
          </button>
        </div>
      )}

      {status === 'streaming' && coordinates && (
        <div className="camera-card">
          <div className="camera-card__head">
            <div>
              <span>Vonage connected streaming</span>
              <strong>Cámara del ordenador</strong>
            </div>
            <div className="camera-card__meta">
              <small>
                {locationSource === 'gps' && 'Ubicación GPS del navegador'}
                {locationSource === 'manual' && 'Ubicación introducida manualmente'}
                {locationSource === 'fallback' && `Ubicación aproximada (${locationError ?? 'sin geolocalización'})`}
              </small>
              <small>{coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)}</small>
            </div>
            {locationSource === 'fallback' && (
              <button type="button" className="camera-retry-location-btn" onClick={resolveLocation} title="Reintentar ubicación">
                <RotateCw size={14} /> Reintentar
              </button>
            )}
            <button type="button" className="camera-retry-location-btn" onClick={startEditingLocation} title="Introducir coordenadas manualmente">
              <Pencil size={14} /> Editar
            </button>
            <button type="button" aria-label="Detener cámara" onClick={stopCamera}><X size={16} /></button>
          </div>
          {editingLocation && (
            <div className="camera-manual-location">
              <label>
                Latitud
                <input type="number" step="any" value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="41.3874" />
              </label>
              <label>
                Longitud
                <input type="number" step="any" value={manualLon} onChange={(event) => setManualLon(event.target.value)} placeholder="2.1686" />
              </label>
              <button type="button" className="camera-manual-location__apply" onClick={applyManualLocation}><Check size={14} /> Aplicar</button>
              <button type="button" className="camera-manual-location__cancel" onClick={() => setEditingLocation(false)}>Cancelar</button>
            </div>
          )}
          <iframe
            key={`${coordinates.lat}-${coordinates.lon}`}
            title="Vonage YOLO real time camera"
            src={apiUrl(`/video/camera-live?lat=${coordinates.lat}&lon=${coordinates.lon}`)}
            allow="autoplay; camera"
          />
        </div>
      )}

      <section className="camera-detections">
        <div className="section-heading"><span className="eyebrow">Detecciones recientes</span><span>{cameraFires.fires.length}</span></div>
        {cameraFires.fires.length === 0
          ? <p className="data-hint">Sin fuegos detectados por cámara todavía.</p>
          : (
            <ul className="camera-detections__list">
              {cameraFires.fires.map((fire) => (
                <li key={fire.id}>
                  <div>
                    <strong>{fire.label}</strong>
                    <span>{fire.latitude.toFixed(4)}, {fire.longitude.toFixed(4)} · confianza {(fire.confidence * 100).toFixed(0)}%</span>
                    <small>{new Date(fire.detected_at).toLocaleString('es-ES')}</small>
                  </div>
                  <button type="button" className="camera-detection-view-btn" onClick={() => onViewOnMap(fire.id)}>
                    <MapPinned size={13} /> Ver en mapa
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
