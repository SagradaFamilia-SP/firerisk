import type { AsyncState } from '../../hooks/useDashboard';
import type { OperationalPlan, ScenarioInput, SimulationResponse } from '../../types/api';
import type { LiveFires } from '../../hooks/useLiveFires';
import { DataSourceStatus } from './DataSourceStatus';
import { ImpactSummary } from './ImpactSummary';
import { IncidentAlert } from './IncidentAlert';
import { OperationsPlan } from './OperationsPlan';
import { WeatherMetrics } from './WeatherMetrics';
import { LiveFirePanel } from './LiveFirePanel';

export function IntelligencePanel({ scenario, simulation, plan, liveFires, onGeneratePlan }: {
  scenario: ScenarioInput; simulation: SimulationResponse | null;
  plan: AsyncState<OperationalPlan>; liveFires: LiveFires; onGeneratePlan: () => void;
}) {
  return (
    <aside className="intelligence" aria-label="Inteligencia operativa">
      <section className="panel-section"><div className="section-heading"><span className="eyebrow">Condiciones actuales</span><span>En vivo</span></div><WeatherMetrics scenario={scenario} /></section>
      <LiveFirePanel liveFires={liveFires} />
      <section className="panel-section"><IncidentAlert probability={simulation?.metrics.top_probability ?? 0} eta={simulation?.metrics.top_eta_min ?? null} /></section>
      <section className="panel-section"><span className="eyebrow">Impacto estimado</span><ImpactSummary simulation={simulation} /></section>
      <section className="panel-section"><DataSourceStatus sources={simulation?.sources ?? []} /></section>
      <section className="panel-section panel-section--grow"><OperationsPlan state={plan} onGenerate={onGeneratePlan} /></section>
    </aside>
  );
}
