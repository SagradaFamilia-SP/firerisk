import { describe, expect, it } from 'vitest';

import { destination, percentagePolygonToCoordinates } from './geo';

describe('map geometry', () => {
  it('projects a point east by bearing and distance', () => {
    const [lat, lon] = destination([39.681, -6.347], 90, 1);
    expect(lat).toBeCloseTo(39.681, 3);
    expect(lon).toBeGreaterThan(-6.347);
  });

  it('maps simulation percentages around the fire origin', () => {
    const polygon = percentagePolygonToCoordinates([[25, 58], [75, 42]]);
    expect(polygon).toHaveLength(2);
    expect(polygon[0][1]).toBeLessThan(polygon[1][1]);
  });
});

