import type { FireSpread } from '../../hooks/useFireSpread';
import type { LiveFires } from '../../hooks/useLiveFires';
import { LiveFirePanel } from './LiveFirePanel';

export function IntelligencePanel({ liveFires, fireSpread }: { liveFires: LiveFires; fireSpread: FireSpread }) {
  return (
    <aside className="intelligence" aria-label="Inteligencia operativa">
      <LiveFirePanel liveFires={liveFires} fireSpread={fireSpread} />
    </aside>
  );
}
