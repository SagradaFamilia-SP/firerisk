import { useState } from 'react';

import type { useDashboard } from '../../hooks/useDashboard';
import type { CameraFires } from '../../hooks/useCameraFires';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import { cameraDetectionId } from './cameraFireToDetection';
import { FireRiskMap } from './FireRiskMap';
import { ForecastTimeline } from './ForecastTimeline';
import { MapToolbar } from './MapToolbar';
import { sampleFiresForRender } from './sampleFires';
import { VonageYoloStreamButton } from './VonageYoloStreamModal';

type Dashboard = ReturnType<typeof useDashboard>;

export function MapWorkspace({ dashboard, liveFires, fireSpread, cameraFires }: {
  dashboard: Dashboard; liveFires: LiveFires; fireSpread: FireSpread; cameraFires: CameraFires;
}) {
  const [centerKey, setCenterKey] = useState(0);
  const [view, setView] = useState<'site' | 'global'>('global');
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const hasSelectedFire = Boolean(liveFires.selectedFireId);
  const selectedCameraFire = cameraFires.fires.find((fire) => cameraDetectionId(fire.id) === liveFires.selectedFireId) ?? null;
  const sampledFires = sampleFiresForRender(liveFires.state.data?.detections ?? []);
  const activeFireCount = (liveFires.state.data?.detections.length ?? 0) + cameraFires.fires.length;

  return (
    <div className="map-workspace">
      <div className="map-total-fires">
        <strong>{activeFireCount.toLocaleString('es-ES')}</strong>
        <span>incendios activos</span>
      </div>
      <FireRiskMap
        key={`${view}-${centerKey}`}
        layers={dashboard.layers}
        baseMap={dashboard.baseMap}
        initialView={view}
        fires={sampledFires}
        cameraFires={cameraFires.fires}
        selectedFireId={liveFires.selectedFireId}
        onSelectFire={liveFires.setSelectedFireId}
        onViewport={liveFires.updateViewport}
        fireSpread={fireSpread}
        followSpread={timelinePlaying}
      />
      <MapToolbar
        baseMap={dashboard.baseMap}
        onBaseMap={dashboard.setBaseMap}
        onCenter={() => { setView('site'); setCenterKey((key) => key + 1); }}
        onGlobal={() => { setView('global'); setCenterKey((key) => key + 1); }}
      />
      {hasSelectedFire && (
        <VonageYoloStreamButton
          open={streamOpen}
          onOpen={() => setStreamOpen(true)}
          onClose={() => setStreamOpen(false)}
          recordingUrl={selectedCameraFire?.recording_url ?? null}
        />
      )}
      {fireSpread.data && <ForecastTimeline hour={fireSpread.hour} onChange={fireSpread.setHour} onPlayingChange={setTimelinePlaying} />}
      {fireSpread.status === 'loading' && <span className="map-updating">Calculando propagación…</span>}
    </div>
  );
}
