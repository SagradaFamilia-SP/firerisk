export type IntensityBucket = 'low' | 'medium' | 'high';

export const INTENSITY_LABELS: Record<IntensityBucket, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

/** FRP thresholds (MW) separating the three intensity buckets shown in the table. */
export const INTENSITY_THRESHOLDS = { mediumFrom: 5, highFrom: 25 } as const;

export function intensityBucket(frp: number | null): IntensityBucket | null {
  if (frp === null) return null;
  if (frp >= INTENSITY_THRESHOLDS.highFrom) return 'high';
  if (frp >= INTENSITY_THRESHOLDS.mediumFrom) return 'medium';
  return 'low';
}
