import { MapPin } from 'lucide-react';

export function SiteSummary() {
  return (
    <section className="panel-section site-summary">
      <span className="eyebrow">Activo monitorizado</span>
      <div className="site-summary__heading"><span className="site-summary__icon"><MapPin size={18} /></span><div><h2>Talaván Norte</h2><p>Planta solar fotovoltaica</p></div></div>
      <dl className="site-summary__meta"><div><dt>Coordenadas</dt><dd>39.7178° N · 6.2631° O</dd></div><div><dt>Altitud</dt><dd>410 m</dd></div></dl>
    </section>
  );
}

