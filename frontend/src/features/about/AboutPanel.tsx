import { AlertTriangle, Database, Flame, MapPinned, ShieldCheck, Satellite, Wind } from 'lucide-react';

const capabilities = [
  { icon: Satellite, title: 'Detección satelital', text: 'NASA FIRMS VIIRS NOAA-20 y NOAA-21 para anomalías térmicas recientes.' },
  { icon: MapPinned, title: 'Contexto territorial', text: 'Mapa satélite/calle, geocodificación inversa y coordenadas precisas del foco.' },
  { icon: Wind, title: 'Propagación experimental', text: 'Terreno, viento, humedad, combustible de cobertura terrestre y escenario FRP/brillo.' },
  { icon: Database, title: 'Trazabilidad', text: 'Caché local, estados de sincronización y aviso cuando los datos son antiguos o no disponibles.' },
];

const limits = [
  'Una detección VIIRS es una anomalía térmica, no confirmación visual de incendio.',
  'La propagación no modela pavesas, fuego de copa, cortafuegos, supresión ni evacuación.',
  'Los resultados sirven para priorización y análisis inicial, no para decisiones de seguridad de vidas.',
];

export function AboutPanel() {
  return (
    <section className="about-panel" aria-label="About PYROS">
      <header className="about-panel__header">
        <div>
          <span className="eyebrow">PYROS · Wildfire Intelligence</span>
          <h1>Detección, telemetría y simulación de incendios</h1>
        </div>
        <span className="about-panel__version">0.0.1</span>
      </header>

      <div className="about-panel__grid">
        {capabilities.map(({ icon: Icon, title, text }) => (
          <article className="about-card" key={title}>
            <Icon size={18} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="about-panel__columns">
        <section className="about-section">
          <h2><Flame size={16} /> Flujo operativo</h2>
          <ol>
            <li>Explorar detecciones en mapa o tabla.</li>
            <li>Seleccionar un foco para revisar telemetría, ubicación y potencia.</li>
            <li>Simular escenarios con FRP/brillo para estimar propagación inicial.</li>
            <li>Descargar informe y contrastar con fuentes oficiales de emergencia.</li>
          </ol>
        </section>

        <section className="about-section about-section--warning">
          <h2><AlertTriangle size={16} /> Limitaciones</h2>
          <ul>
            {limits.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>

      <section className="about-section">
        <h2><ShieldCheck size={16} /> Datos y seguridad</h2>
        <p>
          Las claves de NASA FIRMS permanecen en backend. El navegador solo consume endpoints internos,
          y la geocodificación muestra atribución de OpenStreetMap cuando resuelve una ubicación.
        </p>
      </section>
    </section>
  );
}
