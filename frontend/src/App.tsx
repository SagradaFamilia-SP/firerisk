import { useMemo } from 'react';

import { useDashboard } from './hooks/useDashboard';
import { useCameraFires } from './hooks/useCameraFires';
import { useChat } from './hooks/useChat';
import { AppShell } from './features/shell/AppShell';
import { cameraFireToDetection } from './features/map/cameraFireToDetection';
import { MapWorkspace } from './features/map/MapWorkspace';
import { useFireReport } from './hooks/useFireReport';
import { useFireSpread } from './hooks/useFireSpread';
import { useLiveFires } from './hooks/useLiveFires';
import { useReverseLocation } from './hooks/useReverseLocation';
import { useSimulationSpread } from './hooks/useSimulationSpread';

export default function App() {
  const dashboard = useDashboard();
  const liveFires = useLiveFires();
  const cameraFires = useCameraFires();
  // Camera-detected fires get mocked-but-consistent brightness/FRP so they can
  // flow through the exact same selection/simulation/report pipeline as a
  // real NASA detection, keyed off their real, camera-reported coordinates.
  const allDetections = useMemo(
    () => [...(liveFires.state.data?.detections ?? []), ...cameraFires.fires.map(cameraFireToDetection)],
    [liveFires.state.data, cameraFires.fires],
  );
  const fireSpread = useFireSpread(liveFires.selectedFireId, allDetections);
  const chat = useChat();
  const simulation = useSimulationSpread();
  const selectedFire = allDetections.find((fire) => fire.id === liveFires.selectedFireId) ?? null;
  const reverseLocation = useReverseLocation(selectedFire);
  const fireReport = useFireReport(selectedFire, reverseLocation, fireSpread);
  return (
    <AppShell
      dashboard={dashboard}
      liveFires={liveFires}
      fireSpread={fireSpread}
      reverseLocation={reverseLocation}
      chat={chat}
      fireReport={fireReport}
      simulation={simulation}
      cameraFires={cameraFires}
      map={<MapWorkspace dashboard={dashboard} liveFires={liveFires} fireSpread={fireSpread} cameraFires={cameraFires} />}
    />
  );
}
