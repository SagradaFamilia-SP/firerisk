import { useDashboard } from './hooks/useDashboard';
import { AppShell } from './features/shell/AppShell';
import { MapWorkspace } from './features/map/MapWorkspace';

export default function App() {
  const dashboard = useDashboard();
  return <AppShell dashboard={dashboard} map={<MapWorkspace dashboard={dashboard} />} />;
}
