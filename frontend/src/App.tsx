import { useDashboard } from './hooks/useDashboard';
import { useChat } from './hooks/useChat';
import { AppShell } from './features/shell/AppShell';
import { MapWorkspace } from './features/map/MapWorkspace';
import { useFireReport } from './hooks/useFireReport';
import { useFireSpread } from './hooks/useFireSpread';
import { useLiveFires } from './hooks/useLiveFires';
import { useReverseLocation } from './hooks/useReverseLocation';
import { useSimulationSpread } from './hooks/useSimulationSpread';

export default function App() {
  const dashboard = useDashboard();
  const liveFires = useLiveFires();
  const fireSpread = useFireSpread(liveFires);
  const chat = useChat();
  const simulation = useSimulationSpread();
  const selectedFire = liveFires.state.data?.detections.find((fire) => fire.id === liveFires.selectedFireId) ?? null;
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
      map={<MapWorkspace dashboard={dashboard} liveFires={liveFires} fireSpread={fireSpread} />}
    />
  );
}
