import { useState } from 'react';

import type { useDashboard } from '../../hooks/useDashboard';
import { FireRiskMap } from './FireRiskMap';
import { ForecastTimeline } from './ForecastTimeline';
import { MapToolbar } from './MapToolbar';
import { RiskLegend } from './RiskLegend';

type Dashboard = ReturnType<typeof useDashboard>;

export function MapWorkspace({ dashboard }: { dashboard: Dashboard }) {
  const [centerKey, setCenterKey] = useState(0);
  return (
    <div className="map-workspace">
      <FireRiskMap
        key={centerKey}
        scenario={dashboard.scenario}
        simulation={dashboard.simulation.data}
        layers={dashboard.layers}
        baseMap={dashboard.baseMap}
        selectedAssetId={dashboard.selectedAssetId}
      />
      <MapToolbar
        baseMap={dashboard.baseMap}
        weatherLoading={dashboard.weatherLoading}
        onBaseMap={dashboard.setBaseMap}
        onCritical={dashboard.activateCriticalScenario}
        onWeather={dashboard.loadWeather}
        onCenter={() => { dashboard.setSelectedAssetId(null); setCenterKey((key) => key + 1); }}
      />
      <ForecastTimeline hour={dashboard.scenario.hour} onChange={(hour) => dashboard.updateScenario({ hour })} />
      <RiskLegend />
      {dashboard.simulation.status === 'loading' && <span className="map-updating">Recalculando escenario…</span>}
    </div>
  );
}

