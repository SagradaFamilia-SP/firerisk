import type { ReactNode } from 'react';

import { AsyncNotice } from '../../components/AsyncNotice';
import type { useDashboard } from '../../hooks/useDashboard';
import type { LiveFires } from '../../hooks/useLiveFires';
import { IntelligencePanel } from '../intelligence/IntelligencePanel';
import { Sidebar } from '../sidebar/Sidebar';
import { TopBar } from './TopBar';

type Dashboard = ReturnType<typeof useDashboard>;

export function AppShell({ dashboard, liveFires, map }: { dashboard: Dashboard; liveFires: LiveFires; map: ReactNode }) {
  return (
    <div className="app-shell">
      <TopBar health={dashboard.health} />
      <div className="workspace">
        <Sidebar
          simulation={dashboard.simulation.data}
          updating={dashboard.simulation.status === 'loading'}
          layers={dashboard.layers}
          selectedAssetId={dashboard.selectedAssetId}
          onToggleLayer={dashboard.toggleLayer}
          onSelectAsset={dashboard.setSelectedAssetId}
        />
        <main className="map-region">{map}</main>
        <IntelligencePanel scenario={dashboard.scenario} simulation={dashboard.simulation.data} plan={dashboard.plan} liveFires={liveFires} onGeneratePlan={dashboard.generatePlan} />
      </div>
      <AsyncNotice notice={dashboard.notice} onDismiss={dashboard.dismissNotice} />
    </div>
  );
}
