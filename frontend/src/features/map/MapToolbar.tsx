import { Crosshair, Globe2, Map, Satellite } from 'lucide-react';

export function MapToolbar({ baseMap, onBaseMap, onCenter, onGlobal }: {
  baseMap: 'satellite' | 'street';
  onBaseMap: (mode: 'satellite' | 'street') => void; onCenter: () => void; onGlobal: () => void;
}) {
  return (
    <div className="map-toolbar">
      <div className="map-toolbar__group">
        <button type="button" className="map-action map-action--icon" aria-label="Centrar mapa" onClick={onCenter}><Crosshair size={16} /></button>
        <button type="button" className="map-action map-action--icon" aria-label="Vista global de incendios" onClick={onGlobal}><Globe2 size={16} /></button>
      </div>
      <div className="map-toolbar__group map-switch">
        <button type="button" className={baseMap === 'satellite' ? 'is-active' : ''} onClick={() => onBaseMap('satellite')}><Satellite size={14} /> Satélite</button>
        <button type="button" className={baseMap === 'street' ? 'is-active' : ''} onClick={() => onBaseMap('street')}><Map size={14} /> Mapa</button>
      </div>
    </div>
  );
}
