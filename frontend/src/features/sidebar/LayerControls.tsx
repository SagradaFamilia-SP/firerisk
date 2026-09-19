import { Flame, Route } from 'lucide-react';

import type { LayerKey } from '../../hooks/useDashboard';

const layerItems: Array<{ id: LayerKey; label: string; icon: typeof Flame }> = [
  { id: 'fire', label: 'NASA FIRMS · VIIRS', icon: Flame },
  { id: 'spread', label: 'Propagación estimada', icon: Route },
];

export function LayerControls({ layers, onToggle }: { layers: Record<LayerKey, boolean>; onToggle: (layer: LayerKey) => void }) {
  return (
    <section className="panel-section">
      <div className="section-heading"><span className="eyebrow">Capas operativas</span><span>{Object.values(layers).filter(Boolean).length}/2</span></div>
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
