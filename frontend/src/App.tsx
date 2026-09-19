import { useDashboard } from './hooks/useDashboard';
import { AppShell } from './features/shell/AppShell';
import { MapWorkspace } from './features/map/MapWorkspace';
import { useFireSpread } from './hooks/useFireSpread';
import { useLiveFires } from './hooks/useLiveFires';
import { useReverseLocation } from './hooks/useReverseLocation';

export default function App() {
  const dashboard = useDashboard();
  const liveFires = useLiveFires();
  const fireSpread = useFireSpread(liveFires);
  const selectedFire = liveFires.state.data?.detections.find((fire) => fire.id === liveFires.selectedFireId) ?? null;
  const reverseLocation = useReverseLocation(selectedFire);
  return (
    <AppShell
      dashboard={dashboard}
      liveFires={liveFires}
      fireSpread={fireSpread}
      reverseLocation={reverseLocation}
      map={<MapWorkspace dashboard={dashboard} liveFires={liveFires} fireSpread={fireSpread} />}
    />
  );
}
