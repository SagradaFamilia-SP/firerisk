import {
  ArrowRight, Bot, Camera, CheckCircle2, ChevronRight, Cpu, FileDown,
  Flame, Globe2, Map as MapIcon, Radar, Satellite, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import pyrosLogo from '../../assets/pyros-logo.png';
import pyrosMark from '../../assets/pyros-mark.svg';
import { apiClient } from '../../services/api';
import './LandingPage.css';

// Spain's mainland bounding box, matching the chat assistant's own region
// gazetteer — a real, live number is a stronger opener than a made-up one.
const SPAIN_BBOX = { west: -9.9, south: 35.9, east: 4.5, north: 43.9, zoom: 6 } as const;

type HeroStat = { status: 'loading' | 'ready' | 'error'; count: number };

function useLiveSpainCount(): HeroStat {
  const [stat, setStat] = useState<HeroStat>({ status: 'loading', count: 0 });
  useEffect(() => {
    const controller = new AbortController();
    apiClient.fires(
      SPAIN_BBOX,
      { hours: 24, sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'], minConfidence: 'low' },
      controller.signal,
    ).then(
      (data) => setStat({ status: 'ready', count: data.meta.count }),
      () => setStat({ status: 'error', count: 0 }),
    );
    return () => controller.abort();
  }, []);
  return stat;
}

const FEATURES = [
  {
    icon: Satellite,
    title: 'Detección satelital NASA FIRMS',
    body: 'Anomalías térmicas VIIRS de NOAA-20/21 en tiempo casi real, sobre cualquier región del planeta, sin instalar nada en el terreno.',
  },
  {
    icon: Camera,
    title: 'Detección por cámara con IA',
    body: 'Cualquier cámara IP o webcam se convierte en un sensor de incendios: YOLO analiza el vídeo en directo y dispara la alerta en segundos.',
  },
  {
    icon: Radar,
    title: 'Simulación de propagación',
    body: 'Modelo físico (Rothermel) con viento, humedad, combustible y terreno reales para proyectar el frente de fuego hora a hora.',
  },
  {
    icon: Bot,
    title: 'Asistente operativo con IA',
    body: 'Pregunta en lenguaje natural — "incendios activos en España" — y recibe un informe redactado al instante, sin filtrar tablas a mano.',
  },
  {
    icon: FileDown,
    title: 'Informes listos para el terreno',
    body: 'Cada foco genera un PDF operativo con ubicación, intensidad, propagación estimada y recomendación, listo para compartir en segundos.',
  },
  {
    icon: MapIcon,
    title: 'Un único centro de mando',
    body: 'Mapa, tabla de incidentes, cámaras y simulación conviven en la misma consola — sin saltar entre herramientas durante una emergencia.',
  },
] as const;

const STEPS = [
  { title: 'Detecta', body: 'Satélite y cámaras alimentan el mismo panel en tiempo real, sin intervención manual.' },
  { title: 'Analiza', body: 'La IA cruza intensidad, confianza y contexto para priorizar qué focos requieren atención ya.' },
  { title: 'Simula', body: 'Cada foco relevante lanza automáticamente su proyección de propagación a 12 horas.' },
  { title: 'Actúa', body: 'Informe descargable y ubicación exacta listos para el equipo de campo en un clic.' },
] as const;

const SHOWCASE = [
  { src: '/landing/map.webp', alt: 'Mapa táctico con focos NASA FIRMS y cámaras', title: 'Mapa táctico en vivo', body: 'Focos satelitales y detecciones de cámara sobre el mismo mapa, con foco automático al seleccionar un incidente.' },
  { src: '/landing/simulation.webp', alt: 'Simulación de propagación de incendio', title: 'Simulación de propagación', body: 'Proyección física del frente de fuego con línea de tiempo reproducible hasta +12 horas.' },
  { src: '/landing/chat.webp', alt: 'Asistente de IA conversacional', title: 'Asistente conversacional', body: 'Consultas en lenguaje natural sobre cualquier país cubierto, con datos reales citados en cada respuesta.' },
] as const;

const STACK = [
  'NASA FIRMS · VIIRS', 'Vonage Video API', 'YOLO / Ultralytics', 'Qwen · vLLM',
  'SLNG · Speech-to-Text', 'ESA WorldCover', 'Copernicus GLO-90 DEM', 'Open-Meteo',
];

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const stat = useLiveSpainCount();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav__brand">
          <img src={pyrosLogo} alt="PYROS" />
        </div>
        <nav className="landing-nav__links">
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#tecnologia">Tecnología</a>
        </nav>
        <div className="landing-nav__actions">
          <button type="button" className="landing-btn landing-btn--primary" onClick={onEnter}>
            Entrar a la plataforma <ArrowRight size={15} />
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <img className="landing-hero__mark" src={pyrosMark} alt="" aria-hidden="true" />
          <div className="landing-hero__content">
            <span className="landing-hero__eyebrow"><Sparkles size={13} /> Inteligencia operativa de incendios forestales</span>
            <h1>Detecta, simula y actúa antes de que el fuego decida por ti.</h1>
            <p>
              PYROS unifica satélite, cámaras con IA y simulación física de propagación en un único centro de mando,
              para que un equipo de guardia decida en minutos, no en horas.
            </p>
            <div className="landing-hero__actions">
              <button type="button" className="landing-btn landing-btn--primary landing-btn--lg" onClick={onEnter}>
                Entrar a la plataforma <ArrowRight size={17} />
              </button>
              <a className="landing-btn landing-btn--ghost landing-btn--lg" href="#funcionalidades">
                Ver funcionalidades <ChevronRight size={16} />
              </a>
            </div>
            <div className="landing-hero__stat" role="status">
              <span className="landing-hero__stat-dot" aria-hidden="true" />
              {stat.status === 'ready' && (
                <span><strong>{stat.count.toLocaleString('es-ES')}</strong> focos térmicos activos ahora mismo en España · NASA FIRMS en vivo</span>
              )}
              {stat.status === 'loading' && <span>Consultando NASA FIRMS en vivo…</span>}
              {stat.status === 'error' && <span>Datos de NASA FIRMS actualizados cada pocos minutos, en directo dentro de la plataforma.</span>}
            </div>
          </div>
          <div className="landing-hero__frame">
            <div className="landing-hero__frame-bar"><span /><span /><span /></div>
            <img src="/landing/map.webp" alt="Vista previa del mapa táctico de PYROS" />
          </div>
        </section>

        <section className="landing-stack" aria-label="Tecnología integrada">
          <span>Construido sobre datos y modelos reales</span>
          <div className="landing-stack__row">
            {STACK.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section id="funcionalidades" className="landing-section">
          <div className="landing-section__head">
            <span className="eyebrow">Funcionalidades</span>
            <h2>Todo lo que un puesto de mando necesita, en un solo sitio</h2>
            <p>Nada de exportar CSVs ni cambiar de pestaña en mitad de una emergencia: cada capa de información habla con las demás.</p>
          </div>
          <div className="landing-features">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="landing-feature-card">
                <div className="landing-feature-card__icon"><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="landing-section landing-section--alt">
          <div className="landing-section__head">
            <span className="eyebrow">Cómo funciona</span>
            <h2>De la primera anomalía térmica a la decisión operativa</h2>
          </div>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="landing-steps__index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section">
          <div className="landing-section__head">
            <span className="eyebrow">La plataforma</span>
            <h2>Diseñada para decidir bajo presión, no para impresionar en una demo</h2>
          </div>
          <div className="landing-showcase">
            {SHOWCASE.map((item) => (
              <figure key={item.src} className="landing-showcase__item">
                <div className="landing-hero__frame landing-showcase__frame">
                  <div className="landing-hero__frame-bar"><span /><span /><span /></div>
                  <img src={item.src} alt={item.alt} loading="lazy" />
                </div>
                <figcaption>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="tecnologia" className="landing-section landing-section--alt">
          <div className="landing-trust">
            <div className="landing-trust__item"><ShieldCheck size={18} /><span>Datos oficiales, sin intermediarios: NASA FIRMS directo, sin muestreo ni retraso artificial.</span></div>
            <div className="landing-trust__item"><Cpu size={18} /><span>Modelos físicos reales (Rothermel, Byram), no una animación bonita sin fundamento.</span></div>
            <div className="landing-trust__item"><Globe2 size={18} /><span>Cobertura global de detección satelital; el flujo de cámaras funciona en cualquier ubicación.</span></div>
            <div className="landing-trust__item"><CheckCircle2 size={18} /><span>Cada informe cita sus propias fuentes y limitaciones — pensado para uso operativo, no solo visual.</span></div>
          </div>
        </section>

        <section className="landing-cta">
          <Flame size={26} />
          <h2>Tu próximo incendio no va a esperar a que abras seis pestañas.</h2>
          <p>Entra ahora y ve el estado real del territorio que te importa.</p>
          <button type="button" className="landing-btn landing-btn--primary landing-btn--lg" onClick={onEnter}>
            Entrar a la plataforma <ArrowRight size={17} />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <img src={pyrosLogo} alt="PYROS" />
        <p>
          PYROS es una plataforma de apoyo a la decisión operativa. Los datos de NASA FIRMS reflejan anomalías térmicas
          detectadas por satélite y no confirman por sí solos un incendio activo sobre el terreno; la propagación mostrada
          es una simulación estimativa.
        </p>
      </footer>
    </div>
  );
}
