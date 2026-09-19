import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFireLocations } from '../../hooks/useFireLocations';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { FireConfidence, FireDetection, FirmsSource } from '../../types/api';
import { INTENSITY_LABELS, intensityBucket } from './intensity';

const sourceLabels: Record<FirmsSource, string> = {
  VIIRS_NOAA20_NRT: 'NOAA-20',
  VIIRS_NOAA21_NRT: 'NOAA-21',
};

const confidenceLabels: Record<FireConfidence, string> = { low: 'Baja', nominal: 'Nominal', high: 'Alta' };
const confidenceRank: Record<FireConfidence, number> = { low: 0, nominal: 1, high: 2 };

const utcDateTime = (value: string) => new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
}).format(new Date(value));

type SortKey = 'date' | 'city' | 'country' | 'confidence' | 'frp' | 'brightness';
type SortDir = 'asc' | 'desc';
type DayNightFilter = 'all' | 'day' | 'night';

const PAGE_SIZE_OPTIONS = [30, 50, 100] as const;

/** Parses a filter's numeric input; blank/invalid text means "no bound". */
function parseBound(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function FireTable({ liveFires, onSelectFire }: { liveFires: LiveFires; onSelectFire: (id: string) => void }) {
  const { state, filters, updateFilters, selectedFireId } = liveFires;
  const { labels, resolve } = useFireLocations();

  const [locationQuery, setLocationQuery] = useState('');
  const [dayNightFilter, setDayNightFilter] = useState<DayNightFilter>('all');
  const [frpMin, setFrpMin] = useState('');
  const [frpMax, setFrpMax] = useState('');
  const [brightnessMin, setBrightnessMin] = useState('');
  const [brightnessMax, setBrightnessMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(30);

  const cityOf = useCallback((id: string) => {
    const entry = labels[id];
    return entry?.status === 'success' ? (entry.data.place || entry.data.label) : null;
  }, [labels]);

  const countryOf = useCallback((id: string) => {
    const entry = labels[id];
    return entry?.status === 'success' ? entry.data.country : null;
  }, [labels]);

  // Split into two passes so a city/country label resolving in the background
  // (which happens every ~150ms while any page has unresolved rows,
  // indefinitely as you page through a large result set) doesn't force a full
  // filter+sort of every detection in the current map viewport — tens of
  // thousands of rows on a wide/global view. Only the passes that actually
  // read a label depend on `cityOf`/`countryOf`, so most resolutions are a
  // no-op for this component.
  const frpMinBound = parseBound(frpMin);
  const frpMaxBound = parseBound(frpMax);
  const brightnessMinBound = parseBound(brightnessMin);
  const brightnessMaxBound = parseBound(brightnessMax);
  const fromBound = dateFrom ? new Date(dateFrom).getTime() : null;
  const toBound = dateTo ? new Date(dateTo).getTime() : null;

  const baseFiltered = useMemo(() => {
    const detections = state.data?.detections ?? [];
    return detections.filter((fire) => {
      if (dayNightFilter !== 'all' && fire.daynight !== dayNightFilter) return false;
      if (frpMinBound !== null && (fire.frp ?? -Infinity) < frpMinBound) return false;
      if (frpMaxBound !== null && (fire.frp ?? Infinity) > frpMaxBound) return false;
      if (brightnessMinBound !== null && fire.brightness < brightnessMinBound) return false;
      if (brightnessMaxBound !== null && fire.brightness > brightnessMaxBound) return false;
      if (fromBound !== null || toBound !== null) {
        const acquiredAt = new Date(fire.acquired_at).getTime();
        if (fromBound !== null && acquiredAt < fromBound) return false;
        if (toBound !== null && acquiredAt > toBound) return false;
      }
      return true;
    });
  }, [state.data, dayNightFilter, frpMinBound, frpMaxBound, brightnessMinBound, brightnessMaxBound, fromBound, toBound]);

  // The search box matches a city/municipality OR a country label — one field
  // covers "where", rather than making people pick which kind of place name
  // they're typing.
  const locationNeedle = locationQuery.trim().toLowerCase();
  const needsLabels = locationNeedle !== '' || sortKey === 'city' || sortKey === 'country';

  const filtered = useMemo(() => {
    const rows = locationNeedle
      ? baseFiltered.filter((fire) => {
        const city = cityOf(fire.id);
        if (city && city.toLowerCase().includes(locationNeedle)) return true;
        const country = countryOf(fire.id);
        return !!country && country.toLowerCase().includes(locationNeedle);
      })
      : baseFiltered;

    const direction = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return direction * (new Date(a.acquired_at).getTime() - new Date(b.acquired_at).getTime());
        case 'confidence':
          return direction * (confidenceRank[a.confidence] - confidenceRank[b.confidence]);
        case 'frp':
          return direction * ((a.frp ?? -1) - (b.frp ?? -1));
        case 'brightness':
          return direction * (a.brightness - b.brightness);
        case 'city':
          return direction * (cityOf(a.id) ?? '').localeCompare(cityOf(b.id) ?? '');
        case 'country':
          return direction * (countryOf(a.id) ?? '').localeCompare(countryOf(b.id) ?? '');
        default:
          return 0;
      }
    });
    // `cityOf`/`countryOf` are only real dependencies while a matching
    // filter/sort is active; pinning them to `null` otherwise stops
    // unrelated background label resolutions from invalidating this memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFiltered, locationNeedle, sortKey, sortDir, needsLabels ? cityOf : null, needsLabels ? countryOf : null]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  useEffect(() => { setPage(1); }, [
    dayNightFilter, locationQuery, frpMin, frpMax, brightnessMin, brightnessMax, dateFrom, dateTo, filters, pageSize,
  ]);

  useEffect(() => {
    pageRows.forEach((fire) => resolve(fire.id, fire.latitude, fire.longitude));
    // pageRows is a derived slice recomputed every render; only its identity-stable
    // membership (via filtered/clampedPage) should trigger new lookups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, clampedPage, resolve]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDir((current) => (current === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key);
    setSortDir(key === 'date' ? 'desc' : 'asc');
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown size={11} />;
    return sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const clearLocalFilters = () => {
    setLocationQuery('');
    setDayNightFilter('all');
    setFrpMin('');
    setFrpMax('');
    setBrightnessMin('');
    setBrightnessMax('');
    setDateFrom('');
    setDateTo('');
  };

  const toggleSource = (source: FirmsSource) => {
    const hasSource = filters.sources.includes(source);
    if (hasSource && filters.sources.length === 1) return;
    updateFilters({ sources: hasSource ? filters.sources.filter((item) => item !== source) : [...filters.sources, source] });
  };

  const totalCount = state.data?.detections.length ?? 0;
  const advancedFilterCount = [frpMin, frpMax, brightnessMin, brightnessMax, dateFrom, dateTo]
    .filter((value) => value.trim() !== '').length;
  const hasLocalFilters = locationQuery.trim() !== '' || dayNightFilter !== 'all' || advancedFilterCount > 0;

  return (
    <section className="fire-table" aria-label="Tabla de incendios">
      <header className="fire-table__toolbar">
        <div className="fire-table__toolbar-row">
          <label className="fire-table__search">
            <Search size={13} />
            <input
              type="text"
              placeholder="Filtrar por ciudad, municipio o país resuelto…"
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
            />
            {locationQuery && <button type="button" aria-label="Limpiar búsqueda de ubicación" onClick={() => setLocationQuery('')}><X size={13} /></button>}
          </label>
          <select aria-label="Ventana temporal FIRMS" value={filters.hours} onChange={(event) => updateFilters({ hours: Number(event.target.value) as 24 | 48 | 72 })}>
            <option value={24}>Últimas 24 h</option><option value={48}>Últimas 48 h</option><option value={72}>Últimas 72 h</option>
          </select>
          <select aria-label="Confianza mínima" value={filters.minConfidence} onChange={(event) => updateFilters({ minConfidence: event.target.value as FireConfidence })}>
            <option value="low">Toda confianza</option><option value="nominal">Nominal+</option><option value="high">Alta</option>
          </select>
          <select aria-label="Día o noche" value={dayNightFilter} onChange={(event) => setDayNightFilter(event.target.value as DayNightFilter)}>
            <option value="all">Día y noche</option>
            <option value="day">Solo día</option>
            <option value="night">Solo noche</option>
          </select>
          <button
            type="button"
            className={`fire-table__advanced-toggle ${showAdvanced ? 'is-active' : ''}`}
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((current) => !current)}
          >
            <SlidersHorizontal size={13} /> Avanzado{advancedFilterCount > 0 && <b>{advancedFilterCount}</b>}
          </button>
          {hasLocalFilters && <button type="button" className="fire-table__clear" onClick={clearLocalFilters}>Limpiar</button>}
        </div>
        {showAdvanced && (
          <div className="fire-table__toolbar-row fire-table__toolbar-row--advanced">
            <span className="fire-table__range">
              <span>FRP</span>
              <input type="number" inputMode="decimal" aria-label="FRP mínimo en MW" placeholder="mín" value={frpMin} onChange={(event) => setFrpMin(event.target.value)} />
              <span>–</span>
              <input type="number" inputMode="decimal" aria-label="FRP máximo en MW" placeholder="máx" value={frpMax} onChange={(event) => setFrpMax(event.target.value)} />
              <small>MW</small>
            </span>
            <span className="fire-table__range">
              <span>Brillo</span>
              <input type="number" inputMode="decimal" aria-label="Brillo mínimo en Kelvin" placeholder="mín" value={brightnessMin} onChange={(event) => setBrightnessMin(event.target.value)} />
              <span>–</span>
              <input type="number" inputMode="decimal" aria-label="Brillo máximo en Kelvin" placeholder="máx" value={brightnessMax} onChange={(event) => setBrightnessMax(event.target.value)} />
              <small>K</small>
            </span>
            <span className="fire-table__range fire-table__range--date">
              <span>Desde</span>
              <input type="datetime-local" aria-label="Fecha desde" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <span>Hasta</span>
              <input type="datetime-local" aria-label="Fecha hasta" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </span>
          </div>
        )}
        <div className="fire-table__toolbar-row fire-table__toolbar-row--meta">
          <div className="source-toggles">
            {(Object.keys(sourceLabels) as FirmsSource[]).map((source) => (
              <label key={source}><input type="checkbox" checked={filters.sources.includes(source)} onChange={() => toggleSource(source)} /> {sourceLabels[source]}</label>
            ))}
          </div>
          <span className="data-hint">
            {state.status === 'loading' ? 'Actualizando…' : `Mostrando ${filtered.length.toLocaleString('es-ES')} de ${totalCount.toLocaleString('es-ES')} detecciones en la vista actual del mapa`}
          </span>
        </div>
      </header>

      {state.status === 'error' && <p className="data-error" role="alert">{state.error}</p>}

      {!state.data && state.status !== 'error' && (
        <p className="fire-table__empty">{state.status === 'loading' ? 'Cargando detecciones…' : 'Mueve o acerca el mapa para cargar detecciones.'}</p>
      )}

      {state.data && filtered.length === 0 && (
        <p className="fire-table__empty">Ningún incendio coincide con los filtros actuales.</p>
      )}

      {state.data && filtered.length > 0 && (
        <div className="fire-table__scroll">
          <table>
            <thead>
              <tr>
                <th><button type="button" onClick={() => toggleSort('date')}>Fecha/Hora UTC {sortIcon('date')}</button></th>
                <th><button type="button" onClick={() => toggleSort('city')}>Ciudad / Municipio {sortIcon('city')}</button></th>
                <th><button type="button" onClick={() => toggleSort('country')}>País {sortIcon('country')}</button></th>
                <th>Satélite</th>
                <th><button type="button" onClick={() => toggleSort('confidence')}>Confianza {sortIcon('confidence')}</button></th>
                <th><button type="button" onClick={() => toggleSort('frp')}>Intensidad (FRP) {sortIcon('frp')}</button></th>
                <th><button type="button" onClick={() => toggleSort('brightness')}>Brillo {sortIcon('brightness')}</button></th>
                <th>Día/Noche</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((fire) => (
                <FireRow key={fire.id} fire={fire} location={labels[fire.id]} selected={fire.id === selectedFireId} onSelectFire={onSelectFire} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.data && filtered.length > 0 && (
        <footer className="fire-table__pagination">
          <span>Página {clampedPage} de {pageCount}</span>
          <div>
            <button type="button" disabled={clampedPage <= 1} onClick={() => setPage((current) => current - 1)} aria-label="Página anterior"><ChevronLeft size={14} /></button>
            <PageJump page={clampedPage} pageCount={pageCount} onJump={setPage} />
            <button type="button" disabled={clampedPage >= pageCount} onClick={() => setPage((current) => current + 1)} aria-label="Página siguiente"><ChevronRight size={14} /></button>
          </div>
          <label className="fire-table__page-size">
            <span>Resultados</span>
            <select
              aria-label="Resultados por página"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value) as typeof PAGE_SIZE_OPTIONS[number])}
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </footer>
      )}
    </section>
  );
}

