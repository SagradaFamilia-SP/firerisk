import type { LayerKey } from '../../hooks/useDashboard';
import { LayerControls } from './LayerControls';

export function Sidebar({ layers, onToggleLayer }: {
  layers: Record<LayerKey, boolean>; onToggleLayer: (layer: LayerKey) => void;
}) {
  return (
    <aside className="sidebar" aria-label="Contexto territorial">
      <LayerControls layers={layers} onToggle={onToggleLayer} />
    </aside>
  );
}
