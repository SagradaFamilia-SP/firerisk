import type { ReactNode } from 'react';

import type { useDashboard } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import { IntelligencePanel } from '../intelligence/IntelligencePanel';
import { Sidebar } from '../sidebar/Sidebar';
import { TopBar } from './TopBar';

type Dashboard = ReturnType<typeof useDashboard>;

export function AppShell({ dashboard, liveFires, fireSpread, map }: {
  dashboard: Dashboard; liveFires: LiveFires; fireSpread: FireSpread; map: ReactNode;
}) {
  return (
    <div className="app-shell">
      <TopBar health={dashboard.health} />
      <div className="workspace">
        <Sidebar layers={dashboard.layers} onToggleLayer={dashboard.toggleLayer} />
        <main className="map-region">{map}</main>
        <IntelligencePanel liveFires={liveFires} fireSpread={fireSpread} />
      </div>
    </div>
  );
}
