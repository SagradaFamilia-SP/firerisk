import { describe, expect, it } from 'vitest';

import { severityForIntensity, sortedFuelBreakdown } from './spreadImpact';

describe('severityForIntensity', () => {
  it('classifies fireline intensity using the standard suppression-difficulty thresholds', () => {
    expect(severityForIntensity(0).level).toBe('low');
    expect(severityForIntensity(349).level).toBe('low');
    expect(severityForIntensity(350).level).toBe('moderate');
    expect(severityForIntensity(1749).level).toBe('moderate');
    expect(severityForIntensity(1750).level).toBe('high');
    expect(severityForIntensity(3499).level).toBe('high');
    expect(severityForIntensity(3500).level).toBe('extreme');
    expect(severityForIntensity(10_000).level).toBe('extreme');
  });
});

describe('sortedFuelBreakdown', () => {
  it('sorts fuel types by burned area, largest first', () => {
    const sorted = sortedFuelBreakdown({ 'Pasto corto': 0.5, 'Matorral': 2.3, 'Bosque': 1.1 });
    expect(sorted).toEqual([['Matorral', 2.3], ['Bosque', 1.1], ['Pasto corto', 0.5]]);
  });

  it('returns an empty list for an empty breakdown', () => {
    expect(sortedFuelBreakdown({})).toEqual([]);
  });
});
