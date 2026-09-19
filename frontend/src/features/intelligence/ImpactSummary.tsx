import { Banknote, Clock3, ShieldAlert, Users } from 'lucide-react';
import type { SimulationResponse } from '../../types/api';

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });

export function ImpactSummary({ simulation }: { simulation: SimulationResponse | null }) {
  const metrics = simulation?.metrics;
  const items = [
    { label: 'Probabilidad máxima', value: `${metrics?.top_probability ?? 0}%`, icon: ShieldAlert },
    { label: 'Ventana de impacto', value: metrics?.top_eta_min ? `${metrics.top_eta_min} min` : 'Sin ETA', icon: Clock3 },
    { label: 'Exposición estimada', value: euros.format(metrics?.exposure_eur ?? 0), icon: Banknote },
    { label: 'Personal expuesto', value: `${metrics?.people_exposed ?? 0} personas`, icon: Users },
  ];
  return <div className="impact-grid">{items.map(({ label, value, icon: Icon }) => <div key={label}><span><Icon size={14} />{label}</span><strong>{value}</strong></div>)}</div>;
}

