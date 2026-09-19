import { Flame, MapPin, RotateCcw, Wind } from 'lucide-react';

import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { useReverseLocation } from '../../hooks/useReverseLocation';

export function SimulationPanel({ simulation }: { simulation: SimulationSpread }) {
  const { point, status, data, error, hour, clear } = simulation;
  const reverseLocation = useReverseLocation(point ? { latitude: point.lat, longitude: point.lon } : null);

  if (!point) {
    return (
      <aside className="simulation-panel" aria-label="Simulación de incendio">
        <div className="simulation-panel__empty">
          <Flame size={28} />
          <h2>¿Qué pasaría si hay un incendio aquí?</h2>
          <p>Haz clic en cualquier punto del mapa. IGNIS simulará su propagación con el terreno, el combustible y el viento reales de esa ubicación.</p>
        </div>
      </aside>
    );
  }

  const snapshot = data ? data.snapshots[Math.min(hour, data.max_hours)] : null;
  const weather = data?.weather[0];

  return (
    <aside className="simulation-panel" aria-label="Simulación de incendio">
      <header className="simulation-panel__head">
        <div>
          <span className="eyebrow">Punto simulado</span>
          <strong>
            {reverseLocation.status === 'success' ? (reverseLocation.data.place || reverseLocation.data.label) : `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`}
          </strong>
        </div>
        <button type="button" aria-label="Elegir otro punto" onClick={clear}><RotateCcw size={15} /></button>
      </header>

      <dl className="selected-fire-grid">
        <div>
          <dt><MapPin size={13} />Coordenadas</dt>
          <dd>{point.lat.toFixed(4)}, {point.lon.toFixed(4)}</dd>
          {reverseLocation.status === 'success' && reverseLocation.data.country && (
            <small className="selected-fire-grid__sub">{reverseLocation.data.country}</small>
          )}
        </div>
        {weather && (
          <div>
            <dt><Wind size={13} />Viento</dt>
            <dd>{weather.wind_kmh.toFixed(1)} km/h</dd>
          </div>
        )}
      </dl>

      {status === 'loading' && <p className="data-hint">Calculando propagación con terreno y combustible reales…</p>}
      {status === 'error' && <p className="data-error" role="alert">{error}</p>}

      {data && snapshot && (
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
          {weather && <span>Viento {weather.wind_kmh.toFixed(1)} km/h desde {weather.wind_from_deg.toFixed(0)}° · {weather.temperature_c.toFixed(1)} °C · {weather.rh_pct.toFixed(0)} % HR</span>}
          <small>{data.warning}</small>
        </div>
      )}
    </aside>
  );
}
