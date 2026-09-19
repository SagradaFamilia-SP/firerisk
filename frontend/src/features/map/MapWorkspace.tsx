import { useState } from 'react';

import type { useDashboard } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import { FireRiskMap } from './FireRiskMap';
import { ForecastTimeline } from './ForecastTimeline';
import { MapToolbar } from './MapToolbar';

type Dashboard = ReturnType<typeof useDashboard>;

export function MapWorkspace({ dashboard, liveFires, fireSpread }: { dashboard: Dashboard; liveFires: LiveFires; fireSpread: FireSpread }) {
  const [centerKey, setCenterKey] = useState(0);
  const [view, setView] = useState<'site' | 'global'>('site');
  return (
    <div className="map-workspace">
      <FireRiskMap
        key={`${view}-${centerKey}`}
        layers={dashboard.layers}
        baseMap={dashboard.baseMap}
        initialView={view}
        fires={(liveFires.state.data?.detections ?? []).slice(0, 8000)}
        selectedFireId={liveFires.selectedFireId}
        onSelectFire={liveFires.setSelectedFireId}
        onViewport={liveFires.updateViewport}
        fireSpread={fireSpread}
      />
      <MapToolbar
        baseMap={dashboard.baseMap}
        onBaseMap={dashboard.setBaseMap}
        onCenter={() => { setView('site'); setCenterKey((key) => key + 1); }}
        onGlobal={() => { setView('global'); setCenterKey((key) => key + 1); }}
      />
      {fireSpread.data && <ForecastTimeline hour={fireSpread.hour} onChange={fireSpread.setHour} />}
      {fireSpread.status === 'loading' && <span className="map-updating">Calculando propagación…</span>}
    </div>
  );
}
