import { useDashboard } from './hooks/useDashboard';
import { AppShell } from './features/shell/AppShell';
import { MapWorkspace } from './features/map/MapWorkspace';
import { useFireSpread } from './hooks/useFireSpread';
import { useLiveFires } from './hooks/useLiveFires';

export default function App() {
  const dashboard = useDashboard();
  const liveFires = useLiveFires();
  const fireSpread = useFireSpread(liveFires);
  return (
    <AppShell
      dashboard={dashboard}
      liveFires={liveFires}
      fireSpread={fireSpread}
      map={<MapWorkspace dashboard={dashboard} liveFires={liveFires} fireSpread={fireSpread} />}
    />
  );
}
