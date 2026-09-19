import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsyncState } from './useDashboard';
import { useFireReport } from './useFireReport';
import type { FireSpread } from './useFireSpread';
import type { FireDetection, ReverseLocationResponse } from '../types/api';

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
});
