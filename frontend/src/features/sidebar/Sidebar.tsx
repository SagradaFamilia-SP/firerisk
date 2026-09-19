import type { LayerKey } from '../../hooks/useDashboard';
import type { SimulationResponse } from '../../types/api';
import { AssetList } from './AssetList';
import { LayerControls } from './LayerControls';
import { RiskOverview } from './RiskOverview';
import { SiteSummary } from './SiteSummary';

export function Sidebar({ simulation, updating, layers, selectedAssetId, onToggleLayer, onSelectAsset }: {
  simulation: SimulationResponse | null; updating: boolean; layers: Record<LayerKey, boolean>;
  selectedAssetId: string | null; onToggleLayer: (layer: LayerKey) => void; onSelectAsset: (id: string) => void;
}) {
  return (
    <aside className="sidebar" aria-label="Contexto territorial">
      <SiteSummary />
      <div className="panel-section"><RiskOverview score={simulation?.metrics.territorial_risk ?? 0} updating={updating} /></div>
      <LayerControls layers={layers} onToggle={onToggleLayer} />
      <AssetList assets={simulation?.assets ?? []} selectedId={selectedAssetId} onSelect={onSelectAsset} />
    </aside>
  );
}

