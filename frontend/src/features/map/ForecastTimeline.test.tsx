import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ForecastTimeline } from './ForecastTimeline';

describe('ForecastTimeline', () => {
  it('stops playback cleanly at the end of the horizon instead of looping back to "Ahora"', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onPlayingChange = vi.fn();
    const { rerender } = render(<ForecastTimeline hour={11} onChange={onChange} onPlayingChange={onPlayingChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir previsión' }));
    act(() => { vi.advanceTimersByTime(450); });
    expect(onChange).toHaveBeenCalledWith(12);

    rerender(<ForecastTimeline hour={12} onChange={onChange} onPlayingChange={onPlayingChange} />);
    act(() => { vi.advanceTimersByTime(2000); });

    expect(onChange).not.toHaveBeenCalledWith(0);
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Reproducir previsión' })).toBeInTheDocument();

    vi.useRealTimers();
  });
});
