import { CircleCheck, Database } from 'lucide-react';
import type { SimulationResponse } from '../../types/api';

export function DataSourceStatus({ sources }: { sources: SimulationResponse['sources'] }) {
  return (
    <details className="source-status">
      <summary><span><Database size={14} /> Fuentes de datos</span><small>{sources.length} conectadas</small></summary>
      <div>{sources.map((source) => <p key={source.name}><span><CircleCheck size={12} />{source.name}</span><b>{source.status}</b></p>)}</div>
    </details>
  );
}

