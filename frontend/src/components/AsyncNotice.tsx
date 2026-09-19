import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

export function AsyncNotice({ notice, onDismiss }: {
  notice: { tone: 'error' | 'success' | 'info'; message: string } | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;
  const Icon = notice.tone === 'error' ? XCircle : notice.tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`notice notice--${notice.tone}`} role="status">
      <Icon size={17} aria-hidden="true" />
      <span>{notice.message}</span>
      <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}><X size={16} /></button>
    </div>
  );
}

