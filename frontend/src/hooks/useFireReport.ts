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

const INK: [number, number, number] = [31, 21, 18];
const ORANGE_BRIGHT: [number, number, number] = [224, 78, 34];
const MUTED: [number, number, number] = [130, 130, 130];
const TEXT: [number, number, number] = [40, 40, 40];
const HAIRLINE: [number, number, number] = [225, 225, 225];

function drawMark(doc: jsPDF, cx: number, cy: number, r: number) {
  doc.setDrawColor(...ORANGE_BRIGHT);
  doc.setLineWidth(r * 0.16);
  doc.circle(cx, cy + r * 0.06, r * 0.72, 'S');
  doc.setFillColor(...ORANGE_BRIGHT);
  doc.circle(cx, cy + r * 0.06, r * 0.28, 'F');
}

function drawHeaderBand(doc: jsPDF, pageWidth: number, title: string, subtitle: string) {
  const height = 70;
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, height, 'F');
  drawMark(doc, 40, height / 2, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('PYROS', 59, height / 2 - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);
  doc.text('WILDFIRE INTELLIGENCE', 59, height / 2 + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth - 40, height / 2 - 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 190, 190);
  doc.text(subtitle, pageWidth - 40, height / 2 + 12, { align: 'right' });
}

function drawFooterCaption(doc: jsPDF, pageWidth: number, pageHeight: number, text: string) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(text, pageWidth / 2, pageHeight - 24, { align: 'center' });
}

