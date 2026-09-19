export type SeverityLevel = 'low' | 'moderate' | 'high' | 'extreme';

export interface SeverityBand {
  level: SeverityLevel;
  label: string;
  description: string;
}

// Fireline-intensity suppression-difficulty thresholds (kW/m), Andrews &
// Rothermel (1982) / standard NWCG fire-behaviour interpretation guidance —
// not specific to this app's model, a widely cited reference classification.
export function severityForIntensity(intensityKwM: number): SeverityBand {
  if (intensityKwM < 350) {
    return { level: 'low', label: 'Baja', description: 'Ataque directo con herramientas manuales sería viable.' };
  }
  if (intensityKwM < 1750) {
    return {
      level: 'moderate',
      label: 'Moderada',
      description: 'Demasiado intenso para ataque directo manual; requeriría maquinaria pesada o autobombas.',
    };
  }
  if (intensityKwM < 3500) {
    return {
      level: 'high',
      label: 'Alta',
      description: 'Riesgo de fuego de copa y pavesas; el ataque directo en cabeza dejaría de ser efectivo.',
    };
  }
  return {
    level: 'extreme',
    label: 'Extrema',
    description: 'Comportamiento extremo (torbellinos, pavesas largas); control directo no viable.',
  };
}

export function sortedFuelBreakdown(breakdown: Record<string, number>): Array<[string, number]> {
  return Object.entries(breakdown).sort(([, a], [, b]) => b - a);
}
