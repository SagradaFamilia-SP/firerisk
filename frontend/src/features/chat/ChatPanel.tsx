import { Bot, Loader2, Mic, Send, Square, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Chat } from '../../hooks/useChat';
import { renderMarkdown } from './markdown';
import { apiClient, getErrorMessage } from '../../services/api';
import type { FireConfidence } from '../../types/api';

const confidenceLabels: Record<FireConfidence, string> = { low: 'Baja', nominal: 'Nominal', high: 'Alta' };

const SUGGESTIONS = [
  '¿Qué incendios tengo en España?',
  '¿Hay incendios activos en Portugal?',
  'Incendios en las últimas 72 horas en Grecia',
];

export function ChatPanel({ chat }: { chat: Chat }) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.entries, chat.pending]);

  const submit = () => {
    if (!draft.trim() || chat.pending) return;
    chat.send(draft);
    setDraft('');
  };

  const startRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size === 0) return;
        setTranscribing(true);
        try {
          const { text } = await apiClient.transcribeAudio(audioBlob);
          if (text) setDraft((current) => (current ? `${current} ${text}` : text));
        } catch (error) {
          setVoiceError(getErrorMessage(error));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setVoiceError('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) stopRecording();
    else void startRecording();
  };

  return (
    <section className="chat-panel" aria-label="Chat asistente PYROS">
      <header className="chat-panel__header">
        <span><Bot size={16} /> Chat Asistente</span>
        <small>AI AGENT · NASA FIRMS en tiempo real</small>
      </header>

      <div className="chat-panel__scroll" ref={scrollRef}>
        {chat.entries.length === 0 && (
          <div className="chat-panel__empty">
            <p>Consulta incendios activos, zonas de riesgo y evolución del fuego en tiempo real.</p>
            <div className="chat-panel__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => chat.send(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
        )}

        {chat.entries.map((entry) => (
          <article key={entry.id} className={`chat-bubble chat-bubble--${entry.role}`}>
            <span className="chat-bubble__icon">{entry.role === 'user' ? <User size={14} /> : <Bot size={14} />}</span>
            <div className="chat-bubble__body">
              {entry.role === 'assistant'
                ? <div className="chat-bubble__markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }} />
                : <p>{entry.content}</p>}
              {entry.summary && (
                <div className="chat-bubble__meta">
                  <span>{entry.summary.region ?? 'Región no identificada'}</span>
                  <span>{entry.summary.count} focos · últimas {entry.summary.hours} h</span>
                  {entry.summary.narrative_source === 'fallback' && (
                    <span className="chat-bubble__tag">Informe automático</span>
                  )}
                  {entry.summary.narrative_source === 'unconfigured' && (
                    <span className="chat-bubble__tag chat-bubble__tag--error">Fuente no disponible</span>
                  )}
                </div>
              )}
              {entry.fires && entry.fires.length > 0 && (
                <ul className="chat-bubble__fires">
                  {entry.fires.slice(0, 8).map((fire) => (
                    <li key={fire.id}>
                      <span className={`confidence-badge confidence-badge--${fire.confidence}`}>
                        {confidenceLabels[fire.confidence]}
                      </span>
                      <span className="chat-bubble__fire-coords">{fire.latitude.toFixed(3)}, {fire.longitude.toFixed(3)}</span>
                      <span className="chat-bubble__fire-frp">{fire.frp !== null ? `${fire.frp.toFixed(1)} MW` : 'FRP N/D'}</span>
                    </li>
                  ))}
                  {entry.fires.length > 8 && <li className="chat-bubble__fires-more">+{entry.fires.length - 8} focos más</li>}
                </ul>
              )}
            </div>
          </article>
        ))}

        {chat.pending && (
          <article className="chat-bubble chat-bubble--assistant chat-bubble--pending">
            <span className="chat-bubble__icon"><Bot size={14} /></span>
            <div className="chat-bubble__body"><p>Consultando NASA FIRMS…</p></div>
          </article>
        )}
      </div>

      {chat.error && <p className="data-error" role="alert">{chat.error}</p>}
      {voiceError && <p className="data-error" role="alert">{voiceError}</p>}

      <form
        className="chat-panel__composer"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <input
          type="text"
          placeholder={recording ? 'Escuchando…' : 'Pregunta por incendios en un país…'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={chat.pending || transcribing}
        />
        <button
          type="button"
          className={`chat-panel__mic ${recording ? 'is-recording' : ''}`}
          onClick={toggleRecording}
          disabled={chat.pending || transcribing}
          aria-label={recording ? 'Detener grabación' : 'Grabar mensaje de voz'}
        >
          {transcribing ? <Loader2 size={16} className="chat-panel__spin" /> : recording ? <Square size={16} /> : <Mic size={16} />}
        </button>
        <button type="submit" disabled={chat.pending || !draft.trim()} aria-label="Enviar mensaje">
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
