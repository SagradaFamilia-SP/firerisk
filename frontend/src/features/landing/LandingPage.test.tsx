import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LandingPage } from './LandingPage';

vi.mock('../../services/api', () => ({
  apiClient: {
    fires: vi.fn(() => Promise.resolve({ meta: { count: 0 } })),
  },
}));

describe('LandingPage', () => {
  it('renders the showcase screenshots from compressed WebP assets inside the mac-style frames', () => {
    render(<LandingPage onEnter={() => undefined} />);

    expect(screen.getByAltText('Vista previa del mapa táctico de PYROS')).toHaveAttribute('src', '/landing/map.webp');
    expect(screen.getByAltText('Mapa táctico con focos NASA FIRMS y cámaras')).toHaveAttribute('src', '/landing/map.webp');
    expect(screen.getByAltText('Simulación de propagación de incendio')).toHaveAttribute('src', '/landing/simulation.webp');
    expect(screen.getByAltText('Asistente de IA conversacional')).toHaveAttribute('src', '/landing/chat.webp');
  });
});
