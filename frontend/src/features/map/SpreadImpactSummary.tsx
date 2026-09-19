import type { SpreadSnapshot } from '../../types/api';
import { severityForIntensity, sortedFuelBreakdown, type SeverityLevel } from './spreadImpact';

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  low: 'severity-badge--low',
  moderate: 'severity-badge--moderate',
  high: 'severity-badge--high',
  extreme: 'severity-badge--extreme',
};

/** "What damage would this cause" summary: a severity read from the fireline
 * intensity (standard suppression-difficulty thresholds) plus the real land
 * cover under the burned area — both derived from data already in the
 * snapshot, not invented figures. */
export function SpreadImpactSummary({ snapshot }: { snapshot: SpreadSnapshot }) {
  if (snapshot.area_km2 <= 0) return null;
  const severity = severityForIntensity(snapshot.intensity_kw_m_max);
  const fuelBreakdown = sortedFuelBreakdown(snapshot.burned_area_by_fuel_km2);

  return (
    <div className="spread-impact">
      <div className="spread-impact__severity">
        <span>Peligrosidad estimada</span>
        <b className={`severity-badge ${SEVERITY_CLASS[severity.level]}`}>{severity.label}</b>
      </div>
      <p className="spread-impact__note">{severity.description}</p>
      {fuelBreakdown.length > 0 && (
        <>
          <span className="spread-impact__label">Superficie afectada por cobertura del suelo</span>
          <ul className="spread-impact__fuels">
            {fuelBreakdown.map(([name, km2]) => (
              <li key={name}><span>{name}</span><b>{km2.toFixed(2)} km²</b></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
