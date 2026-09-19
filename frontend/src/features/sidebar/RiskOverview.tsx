import { TrendingUp } from 'lucide-react';

import { getRiskLevel } from './risk';

export function RiskOverview({ score, updating }: { score: number; updating: boolean }) {
  const level = getRiskLevel(score);
  return (
    <section className={`risk-card risk-card--${level.toLowerCase().replace(' ', '-')}`}>
      <div className="risk-card__head"><span>Riesgo territorial</span><span className="risk-card__trend"><TrendingUp size={13} /> creciente</span></div>
      <div className="risk-card__score"><strong>{Math.round(score)}</strong><span>/100</span></div>
      <div className="risk-card__footer"><b>{level}</b><span>{updating ? 'Actualizando…' : 'Modelo actualizado'}</span></div>
    </section>
  );
}
