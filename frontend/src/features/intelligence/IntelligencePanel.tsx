import { X } from 'lucide-react';

import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import { LiveFirePanel } from './LiveFirePanel';

export function IntelligencePanel({ liveFires, fireSpread, onClose }: { liveFires: LiveFires; fireSpread: FireSpread; onClose: () => void }) {
  return (
    <aside className="intelligence" aria-label="Inteligencia operativa">
      <header className="intelligence-header">
        <span>#215 · TELEMETRÍA</span>
        <button type="button" aria-label="Cerrar ventana de telemetría" onClick={onClose}><X size={18} /></button>
      </header>
      <LiveFirePanel liveFires={liveFires} fireSpread={fireSpread} />
    </aside>
  );
}
