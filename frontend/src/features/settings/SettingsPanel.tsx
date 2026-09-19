import { Bell, Database, Flame, Gauge, Globe2, Map, Radar, Route, Satellite, SlidersHorizontal, X } from 'lucide-react';

import type { LayerKey } from '../../hooks/useDashboard';

const layerItems: Array<{ id: LayerKey; label: string; icon: typeof Flame }> = [
  { id: 'fire', label: 'NASA FIRMS · VIIRS', icon: Flame },
  { id: 'spread', label: 'Propagación estimada', icon: Route },
];

const configSections = [
  {
    icon: Satellite,
    title: 'Fuentes satelitales',
    rows: ['NOAA-20 y NOAA-21 activos', 'Ventana FIRMS últimas 24 h', 'Confianza mínima configurable'],
  },
  {
    icon: Map,
    title: 'Mapa y visualización',
    rows: ['Vista satélite/mapa base', 'Zoom automático al foco', 'Escala visual por FRP y brillo'],
  },
  {
    icon: SlidersHorizontal,
    title: 'Simulación',
    rows: ['Velocidad de reproducción', 'Sensibilidad FRP/brillo', 'Horizonte de propagación +6 h'],
  },
  {
    icon: Bell,
    title: 'Alertas operativas',
    rows: ['Umbral crítico de potencia', 'Radio de impacto sobre activos', 'Protocolo de contingencia'],
  },
  {
    icon: Globe2,
    title: 'Ubicación y geocoding',
    rows: ['Población y municipio', 'Coordenadas visibles', 'Atribución OpenStreetMap'],
  },
  {
    icon: Database,
    title: 'Datos y sincronización',
    rows: ['Estado API/FIRMS', 'Refresco automático', 'Caché y fallback local'],
  },
];

export function SettingsPanel({ layers, onToggleLayer, onClose }: {
  layers: Record<LayerKey, boolean>;
  onToggleLayer: (layer: LayerKey) => void;
  onClose: () => void;
}) {
  const activeLayerCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="settings-overlay" role="presentation" onClick={onClose}>
      <section
        className="settings-panel settings-panel--floating"
        role="dialog"
        aria-modal="true"
        aria-label="Configuración operativa"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="about-panel__header">
          <div>
            <span className="eyebrow">Control operacional</span>
            <h1>Configuración de detección y respuesta</h1>
          </div>
          <button type="button" className="settings-close" aria-label="Cerrar configuración" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <section className="settings-section settings-section--layers">
          <div className="settings-section__heading">
            <span><Radar size={18} /> Capas operativas</span>
            <b>{activeLayerCount}/2</b>
          </div>
          <div className="settings-layer-list">
            {layerItems.map(({ id, label, icon: Icon }) => (
              <label className="settings-toggle-row" key={id}>
                <span><Icon size={18} /> {label}</span>
                <input type="checkbox" checked={layers[id]} onChange={() => onToggleLayer(id)} />
                <i aria-hidden="true" />
              </label>
            ))}
          </div>
        </section>

        <div className="settings-grid">
          {configSections.map(({ icon: Icon, title, rows }) => (
            <section className="settings-section" key={title}>
              <h2><Icon size={17} /> {title}</h2>
              <ul>
                {rows.map((row) => <li key={row}><Gauge size={13} /> {row}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
