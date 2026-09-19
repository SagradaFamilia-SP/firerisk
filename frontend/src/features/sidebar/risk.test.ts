import { describe, expect, it } from 'vitest';

import { getRiskLevel } from './risk';

describe('getRiskLevel', () => {
  it.each([[54, 'Moderado'], [55, 'Alto'], [74, 'Muy alto'], [90, 'Extremo']] as const)(
    'classifies score %i as %s',
    (score, expected) => expect(getRiskLevel(score)).toBe(expected),
  );
});
