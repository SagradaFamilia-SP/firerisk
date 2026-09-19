import { X } from 'lucide-react';

import type { AsyncState } from '../../hooks/useDashboard';
import type { FireReport } from '../../hooks/useFireReport';
import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import type { ReverseLocationResponse } from '../../types/api';
import { LiveFirePanel } from './LiveFirePanel';

export function IntelligencePanel({ liveFires, fireSpread, fireReport, reverseLocation, onClose }: {
  liveFires: LiveFires; fireSpread: FireSpread; fireReport: FireReport;
  reverseLocation?: AsyncState<ReverseLocationResponse>; onClose: () => void;
}) {
  return (
    <aside className="intelligence" aria-label="Inteligencia operativa">
      <header className="intelligence-header">
        <span>#215 · TELEMETRÍA</span>
        <button type="button" aria-label="Cerrar ventana de telemetría" onClick={onClose}><X size={18} /></button>
      </header>
      <LiveFirePanel liveFires={liveFires} fireSpread={fireSpread} fireReport={fireReport} reverseLocation={reverseLocation} />
    </aside>
  );
}
