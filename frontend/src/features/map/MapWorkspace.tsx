import { useState } from 'react';

import type { useDashboard } from '../../hooks/useDashboard';
import type { LiveFires } from '../../hooks/useLiveFires';
import { FireRiskMap } from './FireRiskMap';
import { ForecastTimeline } from './ForecastTimeline';
import { MapToolbar } from './MapToolbar';
import { RiskLegend } from './RiskLegend';

type Dashboard = ReturnType<typeof useDashboard>;

export function MapWorkspace({ dashboard, liveFires }: { dashboard: Dashboard; liveFires: LiveFires }) {
  const [centerKey, setCenterKey] = useState(0);
  const [view, setView] = useState<'site' | 'global'>('site');
  return (
    <div className="map-workspace">
      <FireRiskMap
        key={`${view}-${centerKey}`}
        scenario={dashboard.scenario}
        simulation={dashboard.simulation.data}
        layers={dashboard.layers}
        baseMap={dashboard.baseMap}
        selectedAssetId={dashboard.selectedAssetId}
        initialView={view}
        fires={(liveFires.state.data?.detections ?? []).slice(0, 8000)}
        selectedFireId={liveFires.selectedFireId}
        onSelectFire={liveFires.setSelectedFireId}
        onViewport={liveFires.updateViewport}
      />
      <MapToolbar
        baseMap={dashboard.baseMap}
        weatherLoading={dashboard.weatherLoading}
        onBaseMap={dashboard.setBaseMap}
        onCritical={dashboard.activateCriticalScenario}
        onWeather={dashboard.loadWeather}
        onCenter={() => { dashboard.setSelectedAssetId(null); setView('site'); setCenterKey((key) => key + 1); }}
        onGlobal={() => { dashboard.setSelectedAssetId(null); setView('global'); setCenterKey((key) => key + 1); }}
      />
      <ForecastTimeline hour={dashboard.scenario.hour} onChange={(hour) => dashboard.updateScenario({ hour })} />
      <RiskLegend />
      {dashboard.simulation.status === 'loading' && <span className="map-updating">Recalculando escenario…</span>}
    </div>
  );
}
