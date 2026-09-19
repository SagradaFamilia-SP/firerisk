import type { FireReport } from '../../hooks/useFireReport';

export function ReportDownloadModal({ fireReport }: { fireReport: FireReport }) {
  if (!fireReport.pendingDownload || fireReport.status === 'ready') return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Generando informe">
      <div className="modal-card">
        {fireReport.status === 'error' ? (
          <>
            <h2>No se pudo generar el informe</h2>
            <p>{fireReport.error ?? 'Inténtalo de nuevo en unos segundos.'}</p>
            <button type="button" onClick={fireReport.dismiss}>Cerrar</button>
          </>
        ) : (
          <>
            <div className="modal-card__spinner" aria-hidden="true" />
            <h2>Generando informe…</h2>
            <p>Recopilando telemetría, ubicación y simulación de propagación.</p>
          </>
        )}
      </div>
    </div>
  );
}
