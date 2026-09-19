import { Flame, Layers3, RadioTower, Route, Wind } from 'lucide-react';

import type { LayerKey } from '../../hooks/useDashboard';

const layerItems: Array<{ id: LayerKey; label: string; icon: typeof Flame }> = [
  { id: 'risk', label: 'Índice de peligro', icon: Layers3 },
  { id: 'fire', label: 'Focos térmicos', icon: Flame },
  { id: 'spread', label: 'Propagación', icon: Route },
  { id: 'wind', label: 'Campo de viento', icon: Wind },
  { id: 'assets', label: 'Infraestructuras', icon: RadioTower },
];

export function LayerControls({ layers, onToggle }: { layers: Record<LayerKey, boolean>; onToggle: (layer: LayerKey) => void }) {
  return (
    <section className="panel-section">
      <div className="section-heading"><span className="eyebrow">Capas operativas</span><span>{Object.values(layers).filter(Boolean).length}/5</span></div>
      <div className="layer-list">
        {layerItems.map(({ id, label, icon: Icon }) => (
          <label className="layer-control" key={id}>
            <span><Icon size={15} /><span>{label}</span></span>
            <input type="checkbox" checked={layers[id]} onChange={() => onToggle(id)} /><i aria-hidden="true" />
          </label>
        ))}
      </div>
    </section>
  );
}

