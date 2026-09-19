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

  it('sends simulation scenario controls to spread endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      center: { lat: 39, lon: -6 },
      max_hours: 12,
      terrain_source: 'flat-fallback',
      fuel_source: 'fallback-grass',
      ignition_points: [],
      weather: [],
      snapshots: [],
      warning: '',
      model_notes: [],
      scenario: { frp_mw: 20, brightness_k: 370, spread_multiplier: 1.8 },
    }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.spread({ lat: 39, lon: -6, frp_mw: 20, brightness_k: 370 });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/spread');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      lat: 39,
      lon: -6,
      frp_mw: 20,
      brightness_k: 370,
    });
  });
});
