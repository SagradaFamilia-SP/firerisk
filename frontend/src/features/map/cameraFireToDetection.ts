import type { CameraFireDetection, FireDetection } from '../../types/api';

export function cameraDetectionId(id: number): string {
  return `camera-${id}`;
}

export function isCameraDetectionId(id: string): boolean {
  return id.startsWith('camera-');
}

export function cameraFireToDetection(fire: CameraFireDetection): FireDetection {
  const hour = new Date(fire.detected_at).getUTCHours();
  return {
    id: cameraDetectionId(fire.id),
    latitude: fire.latitude,
    longitude: fire.longitude,
    acquired_at: fire.detected_at,
    satellite: 'Cámara IGNIS',
    instrument: 'YOLO + Vonage',
    source: 'CAMERA',
    confidence: fire.confidence >= 0.8 ? 'high' : fire.confidence >= 0.5 ? 'nominal' : 'low',
    brightness: 330,
    brightness_ti5: null,
    frp: Math.round(fire.confidence * 25 * 10) / 10,
    scan: null,
    track: null,
    daynight: hour >= 6 && hour < 20 ? 'day' : 'night',
  };
}
