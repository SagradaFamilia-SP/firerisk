import { useState } from 'react';
import { Flame } from 'lucide-react';

import type { useDashboard } from '../../hooks/useDashboard';
import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { ForecastTimeline } from '../map/ForecastTimeline';
import { MapToolbar } from '../map/MapToolbar';
import { SimulationMap } from './SimulationMap';
import { SimulationPanel } from './SimulationPanel';

type Dashboard = ReturnType<typeof useDashboard>;

export function SimulationWorkspace({ dashboard, simulation }: { dashboard: Dashboard; simulation: SimulationSpread }) {
  const [centerKey, setCenterKey] = useState(0);
  const [view, setView] = useState<'site' | 'global'>('global');
  const [, setTimelinePlaying] = useState(false);
  return (
    <div className="simulation-workspace">
      <div className="map-workspace">
        <SimulationMap key={`${view}-${centerKey}`} simulation={simulation} baseMap={dashboard.baseMap} initialView={view} />
        <MapToolbar
          baseMap={dashboard.baseMap}
          onBaseMap={dashboard.setBaseMap}
          onCenter={() => { setView('site'); setCenterKey((key) => key + 1); }}
          onGlobal={() => { setView('global'); setCenterKey((key) => key + 1); }}
        />
        {!simulation.point && (
          <div className="simulation-prompt-card" role="status" aria-label="Instrucciones de simulación">
            <Flame size={22} />
            <div>
              <strong>¿Qué pasaría si hay un incendio aquí?</strong>
              <span>Haz clic en cualquier punto del mapa para simular propagación con terreno, combustible y viento reales.</span>
            </div>
          </div>
        )}
        {simulation.data && <ForecastTimeline hour={simulation.hour} onChange={simulation.setHour} onPlayingChange={setTimelinePlaying} />}
        {simulation.status === 'loading' && <span className="map-updating">Calculando propagación…</span>}
      </div>
      {simulation.point && <SimulationPanel simulation={simulation} />}
    </div>
  );
}
