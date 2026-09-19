import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './api';

describe('apiClient.fires', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serializes viewport and FIRMS filters without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detections: [], meta: {} }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.fires(
      { west: -7, south: 39, east: -5, north: 41, zoom: 7 },
      { hours: 48, sources: ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'], minConfidence: 'nominal' },
    );

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/fires?');
    expect(url).toContain('hours=48');
    expect(url).toContain('sources=VIIRS_NOAA20_NRT%2CVIIRS_NOAA21_NRT');
    expect(url.toLowerCase()).not.toContain('key');
  });
});
