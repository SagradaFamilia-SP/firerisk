import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { StatusPill } from '../../components/StatusPill';
import type { AsyncState } from '../../hooks/useDashboard';
import type { HealthResponse } from '../../types/api';

export function TopBar({ health, location, context, selected, badgeLabel }: {
  health: AsyncState<HealthResponse>; location: string; context: string; selected: boolean; badgeLabel?: string;
}) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const online = health.status === 'success';
  const modelOnline = online && health.data.model_online;
  return (
    <header className="topbar">
      <div className="topbar__site">
        <span className="topbar__live" aria-hidden="true" />
        <strong>{location}</strong>
        <span>· {context}</span>
        <b>{badgeLabel ?? (selected ? 'FOCO SELECCIONADO' : 'MONITORIZACIÓN')}</b>
      </div>
      <div className="topbar__status">
        <StatusPill tone={online ? 'online' : 'offline'}>{online ? 'API OPERATIVA' : 'API SIN CONEXIÓN'}</StatusPill>
        <StatusPill tone={modelOnline ? 'online' : 'neutral'}>{modelOnline ? 'AGENTE CONECTADO' : 'FALLBACK PREPARADO'}</StatusPill>
        <time dateTime={time.toISOString()}><MapPin size={12} aria-hidden="true" />{time.toISOString().slice(11, 19)} <small>UTC</small></time>
      </div>
    </header>
  );
}
