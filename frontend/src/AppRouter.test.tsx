import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from './AppRouter';

vi.mock('./App', () => ({ default: () => <div>APP SHELL</div> }));
vi.mock('./features/landing/LandingPage', () => ({
  LandingPage: ({ onEnter }: { onEnter: () => void }) => <button type="button" onClick={onEnter}>ENTER</button>,
}));

describe('AppRouter', () => {
  afterEach(() => { window.location.hash = ''; });

  it('shows the landing page by default', () => {
    render(<AppRouter />);
    expect(screen.getByText('ENTER')).toBeInTheDocument();
  });

  it('shows the app when the URL hash is #/app', () => {
    window.location.hash = '#/app';
    render(<AppRouter />);
    expect(screen.getByText('APP SHELL')).toBeInTheDocument();
  });

  it('navigates from the landing page into the app when its CTA fires', () => {
    render(<AppRouter />);
    fireEvent.click(screen.getByText('ENTER'));
    expect(window.location.hash).toBe('#/app');
    expect(screen.getByText('APP SHELL')).toBeInTheDocument();
  });
});
