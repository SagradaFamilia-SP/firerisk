import { Flame, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';

import { StatusPill } from '../../components/StatusPill';
import type { AsyncState } from '../../hooks/useDashboard';
import type { HealthResponse } from '../../types/api';

export function TopBar({ health }: { health: AsyncState<HealthResponse> }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const online = health.status === 'success';
  const modelOnline = online && health.data.model_online;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark"><Flame size={20} fill="currentColor" /></span>
        <span><strong>IGNIS</strong><small>Wildfire intelligence</small></span>
      </div>
      <div className="topbar__site"><Radio size={14} /><span>Talaván Norte</span><small>Cáceres · ES</small></div>
      <div className="topbar__status">
        <StatusPill tone={online ? 'online' : 'offline'}>{online ? 'API operativa' : 'API sin conexión'}</StatusPill>
        <StatusPill tone={modelOnline ? 'online' : 'neutral'}>{modelOnline ? 'Agente conectado' : 'Fallback preparado'}</StatusPill>
        <time dateTime={time.toISOString()}>{time.toISOString().slice(11, 19)} <small>UTC</small></time>
      </div>
    </header>
  );
}

