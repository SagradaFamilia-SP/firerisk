import { Activity, Flame, Gauge, Radius, Trees, Wind, X } from 'lucide-react';

import type { SpreadResponse } from '../../types/api';
import { buildSpreadStats, formatStatNumber, makeSvgLinePath } from './spreadStats';

function MetricCard({ icon: Icon, label, value, detail }: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="spread-stats-metric">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TrendChart({ title, values, unit, color }: {
  title: string;
  values: number[];
  unit: string;
  color: string;
}) {
  const latest = values[values.length - 1] ?? 0;
  return (
    <div className="spread-stats-chart">
      <div>
        <span>{title}</span>
        <strong>{formatStatNumber(latest)} {unit}</strong>
      </div>
      <svg viewBox="0 0 260 92" role="img" aria-label={title} preserveAspectRatio="none">
        <path d="M 0 92 L 260 92" className="spread-stats-chart__axis" />
        <path d={makeSvgLinePath(values)} stroke={color} />
      </svg>
      <div className="spread-stats-chart__ticks">
        <span>0 h</span>
        <span>+{values.length - 1} h</span>
      </div>
    </div>
  );
}

export function SpreadStatsModal({ data, onClose }: { data: SpreadResponse; onClose: () => void }) {
  const stats = buildSpreadStats(data);
  const { horizon, series, milestones, fuelBreakdown } = stats;
  const weather = stats.weather.samples.slice(0, 4);

  return (
    <div className="spread-stats-modal" role="dialog" aria-modal="true" aria-label="Estadísticas de propagación">
      <div className="spread-stats-modal__panel">
        <header className="spread-stats-modal__header">
          <div>
            <span className="eyebrow">Modelo de propagación</span>
            <strong>Horizonte operativo +{data.max_hours} h</strong>
          </div>
          <button type="button" aria-label="Cerrar estadísticas de propagación" onClick={onClose}><X size={17} /></button>
        </header>

        <div className="spread-stats-modal__body">
          <section className="spread-stats-grid" aria-label="Resumen estadístico">
            <MetricCard icon={Flame} label={`Área +${data.max_hours} h`} value={`${formatStatNumber(horizon.area_km2)} km²`} detail="superficie del perímetro simulado" />
            <MetricCard icon={Radius} label="Radio máximo" value={`${formatStatNumber(horizon.radius_km_max)} km`} detail={`radio medio ${formatStatNumber(horizon.radius_km_mean)} km`} />
            <MetricCard icon={Activity} label="Intensidad máxima" value={`${horizon.intensity_kw_m_max.toFixed(0)} kW/m`} detail="frente activo por Byram" />
            <MetricCard icon={Gauge} label="Multiplicador" value={`${formatStatNumber(data.scenario.spread_multiplier)}x`} detail="vigor inicial FRP/brillo" />
          </section>

          <section className="spread-stats-charts" aria-label="Evolución temporal">
            <TrendChart title="Área simulada" values={series.areaKm2} unit="km²" color="#ff8b57" />
            <TrendChart title="Radio máximo" values={series.radiusMaxKm} unit="km" color="#9fd6ff" />
            <TrendChart title="Intensidad máxima" values={series.intensityMaxKwM} unit="kW/m" color="#f2c98a" />
          </section>

          <section className="spread-stats-split">
            <div>
              <div className="spread-stats-section-title"><Activity size={15} /><span>Hitos operativos</span></div>
              <ul className="spread-stats-list">
                <li>
                  <span>Primera superficie &gt; 1 km²</span>
                  <b>{milestones.firstAreaOverOneKm2 ? `+${milestones.firstAreaOverOneKm2.hour} h` : 'N/D'}</b>
                </li>
                <li>
                  <span>Pico de intensidad</span>
                  <b>+{milestones.peakIntensity.hour} h · {milestones.peakIntensity.intensity_kw_m_max.toFixed(0)} kW/m</b>
                </li>
                <li>
                  <span>Mayor crecimiento horario</span>
                  <b>+{milestones.fastestGrowth.hour} h · {formatStatNumber(milestones.fastestGrowth.areaGrowthKm2)} km²/h</b>
                </li>
              </ul>
            </div>

            <div>
              <div className="spread-stats-section-title"><Gauge size={15} /><span>Factores dominantes</span></div>
              <ul className="spread-stats-list">
                <li><span>Viento máximo</span><b>{stats.weather.maxWind ? `${stats.weather.maxWind.wind_kmh.toFixed(1)} km/h` : 'N/D'}</b></li>
                <li><span>Potencia/temperatura inicial</span><b>{data.scenario.frp_mw.toFixed(1)} MW · {data.scenario.brightness_k.toFixed(1)} K</b></li>
                <li><span>Escenario de propagación</span><b>{formatStatNumber(data.scenario.spread_multiplier)}x</b></li>
              </ul>
            </div>
          </section>

          <section className="spread-stats-split">
            <div>
              <div className="spread-stats-section-title"><Wind size={15} /><span>Viento y atmósfera</span></div>
              <ul className="spread-stats-list">
                {weather.map((sample) => (
                  <li key={sample.time}>
                    <span>{new Date(sample.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    <b>{sample.wind_kmh.toFixed(1)} km/h · {sample.wind_from_deg.toFixed(0)}°</b>
                    <small>{sample.temperature_c.toFixed(1)} °C · {sample.rh_pct.toFixed(0)} % HR</small>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="spread-stats-section-title"><Trees size={15} /><span>Combustible afectado</span></div>
              <ul className="spread-stats-list">
                {fuelBreakdown.length === 0 && <li><span>Sin superficie quemada</span><b>0.00 km²</b></li>}
                {fuelBreakdown.map(([name, km2]) => (
                  <li key={name}><span>{name}</span><b>{formatStatNumber(km2)} km²</b></li>
                ))}
              </ul>
            </div>
          </section>

          <section className="spread-stats-notes" aria-label="Notas del modelo">
            <strong>Base del cálculo</strong>
            <span>Terreno: {data.terrain_source} · Combustible: {data.fuel_source}</span>
            <span>{data.warning}</span>
            {data.model_notes.map((note) => <p key={note}>{note}</p>)}
          </section>
        </div>
      </div>
    </div>
  );
}
