import type { ReactNode } from 'react';

export function StatusPill({ tone, children }: { tone: 'online' | 'offline' | 'critical' | 'neutral'; children: ReactNode }) {
  return <span className={`status-pill status-pill--${tone}`}><i aria-hidden="true" />{children}</span>;
}