function buildReportPdf(
  fire: FireDetection,
  reverseLocation: AsyncState<ReverseLocationResponse>,
  fireSpread: FireSpread,
): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const contentWidth = pageWidth - marginX * 2;
  const colGap = 28;
  const colWidth = (contentWidth - colGap) / 2;
  const rightColX = marginX + colWidth + colGap;
  const generatedAt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date());

  drawHeaderBand(doc, pageWidth, 'Informe operativo de incendio', `Generado ${generatedAt}`);

  let y = 70 + 44;

  // Plain label/value pair, no border box — just a hairline under the value.
  const field = (label: string, value: string, x: number, width: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT);
    const wrapped = doc.splitTextToSize(value, width) as string[];
    doc.text(wrapped[0] ?? '—', x, y + 15);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.5);
    doc.line(x, y + 22, x + width, y + 22);
    y += 22 + 16;
  };

  // A large stat callout for the one number that matters most on the page —
  // no fill, just scale and color, so it reads as emphasis rather than a UI chip.
  const stat = (label: string, value: string, unit: string, x: number, width: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...ORANGE_BRIGHT);
    doc.text(value, x, y + 24);
    const valueWidth = doc.getTextWidth(value);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(unit, x + valueWidth + 5, y + 24);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.5);
    doc.line(x, y + 32, x + width, y + 32);
    y += 32 + 16;
  };

  const sectionHeader = (title: string, x: number) => {
    doc.setFillColor(...ORANGE_BRIGHT);
    doc.rect(x, y - 9, 16, 2.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(title.toUpperCase(), x + 23, y);
    y += 22;
  };

  const paragraph = (text: string, x: number, width: number, size = 9.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...TEXT);
    const wrapped = doc.splitTextToSize(text, width) as string[];
    doc.text(wrapped, x, y);
    y += wrapped.length * (size + 3) + 6;
  };

  // Ubicación / coordenadas span the full width.
  field('Ubicación', reverseLocation.status === 'success' ? reverseLocation.data.label : 'Ubicación no disponible', marginX, contentWidth);
  field('Coordenadas', `${fire.latitude.toFixed(5)}, ${fire.longitude.toFixed(5)}`, marginX, contentWidth);
  y += 4;

  // Executive summary — the interpretive value-add a raw data dump doesn't give.
  const frpLevel = fire.frp === null ? null : fire.frp >= 50 ? 'muy alta' : fire.frp >= 15 ? 'alta' : fire.frp >= 5 ? 'moderada' : 'baja';
  const confidenceText = CONFIDENCE_LABELS[fire.confidence].toLowerCase();
  const summary = fire.frp !== null
    ? `Detección de confianza ${confidenceText} con una potencia radiativa (FRP) de ${fire.frp.toFixed(1)} MW, ` +
      `una intensidad térmica ${frpLevel} para un foco de incendio. ` +
      `${fireSpread.data ? `La simulación de propagación estima un frente activo con un área aproximada de ${fireSpread.data.snapshots[Math.min(fireSpread.hour, fireSpread.data.max_hours)].area_km2.toFixed(2)} km² a +${fireSpread.hour} h desde la detección.` : 'La simulación de propagación no está disponible para esta detección.'}`
    : `Detección de confianza ${confidenceText}. No se ha reportado potencia radiativa (FRP) para este foco, ` +
      'por lo que su intensidad térmica no puede caracterizarse a partir de este parámetro.';
  sectionHeader('Resumen ejecutivo', marginX);
  paragraph(summary, marginX, contentWidth);
  y += 4;

  const afterLocationY = y;
  let leftY = afterLocationY;
  let rightY = afterLocationY;

  y = leftY;
  sectionHeader('Identificación', marginX);
  leftY = y;
  y = rightY;
  sectionHeader('Telemetría satelital', rightColX);
  rightY = y;

  y = leftY;
  field('ID de detección', fire.id, marginX, colWidth);
  leftY = y;
  y = rightY;
  field('Satélite / instrumento', `${fire.satellite} · ${fire.instrument}`, rightColX, colWidth);
  rightY = y;

  y = leftY;
  field('País', reverseLocation.status === 'success' && reverseLocation.data.country ? reverseLocation.data.country : 'No disponible', marginX, colWidth);
  leftY = y;
  y = rightY;
  field('Confianza', CONFIDENCE_LABELS[fire.confidence], rightColX, colWidth);
  rightY = y;

  y = leftY;
  field('Fecha/hora (UTC)', utcDate(fire.acquired_at), marginX, colWidth);
  leftY = y;
  y = rightY;
  if (fire.frp !== null) {
    stat('Potencia radiativa (FRP)', fire.frp.toFixed(1), 'MW', rightColX, colWidth);
  } else {
    field('Potencia radiativa (FRP)', 'No disponible', rightColX, colWidth);
  }
  rightY = y;

  y = leftY;
  field('Momento del día', fire.daynight === 'day' ? 'Día' : 'Noche', marginX, colWidth);
  leftY = y;
  y = rightY;
  if (fire.scan !== null && fire.track !== null) {
    field('Resolución scan / track', `${fire.scan.toFixed(2)} / ${fire.track.toFixed(2)} km`, rightColX, colWidth);
    rightY = y;
  }
  y = rightY;
  field('Brillo · canal 4', `${fire.brightness.toFixed(1)} K`, rightColX, colWidth);
  rightY = y;
  if (fire.brightness_ti5 !== null) {
    field('Brillo · canal 5', `${fire.brightness_ti5.toFixed(1)} K`, rightColX, colWidth);
    rightY = y;
  }

  drawFooterCaption(doc, pageWidth, pageHeight, 'PYROS · Informe operativo de incendio — página 1 / 2');

  // Page 2 — propagation simulation.
  doc.addPage();
  drawHeaderBand(doc, pageWidth, 'Simulación de propagación', `Rothermel 1972 · +${fireSpread.hour} h`);
  y = 70 + 44;

  if (fireSpread.data) {
    const snapshot = fireSpread.data.snapshots[Math.min(fireSpread.hour, fireSpread.data.max_hours)];

    const spreadTrend = snapshot.radius_km_max > 0
      ? `A +${fireSpread.hour} h, el modelo proyecta un frente de hasta ${snapshot.radius_km_max.toFixed(2)} km de radio y ` +
        `${snapshot.area_km2.toFixed(2)} km² de superficie afectada, con vientos de ${fireSpread.data.weather[0]?.wind_kmh.toFixed(1) ?? 'N/D'} km/h ` +
        `favoreciendo la propagación hacia sotavento. La intensidad del frente (Byram) alcanza un máximo de ` +
        `${snapshot.intensity_kw_m_max.toFixed(0)} kW/m, ${snapshot.intensity_kw_m_max >= 2000 ? 'un nivel que supera la capacidad de ataque directo con medios manuales' : 'compatible con ataque directo en condiciones favorables'}.`
      : 'El modelo aún no proyecta un frente de propagación activo para el horizonte temporal seleccionado.';

    sectionHeader('Evaluación de la simulación', marginX);
    paragraph(spreadTrend, marginX, contentWidth);
    y += 4;

    leftY = y;
    rightY = y;

    y = leftY;
    sectionHeader('Parámetros del terreno', marginX);
    leftY = y;
    y = rightY;
    sectionHeader('Resultados del modelo', rightColX);
    rightY = y;

    y = leftY;
    field('Terreno / combustible', `${fireSpread.data.terrain_source} · ${fireSpread.data.fuel_source}`, marginX, colWidth);
    leftY = y;

    const weather = fireSpread.data.weather[0];
    if (weather) {
      field('Viento', `${weather.wind_kmh.toFixed(1)} km/h desde ${weather.wind_from_deg.toFixed(0)}°`, marginX, colWidth);
      leftY = y;
      field('Temperatura / humedad relativa', `${weather.temperature_c.toFixed(1)} °C · ${weather.rh_pct.toFixed(0)} %`, marginX, colWidth);
      leftY = y;
    }

    y = rightY;
    stat('Área aproximada', snapshot.area_km2.toFixed(2), 'km²', rightColX, colWidth);
    rightY = y;
    field(
      `Radio estimado (+${fireSpread.hour} h) · mín / medio / máx`,
      `${snapshot.radius_km_min.toFixed(2)} / ${snapshot.radius_km_mean.toFixed(2)} / ${snapshot.radius_km_max.toFixed(2)} km`,
      rightColX, colWidth,
    );
    rightY = y;
    field(
      'Intensidad del frente (Byram)',
      snapshot.intensity_kw_m_max > 0
        ? `${snapshot.intensity_kw_m_min.toFixed(0)} / ${snapshot.intensity_kw_m_mean.toFixed(0)} / ${snapshot.intensity_kw_m_max.toFixed(0)} kW/m`
        : 'Sin frente activo todavía',
      rightColX, colWidth,
    );
    rightY = y;

    y = Math.max(leftY, rightY) + 4;
  } else {
    sectionHeader('Simulación de propagación', marginX);
    paragraph('Simulación no disponible para esta detección.', marginX, contentWidth);
  }

  sectionHeader('Metodología y limitaciones', marginX);
  paragraph(
    'Simulación experimental de propagación superficial (Rothermel 1972) sobre combustibles derivados de ESA ' +
    'WorldCover, propagada en rejilla real. No modela fuego de copa, pavesas, cortafuegos ni supresión activa.',
    marginX, contentWidth, 9,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ORANGE_BRIGHT);
  doc.text('No usar para decisiones de emergencia, evacuación o seguridad de vidas.', marginX, y);
  y += 18;
  paragraph(
    'PYROS es una demo de apoyo visual desarrollada en un hackathon. Los datos de FIRMS son anomalías térmicas ' +
    'satelitales; la propagación mostrada es una simulación y no sustituye información oficial ni protocolos de emergencias.',
    marginX, contentWidth, 8.5,
  );

  drawFooterCaption(doc, pageWidth, pageHeight, 'PYROS · Informe operativo de incendio — página 2 / 2');

  return doc.output('blob');
}

