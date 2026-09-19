import { Video, X } from 'lucide-react';

import { apiUrl } from '../../services/api';

export function VonageYoloStreamButton({ open, onOpen, onClose, recordingUrl }: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  recordingUrl?: string | null;
}) {
  const hasRecording = Boolean(recordingUrl);
  return (
    <>
      <button
        type="button"
        className="vonage-stream-trigger"
        aria-label="Abrir streaming Vonage YOLO"
        title={hasRecording ? 'Ver grabación del fuego detectado' : 'Abrir streaming Vonage YOLO'}
        onClick={onOpen}
      >
        <Video size={17} />
      </button>

      {open && (
        <div className="vonage-stream-modal" role="dialog" aria-modal="true" aria-label="Vonage connected streaming">
          <div className="vonage-stream-modal__panel">
            <header className="vonage-stream-modal__header">
              <div>
                <span>{hasRecording ? 'Grabación guardada' : 'Vonage connected'}</span>
                <strong>{hasRecording ? 'Fuego detectado por cámara' : 'Real time camera feed'}</strong>
              </div>
              <button type="button" aria-label="Cerrar streaming Vonage YOLO" onClick={onClose}>
                <X size={17} />
              </button>
            </header>

            {recordingUrl ? (
              <video controls autoPlay src={apiUrl(recordingUrl)} />
            ) : (
              <iframe
                title="Vonage YOLO real time camera"
                src={apiUrl('/video/camera')}
                allow="autoplay; camera"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
