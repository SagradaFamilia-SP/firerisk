import { Bot, ChevronRight, LoaderCircle, Sparkles } from 'lucide-react';

import type { AsyncState } from '../../hooks/useDashboard';
import type { OperationalPlan } from '../../types/api';

export function OperationsPlan({ state, onGenerate }: { state: AsyncState<OperationalPlan>; onGenerate: () => void }) {
  const loading = state.status === 'loading';
  const plan = state.data;
  return (
    <section className="operations-plan">
      <div className="operations-plan__heading"><span><Bot size={17} /> Agente coordinador</span>{plan && <span className="mode-badge">{plan.mode === 'local_model' ? 'Generado por IA' : 'Plan de contingencia'}</span>}</div>
      {!plan && state.status !== 'error' && <div className="operations-plan__empty"><Sparkles size={22} /><p>Analiza el escenario y genera una secuencia de respuesta priorizada.</p></div>}
      {state.status === 'error' && <p className="inline-error">{state.error}</p>}
      {plan && <div className="operations-plan__content"><h3>{plan.decision}</h3><p>{plan.summary}</p><ol>{plan.actions.slice(0, 5).map((action) => <li key={`${action.priority}-${action.action}`}><span>{action.priority}</span><div><strong>{action.action}</strong><small>{action.owner} · {action.deadline_min} min</small></div></li>)}</ol></div>}
      <button type="button" className="button button--primary" disabled={loading} onClick={onGenerate}>
        {loading ? <><LoaderCircle className="spin" size={16} /> Generando plan…</> : <><Sparkles size={16} /> Generar plan operativo <ChevronRight size={15} /></>}
      </button>
    </section>
  );
}

