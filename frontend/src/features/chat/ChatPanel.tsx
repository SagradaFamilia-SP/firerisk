import { Bot, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Chat } from '../../hooks/useChat';
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.entries, chat.pending]);

  const submit = () => {
    if (!draft.trim() || chat.pending) return;
    chat.send(draft);
    setDraft('');
  };

  return (
    <section className="chat-panel" aria-label="Chat asistente IGNIS">
      <header className="chat-panel__header">
        <span><Bot size={16} /> Chat Asistente</span>
        <small>AI AGENT · NASA FIRMS en tiempo real</small>
      </header>

      <div className="chat-panel__scroll" ref={scrollRef}>
        {chat.entries.length === 0 && (
          <div className="chat-panel__empty">
            <p>Pregunta por incendios activos en un país cubierto: España, Portugal, Francia, Italia o Grecia.</p>
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
              <p>{entry.content}</p>
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

      <form
        className="chat-panel__composer"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <input
          type="text"
          placeholder="Pregunta por incendios en un país…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={chat.pending}
        />
        <button type="submit" disabled={chat.pending || !draft.trim()} aria-label="Enviar mensaje">
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
