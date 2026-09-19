import { Flame } from 'lucide-react';

export function IncidentAlert({ probability, eta }: { probability: number; eta: number | null }) {
  return (
    <article className="incident-alert">
      <span className="incident-alert__icon"><Flame size={18} fill="currentColor" /></span>
      <div><span className="eyebrow">Incidente activo</span><h3>Foco convergente detectado</h3><p>Trayectoria alineada con el corredor oeste. Probabilidad de afección del {probability}%{eta ? ` en ${eta} minutos` : ''}.</p></div>
      <span className="severity-badge">Crítico</span>
    </article>
  );
}

