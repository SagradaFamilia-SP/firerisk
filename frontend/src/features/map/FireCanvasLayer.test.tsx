import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FireDetection } from '../../types/api';
import { FireCanvasLayer } from './FireCanvasLayer';

const map = { addLayer: vi.fn(), removeLayer: vi.fn() };

vi.mock('react-leaflet', () => ({ useMap: () => map }));

interface FakeMarker {
  bindTooltip: ReturnType<typeof vi.fn>;
  bindPopup: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  click: () => void;
}

let createdMarkers: FakeMarker[] = [];
let createdGroups: { clearLayers: ReturnType<typeof vi.fn>; addTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[] = [];

vi.mock('leaflet', () => ({
  circleMarker: vi.fn(() => {
    let clickHandler: () => void = () => undefined;
    const marker: FakeMarker = {
      bindTooltip: vi.fn(() => marker),
      bindPopup: vi.fn(() => marker),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'click') clickHandler = handler;
        return marker;
      }),
      addTo: vi.fn(() => marker),
      setStyle: vi.fn(() => marker),
      click: () => clickHandler(),
    };
    createdMarkers.push(marker);
    return marker;
  }),
  layerGroup: vi.fn(() => {
    const group = { clearLayers: vi.fn(), addTo: vi.fn(() => group), remove: vi.fn() };
    createdGroups.push(group);
    return group;
  }),
}));

const fire = (id: string, over: Partial<FireDetection> = {}): FireDetection => ({
  id, latitude: 40, longitude: -3, acquired_at: '2026-09-19T10:00:00Z',
  satellite: 'N21', instrument: 'VIIRS', source: 'VIIRS_NOAA21_NRT', confidence: 'nominal',
  brightness: 300, brightness_ti5: null, frp: 5, scan: null, track: null, daynight: 'day',
  ...over,
});

describe('FireCanvasLayer', () => {
  beforeEach(() => {
    createdMarkers = [];
    createdGroups = [];
    map.addLayer.mockClear();
    map.removeLayer.mockClear();
  });

  it('creates one raw Leaflet circle marker per fire and wires its click to onSelectFire', () => {
    const onSelectFire = vi.fn();
    render(<FireCanvasLayer fires={[fire('a'), fire('b')]} selectedFireId={null} onSelectFire={onSelectFire} visible />);

    expect(createdMarkers).toHaveLength(2);
    createdMarkers[0].click();
    expect(onSelectFire).toHaveBeenCalledWith('a');
  });

  it('restyles only the affected markers on a selection change, instead of rebuilding the whole set', () => {
    const fires = [fire('a'), fire('b')];
    const { rerender } = render(<FireCanvasLayer fires={fires} selectedFireId={null} onSelectFire={vi.fn()} visible />);
    expect(createdMarkers).toHaveLength(2);

    rerender(<FireCanvasLayer fires={fires} selectedFireId="a" onSelectFire={vi.fn()} visible />);

    expect(createdMarkers).toHaveLength(2); // no new markers were created for the same `fires` array
    expect(createdMarkers[0].setStyle).toHaveBeenCalled();
  });

  it('attaches its layer group to the map only while the fire layer is toggled on', () => {
    const { rerender } = render(<FireCanvasLayer fires={[fire('a')]} selectedFireId={null} onSelectFire={vi.fn()} visible={false} />);
    expect(createdGroups[0].addTo).not.toHaveBeenCalled();

    rerender(<FireCanvasLayer fires={[fire('a')]} selectedFireId={null} onSelectFire={vi.fn()} visible />);
    expect(createdGroups[0].addTo).toHaveBeenCalled();
  });
});
