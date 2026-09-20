import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsyncState } from './useDashboard';
import { REPORT_LAYOUT, useFireReport } from './useFireReport';
import type { FireSpread } from './useFireSpread';
import type { FireDetection, ReverseLocationResponse, SpreadResponse, SpreadSnapshot } from '../types/api';

const fire: FireDetection = {
  id: 'fire-report-1', latitude: 40.0, longitude: -6.2,
  acquired_at: '2026-09-19T14:25:00Z', satellite: 'N20', instrument: 'VIIRS',
  source: 'VIIRS_NOAA20_NRT', confidence: 'high',
  brightness: 340.1, brightness_ti5: 300.2, frp: 22.5, scan: 0.5, track: 0.6,
  daynight: 'day',
};

const idleReverseLocation: AsyncState<ReverseLocationResponse> = { status: 'idle', data: null, error: null };
const idleFireSpread: FireSpread = { status: 'idle', data: null, error: null, hour: 0, setHour: vi.fn() };
const loadingFireSpread: FireSpread = { status: 'loading', data: null, error: null, hour: 0, setHour: vi.fn() };
const spreadResponse: SpreadResponse = {
  center: { lat: 40, lon: -6.2 },
  max_hours: 12,
  terrain_source: 'open-meteo-dem',
  fuel_source: 'esa-worldcover',
  ignition_points: [{ lat: 40, lon: -6.2 }],
  weather: [{ time: '2026-09-19T14:00:00Z', wind_kmh: 21, wind_from_deg: 230, temperature_c: 32, rh_pct: 19 }],
  snapshots: Array.from({ length: 13 }, (_, hour): SpreadSnapshot => ({
    hour,
    radius_km_min: hour * 0.04,
    radius_km_mean: hour * 0.07,
    radius_km_max: hour * 0.1,
    area_km2: hour * 0.3,
    rings: [],
    intensity_kw_m_min: hour * 60,
    intensity_kw_m_mean: hour * 90,
    intensity_kw_m_max: hour * 130,
    burned_area_by_fuel_km2: hour === 12 ? { 'Tall grass': 2.4, Shrubland: 1.2 } : {},
  })),
  warning: 'Simulación experimental.',
  model_notes: ['ROS calculado con Rothermel y Byram.'],
  scenario: { frp_mw: 22.5, brightness_k: 340.1, spread_multiplier: 1.42 },
};
const loadedFireSpread: FireSpread = { status: 'success', data: spreadResponse, error: null, hour: 12, setHour: vi.fn() };

describe('useFireReport', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom doesn't implement the Blob URL APIs the download link relies on.
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('starts generating a report as soon as a fire is selected, before download is requested', async () => {
    const { result } = renderHook(() => useFireReport(fire, idleReverseLocation, idleFireSpread));

    expect(result.current.status).toBe('generating');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('waits for dependent data to settle before generating', () => {
    const { result } = renderHook(() => useFireReport(fire, idleReverseLocation, loadingFireSpread));
    expect(result.current.status).toBe('collecting');
  });

  it('downloads immediately once the report is ready', async () => {
    const { result } = renderHook(() => useFireReport(fire, idleReverseLocation, idleFireSpread));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.download());

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.pendingDownload).toBe(false);
  });

  it('generates and downloads a report with completed spread simulation data', async () => {
    const { result } = renderHook(() => useFireReport(fire, idleReverseLocation, loadedFireSpread));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.download());

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('shows a pending state and auto-downloads once generation finishes', async () => {
    const { result, rerender } = renderHook<ReturnType<typeof useFireReport>, { fireSpread: FireSpread }>(
      ({ fireSpread }) => useFireReport(fire, idleReverseLocation, fireSpread),
      { initialProps: { fireSpread: loadingFireSpread } },
    );
    expect(result.current.status).toBe('collecting');

    act(() => result.current.download());
    expect(result.current.pendingDownload).toBe(true);
    expect(clickSpy).not.toHaveBeenCalled();

    // The spread simulation finishes loading — the report can now be built.
    rerender({ fireSpread: idleFireSpread });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.pendingDownload).toBe(false));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('resets when no fire is selected', () => {
    const { result } = renderHook(() => useFireReport(null, idleReverseLocation, idleFireSpread));
    expect(result.current.status).toBe('idle');
  });

  it('uses a roomier PDF layout for readable report blocks', () => {
    expect(REPORT_LAYOUT.fieldStep).toBeGreaterThanOrEqual(44);
    expect(REPORT_LAYOUT.rowStep).toBeGreaterThanOrEqual(22);
    expect(REPORT_LAYOUT.sectionGapAfter).toBeGreaterThanOrEqual(28);
    expect(REPORT_LAYOUT.blockGap).toBeGreaterThanOrEqual(14);
  });
});
