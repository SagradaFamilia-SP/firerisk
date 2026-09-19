import { useState } from 'react';

import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { ForecastTimeline } from '../map/ForecastTimeline';
import { SimulationMap } from './SimulationMap';
import { SimulationPanel } from './SimulationPanel';

export function SimulationWorkspace({ simulation }: { simulation: SimulationSpread }) {
  const [, setTimelinePlaying] = useState(false);
  return (
    <div className="simulation-workspace">
      <div className="map-workspace">
        <SimulationMap simulation={simulation} />
        {simulation.data && <ForecastTimeline hour={simulation.hour} onChange={simulation.setHour} onPlayingChange={setTimelinePlaying} />}
      </div>
      <SimulationPanel simulation={simulation} />
    </div>
  );
}
