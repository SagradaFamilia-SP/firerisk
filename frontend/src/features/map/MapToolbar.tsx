import { CloudSun, Crosshair, Flame, LoaderCircle, Map, Satellite } from 'lucide-react';

export function MapToolbar({ baseMap, weatherLoading, onBaseMap, onCritical, onWeather, onCenter }: {
  baseMap: 'satellite' | 'street'; weatherLoading: boolean;
  onBaseMap: (mode: 'satellite' | 'street') => void; onCritical: () => void; onWeather: () => void; onCenter: () => void;
}) {
  return (
    <div className="map-toolbar">
      <div className="map-toolbar__group">
        <button type="button" className="map-action map-action--critical" onClick={onCritical}><Flame size={15} /> Escenario crítico</button>
        <button type="button" className="map-action" disabled={weatherLoading} onClick={onWeather}>{weatherLoading ? <LoaderCircle className="spin" size={15} /> : <CloudSun size={15} />} Meteorología real</button>
        <button type="button" className="map-action map-action--icon" aria-label="Centrar instalación" onClick={onCenter}><Crosshair size={16} /></button>
      </div>
      <div className="map-toolbar__group map-switch">
        <button type="button" className={baseMap === 'satellite' ? 'is-active' : ''} onClick={() => onBaseMap('satellite')}><Satellite size={14} /> Satélite</button>
        <button type="button" className={baseMap === 'street' ? 'is-active' : ''} onClick={() => onBaseMap('street')}><Map size={14} /> Mapa</button>
      </div>
    </div>
  );
}