function triggerDownload(blob: Blob, fire: FireDetection) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pyros-informe-${fire.id}.pdf`;
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
  const fireSpreadRef = useRef(fireSpread);
  fireSpreadRef.current = fireSpread;
  const reverseLocationRef = useRef(reverseLocation);
  reverseLocationRef.current = reverseLocation;

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
        setBlob(buildReportPdf(currentFire, reverseLocationRef.current, fireSpreadRef.current));
        setStatus('ready');
      } catch {
        setStatus('error');
        setError('No se pudo generar el informe.');
      }
    }, 30);
    return () => window.clearTimeout(timer);
    // Deliberately NOT depending on `fireSpread.hour`: this eager pre-build
    // only needs to run once, when the simulation/location data first finish
    // loading for this fire. Depending on `hour` too used to rebuild the PDF
    // on every timeline tick during playback, making the download button
    // flicker between "generating" and "ready" several times a second.
    // `download()` below always rebuilds fresh from the *current* hour at
    // click time, so the downloaded report still matches whatever the user
    // was actually looking at, without any background flicker while it plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire?.id, fireSpread.status, reverseLocation.status]);

  useEffect(() => {
    if (status === 'ready' && pendingDownload && blob && fireRef.current) {
      triggerDownload(blob, fireRef.current);
      setPendingDownload(false);
    }
  }, [status, pendingDownload, blob]);

  const download = useCallback(() => {
    const currentFire = fireRef.current;
    if (!currentFire) return;
    if (fireSpreadRef.current.status === 'loading' || reverseLocationRef.current.status === 'loading') {
      setPendingDownload(true);
      return;
    }
    try {
      const freshBlob = buildReportPdf(currentFire, reverseLocationRef.current, fireSpreadRef.current);
      setBlob(freshBlob);
      setStatus('ready');
      triggerDownload(freshBlob, currentFire);
    } catch {
      setStatus('error');
      setError('No se pudo generar el informe.');
    }
  }, []);

  const dismiss = useCallback(() => setPendingDownload(false), []);

  return { status, error, pendingDownload, download, dismiss };
}

export type FireReport = ReturnType<typeof useFireReport>;
