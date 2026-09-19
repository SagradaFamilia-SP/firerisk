import { useDashboard } from './hooks/useDashboard';
import { AppShell } from './features/shell/AppShell';
import { MapWorkspace } from './features/map/MapWorkspace';
import { useLiveFires } from './hooks/useLiveFires';

export default function App() {
  const dashboard = useDashboard();
  const liveFires = useLiveFires();
  return <AppShell dashboard={dashboard} liveFires={liveFires} map={<MapWorkspace dashboard={dashboard} liveFires={liveFires} />} />;
}
