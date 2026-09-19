import type { ReactNode } from 'react';
import { useState } from 'react';

import type { AsyncState, useDashboard } from '../../hooks/useDashboard';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { ReverseLocationResponse } from '../../types/api';
import { IntelligencePanel } from '../intelligence/IntelligencePanel';
import { Sidebar } from '../sidebar/Sidebar';
import { TopBar } from './TopBar';

type Dashboard = ReturnType<typeof useDashboard>;

export function AppShell({ dashboard, liveFires, fireSpread, reverseLocation, map }: {
  dashboard: Dashboard; liveFires: LiveFires; fireSpread: FireSpread;
  reverseLocation?: AsyncState<ReverseLocationResponse>; map: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hasSelectedFire = liveFires.selectedFireId !== null;
  const selectedFire = liveFires.state.data?.detections.find((fire) => fire.id === liveFires.selectedFireId) ?? null;
  const coordinates = selectedFire ? `${selectedFire.latitude.toFixed(4)}, ${selectedFire.longitude.toFixed(4)}` : null;
  const activeLocation = selectedFire
    ? reverseLocation?.status === 'success'
      ? `${reverseLocation.data.label} (${reverseLocation.data.coordinates})`
      : coordinates!
    : 'Vista sin foco seleccionado';
  const activeContext = selectedFire
    ? `${selectedFire.satellite} · ${selectedFire.confidence}${reverseLocation?.status === 'success' ? ' · © OpenStreetMap' : ''}`
    : 'NASA FIRMS';
  return (
    <div className="app-shell">
      <TopBar health={dashboard.health} location={activeLocation} context={activeContext} selected={selectedFire !== null} />
      <div className={`workspace ${sidebarCollapsed ? 'workspace--sidebar-collapsed' : ''} ${hasSelectedFire ? 'workspace--with-intelligence' : 'workspace--map-only'}`}>
        <Sidebar
          layers={dashboard.layers}
          collapsed={sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed((current) => !current)}
          onToggleLayer={dashboard.toggleLayer}
        />
        <main className="map-region">{map}</main>
        {hasSelectedFire && <IntelligencePanel liveFires={liveFires} fireSpread={fireSpread} onClose={() => liveFires.setSelectedFireId(null)} />}
      </div>
    </div>
  );
}
