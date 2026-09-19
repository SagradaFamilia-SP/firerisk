import { Building2, ChevronRight, RadioTower, Sun, Warehouse, Zap } from 'lucide-react';

import type { AffectedAsset } from '../../types/api';

const icons = { solar: Sun, zap: Zap, warehouse: Warehouse, 'radio-tower': RadioTower };

export function AssetList({ assets, selectedId, onSelect }: { assets: AffectedAsset[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="panel-section panel-section--grow">
      <div className="section-heading"><span className="eyebrow">Activos en seguimiento</span><span>{assets.length}</span></div>
      <div className="asset-list">
        {assets.map((asset) => {
          const Icon = icons[asset.icon as keyof typeof icons] ?? Building2;
          return (
            <button type="button" className={`asset-row ${selectedId === asset.id ? 'is-active' : ''}`} key={asset.id} onClick={() => onSelect(asset.id)}>
              <span className="asset-row__icon"><Icon size={16} /></span>
              <span className="asset-row__body"><strong>{asset.name}</strong><small>{asset.distance_km} km · {asset.people} personas</small></span>
              <span className="asset-row__risk"><b>{asset.probability}%</b><ChevronRight size={14} /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

