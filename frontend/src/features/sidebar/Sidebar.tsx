import { Bot, ChevronsLeft, ChevronsRight, Flame, Info, Map, PanelsTopLeft } from 'lucide-react';

import type { LayerKey } from '../../hooks/useDashboard';
import { LayerControls } from './LayerControls';

export function Sidebar({ layers, collapsed, onCollapseToggle, onToggleLayer }: {
  layers: Record<LayerKey, boolean>;
  collapsed: boolean; onCollapseToggle: () => void; onToggleLayer: (layer: LayerKey) => void;
}) {
  return (
    <aside className={`sidebar tactical-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Contexto territorial">
      <div className="sidebar-brand">
        <span className="brand__mark"><Flame size={20} fill="currentColor" /></span>
        <span className="brand__copy">
          <span><strong>IGNIS</strong><b>v2.4</b></span>
          <small>WILDFIRE INTELLIGENCE</small>
        </span>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={collapsed ? 'Expandir menú' : 'Plegar menú'}
          aria-expanded={!collapsed}
          onClick={onCollapseToggle}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>
      <nav className="module-nav" aria-label="Módulos operativos">
        <span className="module-nav__label">Módulos Operativos</span>
        <a className="module-item is-active" href="#mapa" aria-current="page">
          <span><Map size={18} /><span className="module-item__text">Mapa</span></span><b>ACTIVO</b>
        </a>
        <a className="module-item" href="#incendios">
          <span><Flame size={18} /><span className="module-item__text">Tabla de incendios</span></span><b className="module-item__alert">LIVE</b>
        </a>
        <a className="module-item" href="#simulacion">
          <span><PanelsTopLeft size={18} /><span className="module-item__text">Simulación de incendios</span></span><small>FARSITE</small>
        </a>
        <a className="module-item" href="#chat">
          <span><Bot size={18} /><span className="module-item__text">Chat Asistente</span></span><small>AI AGENT</small>
        </a>
        <a className="module-item" href="#about">
          <span><Info size={18} /><span className="module-item__text">About</span></span><small>v2.4.1</small>
        </a>
      </nav>
      <LayerControls layers={layers} onToggle={onToggleLayer} />
    </aside>
  );
}
