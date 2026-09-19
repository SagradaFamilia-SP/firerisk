import { describe, expect, it } from 'vitest';

import type { FireDetection } from '../../types/api';
import { sampleFiresForRender } from './sampleFires';

const fire = (id: string, latitude: number, longitude: number, acquiredAt: string): FireDetection => ({
  id,
  latitude,
  longitude,
  acquired_at: acquiredAt,
  satellite: 'N21',
  instrument: 'VIIRS',
  source: 'VIIRS_NOAA21_NRT',
  confidence: 'nominal',
  brightness: 330,
  brightness_ti5: null,
  frp: 10,
  scan: null,
  track: null,
  daynight: 'day',
});

describe('sampleFiresForRender', () => {
  it('returns everything untouched when under the limit', () => {
    const fires = [fire('a', 40, -3, '2026-09-19T10:00:00Z'), fire('b', 41, -4, '2026-09-19T11:00:00Z')];
    expect(sampleFiresForRender(fires, 10)).toEqual(fires);
  });

  it('keeps a representative from every occupied region instead of only the most recent continent', () => {
    // 100 very recent fires clustered in Asia, and 5 older ones scattered
    // across the Americas — a naive newest-first slice(0, limit) with a
    // small limit would drop every single American fire.
    const asia = Array.from({ length: 100 }, (_, index) =>
      fire(`asia-${index}`, 30 + index * 0.01, 100 + index * 0.01, '2026-09-19T16:00:00Z'));
    const americas = [
      fire('america-1', 38.9, -112.8, '2026-09-19T10:00:00Z'),
      fire('america-2', 40.7, -74.0, '2026-09-19T09:00:00Z'),
      fire('america-3', -15.8, -47.9, '2026-09-19T08:00:00Z'),
      fire('america-4', 19.4, -99.1, '2026-09-19T07:00:00Z'),
      fire('america-5', -34.6, -58.4, '2026-09-19T06:00:00Z'),
    ];

    const sampled = sampleFiresForRender([...asia, ...americas], 10);

    const sampledIds = new Set(sampled.map((item) => item.id));
    expect(sampled.length).toBe(10);
    for (const item of americas) {
      expect(sampledIds.has(item.id)).toBe(true);
    }
  });

  it('never drops fires that are alone in their own geographic bucket', () => {
    const crowded = Array.from({ length: 50 }, (_, index) => fire(`crowded-${index}`, 30, 100, '2026-09-19T16:00:00Z'));
    const lonely = fire('lonely', -33.9, 151.2, '2026-09-19T05:00:00Z');

    const sampled = sampleFiresForRender([...crowded, lonely], 5);

    expect(sampled.some((item) => item.id === 'lonely')).toBe(true);
  });
});
