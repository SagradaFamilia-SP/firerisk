import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ForecastTimeline({ hour, onChange }: { hour: number; onChange: (hour: number) => void }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => onChange(hour >= 12 ? 0 : hour + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [hour, onChange, playing]);
  return (
    <div className="forecast">
      <button type="button" aria-label={playing ? 'Pausar previsión' : 'Reproducir previsión'} onClick={() => setPlaying((current) => !current)}>{playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
      <div className="forecast__body"><div><strong>{hour === 0 ? 'Ahora' : `+${hour} horas`}</strong><span>Horizonte de propagación</span></div><input aria-label="Horizonte de previsión" type="range" min="0" max="12" value={hour} onChange={(event) => onChange(Number(event.target.value))} /><div className="forecast__ticks"><span>Ahora</span><span>+3h</span><span>+6h</span><span>+9h</span><span>+12h</span></div></div>
    </div>
  );
}

