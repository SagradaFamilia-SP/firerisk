import { Droplets, Thermometer, Wind } from 'lucide-react';
import type { ScenarioInput } from '../../types/api';

export function WeatherMetrics({ scenario }: { scenario: ScenarioInput }) {
  const metrics = [
    { label: 'Temperatura', value: `${Math.round(scenario.temperature)}°`, unit: 'C', icon: Thermometer },
    { label: 'Humedad', value: `${Math.round(scenario.humidity)}`, unit: '%', icon: Droplets },
    { label: 'Viento', value: `${Math.round(scenario.wind_speed)}`, unit: 'km/h', icon: Wind },
  ];
  return <div className="metric-grid">{metrics.map(({ label, value, unit, icon: Icon }) => <article className="metric-card" key={label}><Icon size={15} /><span>{label}</span><strong>{value}<small>{unit}</small></strong></article>)}</div>;
}