function FireRow({ fire, location, selected, onSelectFire }: {
  fire: FireDetection; location: ReturnType<typeof useFireLocations>['labels'][string] | undefined;
  selected: boolean; onSelectFire: (id: string) => void;
}) {
  const bucket = intensityBucket(fire.frp);
  const cityText = location?.status === 'success' ? (location.data.place || location.data.label) : null;
  const countryText = location?.status === 'success' ? location.data.country : null;
  return (
    <tr className={selected ? 'is-selected' : ''}>
      <td className="fire-table__mono">{utcDateTime(fire.acquired_at)}</td>
      <td>
        {location?.status === 'loading' && <span className="fire-table__muted">Resolviendo…</span>}
        {location?.status === 'error' && <span className="fire-table__muted">N/D</span>}
        {cityText && <span>{cityText}</span>}
        {!location && <span className="fire-table__muted">—</span>}
      </td>
      <td>
        {location?.status === 'loading' && <span className="fire-table__muted">Resolviendo…</span>}
        {location?.status === 'error' && <span className="fire-table__muted">N/D</span>}
        {countryText && <span>{countryText}</span>}
        {location?.status === 'success' && !countryText && <span className="fire-table__muted">—</span>}
        {!location && <span className="fire-table__muted">—</span>}
      </td>
      <td>{sourceLabels[fire.source]} · {fire.instrument}</td>
      <td><span className={`confidence-badge confidence-badge--${fire.confidence}`}>{confidenceLabels[fire.confidence]}</span></td>
      <td>
        {fire.frp !== null
          ? <span className={`intensity-badge intensity-badge--${bucket}`}>{fire.frp.toFixed(1)} MW · {bucket && INTENSITY_LABELS[bucket]}</span>
          : <span className="fire-table__muted">—</span>}
      </td>
      <td className="fire-table__mono">{fire.brightness.toFixed(1)} K</td>
      <td>{fire.daynight === 'day' ? 'Día' : 'Noche'}</td>
      <td>
        <button type="button" className="fire-table__locate" onClick={() => onSelectFire(fire.id)}>
          <MapPin size={13} /> Ver en mapa
        </button>
      </td>
    </tr>
  );
}

/** A viewport-wide result set can span thousands of pages; Anterior/Siguiente
 * alone would make most of it unreachable, so this lets you jump directly. */
function PageJump({ page, pageCount, onJump }: { page: number; pageCount: number; onJump: (page: number) => void }) {
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed)) onJump(Math.min(Math.max(parsed, 1), pageCount));
    else setDraft(String(page));
  };

  return (
    <input
      type="number"
      min={1}
      max={pageCount}
      aria-label="Ir a la página"
      className="fire-table__page-input"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
    />
  );
}
