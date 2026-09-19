import { Gauge, MapPin, RotateCcw, Thermometer, Wind } from 'lucide-react';

import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { useReverseLocation } from '../../hooks/useReverseLocation';
import { SpreadImpactSummary } from '../map/SpreadImpactSummary';

export function SimulationPanel({ simulation }: { simulation: SimulationSpread }) {
  const { point, status, data, error, hour, clear, scenario, updateScenario } = simulation;
  const reverseLocation = useReverseLocation(point ? { latitude: point.lat, longitude: point.lon } : null);

  if (!point) return null;

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

      <div className="simulation-config">
        <span className="eyebrow">Configurar escenario</span>
        <label className="simulation-config__slider">
          <span><Gauge size={13} />Potencia</span>
          <input type="range" min={0.5} max={60} step={0.1} value={scenario.frpMw} onChange={(event) => updateScenario({ frpMw: Number(event.target.value) })} aria-label="Potencia radiativa (FRP) del fuego hipotético" />
          <b>FRP {scenario.frpMw.toFixed(1)} MW</b>
        </label>
        <label className="simulation-config__slider">
          <span><Thermometer size={13} />Brillo</span>
          <input type="range" min={300} max={400} step={0.1} value={scenario.brightnessK} onChange={(event) => updateScenario({ brightnessK: Number(event.target.value) })} aria-label="Brillo del fuego hipotético" />
          <b>{scenario.brightnessK.toFixed(1)} K</b>
        </label>
        <small>Estos valores ajustan el vigor inicial del escenario. El terreno, el combustible y el viento reales siguen marcando la dirección y forma de propagación.</small>
        {data?.scenario.spread_multiplier && <small>Multiplicador de propagación: {data.scenario.spread_multiplier.toFixed(2)}x</small>}
      </div>

      <dl className="selected-fire-grid">
        <div>
          <dt><MapPin size={13} />Ubicación</dt>
          <dd>
            {reverseLocation.status === 'loading' && <span className="fire-table__muted">Resolviendo…</span>}
            {reverseLocation.status === 'success' && (
              <>
                {reverseLocation.data.place || reverseLocation.data.label}
                {reverseLocation.data.country && <small className="selected-fire-grid__sub">{reverseLocation.data.country}</small>}
              </>
            )}
            {(reverseLocation.status === 'idle' || reverseLocation.status === 'error') && (
              <>{point.lat.toFixed(4)}, {point.lon.toFixed(4)}</>
            )}
          </dd>
          {reverseLocation.status === 'success' && (
            <small className="selected-fire-grid__coords">{point.lat.toFixed(4)}, {point.lon.toFixed(4)}</small>
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

      {data && data.snapshots[data.max_hours].area_km2 > 0 && (
        <div className="fire-detail">
          <strong>Daños potenciales a +{data.max_hours} h</strong>
          <SpreadImpactSummary snapshot={data.snapshots[data.max_hours]} />
        </div>
      )}
    </aside>
  );
}
