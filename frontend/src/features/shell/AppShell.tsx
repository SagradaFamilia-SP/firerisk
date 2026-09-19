import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { ChatPanel } from '../chat/ChatPanel';
import { CamerasWorkspace } from '../cameras/CamerasWorkspace';
import type { AsyncState, useDashboard } from '../../hooks/useDashboard';
import type { CameraFires } from '../../hooks/useCameraFires';
import type { Chat } from '../../hooks/useChat';
import type { FireReport } from '../../hooks/useFireReport';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { SimulationSpread } from '../../hooks/useSimulationSpread';
import { cameraDetectionId, cameraFireToDetection } from '../map/cameraFireToDetection';
import { CameraFireNotice } from '../map/CameraFireNotice';
import type { ReverseLocationResponse } from '../../types/api';
import { FireTable } from '../incidents/FireTable';
import { IntelligencePanel } from '../intelligence/IntelligencePanel';
import { Sidebar } from '../sidebar/Sidebar';
import { SimulationWorkspace } from '../simulation/SimulationWorkspace';
import { ReportDownloadModal } from './ReportDownloadModal';
import { TopBar } from './TopBar';

type Dashboard = ReturnType<typeof useDashboard>;
export type ActiveModule = 'map' | 'table' | 'chat' | 'simulation' | 'cameras';

export function AppShell({ dashboard, liveFires, fireSpread, reverseLocation, chat, fireReport, simulation, cameraFires, map }: {
  dashboard: Dashboard; liveFires: LiveFires; fireSpread: FireSpread;
  reverseLocation?: AsyncState<ReverseLocationResponse>; chat: Chat; fireReport: FireReport;
  simulation: SimulationSpread; cameraFires: CameraFires; map: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState<ActiveModule>('map');
  const hasSelectedFire = liveFires.selectedFireId !== null;
  // The telemetry panel is map chrome: keep the selection alive so it's still
  // there on return, but don't show it docked next to the incident table too.
  const showIntelligencePanel = hasSelectedFire && activeModule === 'map';
  const selectedFire = useMemo(() => {
    const detections = liveFires.state.data?.detections ?? [];
    const cameraDetections = cameraFires.fires.map(cameraFireToDetection);
    return [...detections, ...cameraDetections].find((fire) => fire.id === liveFires.selectedFireId) ?? null;
  }, [liveFires.state.data, liveFires.selectedFireId, cameraFires.fires]);
  const coordinates = selectedFire ? `${selectedFire.latitude.toFixed(4)}, ${selectedFire.longitude.toFixed(4)}` : null;
  const activeLocation = selectedFire
    ? reverseLocation?.status === 'success'
      ? `${reverseLocation.data.label} (${reverseLocation.data.coordinates})`
      : coordinates!
    : 'Vista sin foco seleccionado';
  const activeContext = selectedFire
    ? `${selectedFire.satellite} · ${selectedFire.confidence}${reverseLocation?.status === 'success' ? ' · © OpenStreetMap' : ''}`
    : 'NASA FIRMS';
  const viewCameraFireOnMap = (id: number) => {
    liveFires.setSelectedFireId(cameraDetectionId(id));
    setActiveModule('map');
    cameraFires.dismissNotification(id);
  };
  return (
    <div className="app-shell">
      <TopBar health={dashboard.health} location={activeLocation} context={activeContext} selected={selectedFire !== null} />
      <div className={`workspace ${sidebarCollapsed ? 'workspace--sidebar-collapsed' : ''} ${showIntelligencePanel ? 'workspace--with-intelligence' : 'workspace--map-only'}`}>
        <Sidebar
          layers={dashboard.layers}
          collapsed={sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed((current) => !current)}
          onToggleLayer={dashboard.toggleLayer}
          activeModule={activeModule}
          onSelectModule={setActiveModule}
        />
        <main className="map-region">
          <div style={{ display: activeModule === 'map' ? 'contents' : 'none' }}>{map}</div>
          {activeModule === 'table' && (
            <FireTable
              liveFires={liveFires}
              onSelectFire={(id) => { liveFires.setSelectedFireId(id); setActiveModule('map'); }}
            />
          )}
          {activeModule === 'chat' && <ChatPanel chat={chat} />}
          {activeModule === 'simulation' && <SimulationWorkspace simulation={simulation} />}
          {activeModule === 'cameras' && <CamerasWorkspace cameraFires={cameraFires} onViewOnMap={viewCameraFireOnMap} />}
        </main>
        {showIntelligencePanel && (
          <IntelligencePanel
            liveFires={liveFires}
            fireSpread={fireSpread}
            fireReport={fireReport}
            reverseLocation={reverseLocation}
            selectedFire={selectedFire}
            onClose={() => liveFires.setSelectedFireId(null)}
          />
        )}
      </div>
      <ReportDownloadModal fireReport={fireReport} />
      <CameraFireNotice notification={cameraFires.notification} onDismiss={cameraFires.dismissNotification} onViewOnMap={viewCameraFireOnMap} />
    </div>
  );
}
