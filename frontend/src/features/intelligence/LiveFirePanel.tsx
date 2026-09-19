import { Gauge, MapPin, Satellite, Thermometer, X } from 'lucide-react';

import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import { FIRE_RENDER_LIMIT } from '../map/sampleFires';
import type { FirmsSource } from '../../types/api';

const sourceLabels: Record<FirmsSource, string> = {
  VIIRS_NOAA20_NRT: 'NOAA-20',
  VIIRS_NOAA21_NRT: 'NOAA-21',
};

const utcDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC',
}).format(new Date(value));

export function LiveFirePanel({ liveFires, fireSpread }: { liveFires: LiveFires; fireSpread: FireSpread }) {
  const { hour } = fireSpread;
  const { filters, state, selectedFireId } = liveFires;
  const selected = state.data?.detections.find((fire) => fire.id === selectedFireId);
  const toggleSource = (source: FirmsSource) => {
    const hasSource = filters.sources.includes(source);
    if (hasSource && filters.sources.length === 1) return;
    liveFires.updateFilters({
      sources: hasSource ? filters.sources.filter((item) => item !== source) : [...filters.sources, source],
    });
  };

  return (
    <section className="panel-section live-fire-panel">
      <div className="section-heading">
        <span className="eyebrow">NASA FIRMS · VIIRS</span>
        <span className={`live-dot ${state.status === 'error' ? 'is-error' : ''}`}>
          {state.status === 'loading' ? 'Actualizando' : 'En vivo'}
        </span>
      </div>
      <div className="fire-filters">
        <select aria-label="Ventana temporal FIRMS" value={filters.hours} onChange={(event) => liveFires.updateFilters({ hours: Number(event.target.value) as 24 | 48 | 72 })}>
          <option value={24}>Últimas 24 h</option><option value={48}>Últimas 48 h</option><option value={72}>Últimas 72 h</option>
        </select>
        <select aria-label="Confianza mínima" value={filters.minConfidence} onChange={(event) => liveFires.updateFilters({ minConfidence: event.target.value as typeof filters.minConfidence })}>
          <option value="low">Toda confianza</option><option value="nominal">Nominal+</option><option value="high">Alta</option>
        </select>
      </div>
      <div className="source-toggles">
        {(Object.keys(sourceLabels) as FirmsSource[]).map((source) => <label key={source}><input type="checkbox" checked={filters.sources.includes(source)} onChange={() => toggleSource(source)} /> {sourceLabels[source]}</label>)}
      </div>
      {liveFires.viewport && liveFires.viewport.zoom < 5
        ? <p className="data-hint">Acerca el mapa para consultar cada detección.</p>
        : <p className="data-hint">{state.data
          ? state.data.meta.count === 0
            ? 'Sin detecciones en esta vista.'
            : `${state.data.meta.count.toLocaleString('es-ES')} detecciones en esta vista`
          : 'Esperando área visible…'}</p>}
      {state.data && <p className="data-hint">
        {state.data.meta.stale ? 'Datos en caché · NASA no disponible. ' : ''}
        {state.data.meta.latest_acquisition ? `Última adquisición ${utcDate(state.data.meta.latest_acquisition)} UTC · ` : ''}
        Sincronizado {utcDate(state.data.meta.fetched_at)} UTC
        {state.data.meta.count > FIRE_RENDER_LIMIT ? ` · Mapa limitado a una muestra representativa de ${FIRE_RENDER_LIMIT.toLocaleString('es-ES')} observaciones` : ''}
      </p>}
      {state.status === 'error' && <p className="data-error" role="alert">{state.error}</p>}
      {selected && <div className="selected-fire-drawer" role="region" aria-label="Detalle del fuego seleccionado">
        <div className="selected-fire-drawer__head">
          <div>
            <span className="eyebrow">Incendio seleccionado</span>
            <strong>{sourceLabels[selected.source]} · {selected.confidence}</strong>
          </div>
          <button type="button" aria-label="Cerrar detalle del fuego" onClick={() => liveFires.setSelectedFireId(null)}><X size={15} /></button>
        </div>
        <dl className="selected-fire-grid">
          <div><dt><MapPin size={13} />Ubicación</dt><dd>{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</dd></div>
          <div><dt><Gauge size={13} />Potencia</dt><dd>FRP {selected.frp?.toFixed(1) ?? '—'} MW</dd></div>
          <div><dt><Thermometer size={13} />Brillo</dt><dd>{selected.brightness.toFixed(1)} K</dd></div>
          <div><dt><Satellite size={13} />Sensor</dt><dd>{selected.satellite} · {selected.instrument}</dd></div>
        </dl>
        <div className="selected-fire-meta">
          <span>{utcDate(selected.acquired_at)} UTC</span>
          <span>{selected.daynight === 'day' ? 'Día' : 'Noche'}</span>
          {selected.scan && selected.track && <span>Scan {selected.scan.toFixed(2)} · Track {selected.track.toFixed(2)}</span>}
        </div>
        <small>Anomalía térmica satelital; no confirma por sí sola un incendio.</small>
        {fireSpread.status === 'loading' && <span className="data-hint">Calculando radio de propagación…</span>}
        {fireSpread.status === 'error' && <span className="data-error" role="alert">{fireSpread.error}</span>}
        {fireSpread.data && (() => {
          const snapshot = fireSpread.data.snapshots[Math.min(hour, fireSpread.data.max_hours)];
          return (
            <div className="fire-detail">
              <strong>Radio estimado {hour === 0 ? 'ahora' : `a +${hour} h`}</strong>
              <span>Mín {snapshot.radius_km_min.toFixed(2)} km · Medio {snapshot.radius_km_mean.toFixed(2)} km · Máx {snapshot.radius_km_max.toFixed(2)} km</span>
              <span>Área aproximada: {snapshot.area_km2.toFixed(2)} km²</span>
              <strong>Intensidad del frente (Byram)</strong>
              <span>
                {snapshot.intensity_kw_m_max > 0
                  ? `Mín ${snapshot.intensity_kw_m_min.toFixed(0)} · Medio ${snapshot.intensity_kw_m_mean.toFixed(0)} · Máx ${snapshot.intensity_kw_m_max.toFixed(0)} kW/m`
                  : 'Sin frente activo todavía'}
              </span>
              <small>{fireSpread.data.warning}</small>
            </div>
          );
        })()}
      </div>}
    </section>
  );
}
