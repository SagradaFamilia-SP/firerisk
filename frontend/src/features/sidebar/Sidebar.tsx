import { Bot, ChevronsLeft, ChevronsRight, Flame, Info, LogOut, Map, PanelsTopLeft, Settings } from 'lucide-react';

import type { LayerKey } from '../../hooks/useDashboard';
import type { ActiveModule } from '../shell/AppShell';
import { LayerControls } from './LayerControls';

export function Sidebar({ layers, collapsed, onCollapseToggle, onToggleLayer, activeModule, onSelectModule }: {
  layers: Record<LayerKey, boolean>;
  collapsed: boolean; onCollapseToggle: () => void; onToggleLayer: (layer: LayerKey) => void;
  activeModule: ActiveModule; onSelectModule: (module: ActiveModule) => void;
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
        <button type="button" className={`module-item ${activeModule === 'map' ? 'is-active' : ''}`} aria-current={activeModule === 'map' ? 'page' : undefined} onClick={() => onSelectModule('map')}>
          <span><Map size={18} /><span className="module-item__text">Mapa</span></span>{activeModule === 'map' && <b>ACTIVO</b>}
        </button>
        <button type="button" className={`module-item ${activeModule === 'table' ? 'is-active' : ''}`} aria-current={activeModule === 'table' ? 'page' : undefined} onClick={() => onSelectModule('table')}>
          <span><Flame size={18} /><span className="module-item__text">Tabla de incendios</span></span>{activeModule === 'table' ? <b>ACTIVO</b> : <b className="module-item__alert">LIVE</b>}
        </button>
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
      <footer className="sidebar-profile">
        <div className="sidebar-profile__avatar" aria-hidden="true">YK<i /></div>
        <div className="sidebar-profile__info">
          <span><strong>Yasine K.</strong><b>L3</b></span>
          <small>Operador Centro Mando</small>
        </div>
        <div className="sidebar-profile__actions">
          <button type="button" aria-label="Configuración"><Settings size={16} /></button>
          <button type="button" aria-label="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </footer>
    </aside>
  );
}
