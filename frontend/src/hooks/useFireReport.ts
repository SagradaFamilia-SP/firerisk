import { jsPDF } from 'jspdf';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AsyncState } from './useDashboard';
import type { FireSpread } from './useFireSpread';
import type { FireDetection, ReverseLocationResponse } from '../types/api';

export type ReportStatus = 'idle' | 'collecting' | 'generating' | 'ready' | 'error';

const CONFIDENCE_LABELS: Record<FireDetection['confidence'], string> = {
  low: 'Baja', nominal: 'Nominal', high: 'Alta',
};

const utcDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long', timeStyle: 'medium', timeZone: 'UTC',
}).format(new Date(value));

function buildReportPdf(
  fire: FireDetection,
  reverseLocation: AsyncState<ReverseLocationResponse>,
  fireSpread: FireSpread,
): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageRight = 547;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(224, 78, 34);
  doc.text('IGNIS · Informe operativo de incendio', marginX, y);
  y += 20;
  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, pageRight, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generado ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date())}`,
    marginX,
    y,
  );
  y += 26;

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(224, 78, 34);
    doc.text(title, marginX, y);
    y += 17;
  };

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(value, marginX + 140, y);
    y += 16;
  };

  section('Identificación');
  row('ID de detección', fire.id);
  row('Coordenadas', `${fire.latitude.toFixed(5)}, ${fire.longitude.toFixed(5)}`);
  if (reverseLocation.status === 'success') {
    row('Ubicación', reverseLocation.data.label);
    if (reverseLocation.data.country) row('País', reverseLocation.data.country);
  }
  row('Fecha/hora (UTC)', utcDate(fire.acquired_at));
  row('Momento del día', fire.daynight === 'day' ? 'Día' : 'Noche');
  y += 8;

  section('Telemetría satelital');
  row('Satélite / instrumento', `${fire.satellite} · ${fire.instrument}`);
  row('Confianza', CONFIDENCE_LABELS[fire.confidence]);
  row('Potencia radiativa (FRP)', fire.frp !== null ? `${fire.frp.toFixed(1)} MW` : 'No disponible');
  row('Brillo (canal 4)', `${fire.brightness.toFixed(1)} K`);
  if (fire.brightness_ti5 !== null) row('Brillo (canal 5)', `${fire.brightness_ti5.toFixed(1)} K`);
  if (fire.scan !== null && fire.track !== null) {
    row('Resolución scan/track', `${fire.scan.toFixed(2)} / ${fire.track.toFixed(2)} km`);
  }
  y += 8;

  section('Simulación de propagación');
  if (fireSpread.data) {
    const snapshot = fireSpread.data.snapshots[Math.min(fireSpread.hour, fireSpread.data.max_hours)];
    row('Terreno / combustible', `${fireSpread.data.terrain_source} · ${fireSpread.data.fuel_source}`);
    row(
      `Radio estimado (+${fireSpread.hour} h)`,
      `mín ${snapshot.radius_km_min.toFixed(2)} · medio ${snapshot.radius_km_mean.toFixed(2)} · máx ${snapshot.radius_km_max.toFixed(2)} km`,
    );
    row('Área aproximada', `${snapshot.area_km2.toFixed(2)} km²`);
    row(
      'Intensidad del frente (Byram)',
      snapshot.intensity_kw_m_max > 0
        ? `mín ${snapshot.intensity_kw_m_min.toFixed(0)} · medio ${snapshot.intensity_kw_m_mean.toFixed(0)} · máx ${snapshot.intensity_kw_m_max.toFixed(0)} kW/m`
        : 'Sin frente activo todavía',
    );
    const weather = fireSpread.data.weather[0];
    if (weather) {
      row('Viento', `${weather.wind_kmh.toFixed(1)} km/h desde ${weather.wind_from_deg.toFixed(0)}°`);
      row('Temperatura / HR', `${weather.temperature_c.toFixed(1)} °C · ${weather.rh_pct.toFixed(0)} %`);
    }
    y += 6;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    const wrapped = doc.splitTextToSize(fireSpread.data.warning, pageRight - marginX) as string[];
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 12;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text('Simulación no disponible para esta detección.', marginX, y);
    y += 16;
  }

  y += 16;
  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, pageRight, y);
  y += 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.text('IGNIS es una demo de apoyo visual para una hackathon. Los datos de FIRMS son anomalías térmicas', marginX, y);
  y += 11;
  doc.text('satelitales; la propagación mostrada es una simulación y no sustituye información oficial ni protocolos', marginX, y);
  y += 11;
  doc.text('de emergencias.', marginX, y);

  return doc.output('blob');
}

function triggerDownload(blob: Blob, fire: FireDetection) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ignis-informe-${fire.id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/**
 * Starts building a PDF report the moment a fire is selected — before the
 * user ever asks for it — so it's usually already sitting in memory by the
 * time they click "Descargar informe". If they click while it's still
 * collecting telemetry/location or rendering the PDF, `pendingDownload`
 * flips on so the UI can show a loading modal; the effect below fires the
 * actual download the instant the blob becomes ready.
 */
export function useFireReport(
  fire: FireDetection | null,
  reverseLocation: AsyncState<ReverseLocationResponse>,
  fireSpread: FireSpread,
) {
  const [status, setStatus] = useState<ReportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [pendingDownload, setPendingDownload] = useState(false);
  const fireRef = useRef(fire);
  fireRef.current = fire;

  // A newly selected fire (or none) starts from a clean slate. This must NOT
  // also fire when fireSpread/reverseLocation merely settle for the SAME
  // fire — otherwise it would wipe out a `pendingDownload` the user just
  // requested right before the data finished loading.
  useEffect(() => {
    setBlob(null);
    setPendingDownload(false);
    setError(null);
    setStatus(fire ? 'collecting' : 'idle');
    // Only the identity change matters here (see comment above); depending
    // on `fire` itself would also re-run this reset whenever the parent
    // re-fetches and returns a new object for the same detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire?.id]);

  useEffect(() => {
    if (!fire) return;
    if (fireSpread.status === 'loading' || reverseLocation.status === 'loading') {
      setStatus('collecting');
      return;
    }
    setStatus('generating');
    // Deferred so React can paint the "generating" state before the
    // (synchronous, CPU-bound) PDF build runs on the main thread.
    const timer = window.setTimeout(() => {
      const currentFire = fireRef.current;
      if (!currentFire) return;
      try {
        setBlob(buildReportPdf(currentFire, reverseLocation, fireSpread));
        setStatus('ready');
      } catch {
        setStatus('error');
        setError('No se pudo generar el informe.');
      }
    }, 30);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire?.id, fireSpread.status, fireSpread.hour, reverseLocation.status]);

  useEffect(() => {
    if (status === 'ready' && pendingDownload && blob && fireRef.current) {
      triggerDownload(blob, fireRef.current);
      setPendingDownload(false);
    }
  }, [status, pendingDownload, blob]);

  const download = useCallback(() => {
    if (!fireRef.current) return;
    if (status === 'ready' && blob) {
      triggerDownload(blob, fireRef.current);
      return;
    }
    setPendingDownload(true);
  }, [status, blob]);

  const dismiss = useCallback(() => setPendingDownload(false), []);

  return { status, error, pendingDownload, download, dismiss };
}

export type FireReport = ReturnType<typeof useFireReport>;
