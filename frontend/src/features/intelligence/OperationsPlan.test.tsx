import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncState } from '../../hooks/useDashboard';
import type { OperationalPlan as Plan } from '../../types/api';
import { OperationsPlan } from './OperationsPlan';

const plan: Plan = {
  mode: 'deterministic_fallback',
  summary: 'Riesgo elevado para la planta.',
  decision: 'ACTIVAR PREALERTA',
  actions: Array.from({ length: 6 }, (_, index) => ({
    priority: index + 1,
    owner: `Equipo ${index + 1}`,
    action: `Acción ${index + 1}`,
    deadline_min: index + 2,
  })),
  message: 'Suspenda trabajos exteriores.',
  confidence_note: 'Validar con emergencias.',
  model_error: null,
};

describe('OperationsPlan', () => {
  it('disables duplicate submissions while loading', () => {
    const onGenerate = vi.fn();
    render(<OperationsPlan state={{ status: 'loading', data: null, error: null }} onGenerate={onGenerate} />);
    const button = screen.getByRole('button', { name: /generando plan/i });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('renders five prioritized fallback actions', () => {
    const state: AsyncState<Plan> = { status: 'success', data: plan, error: null };
    render(<OperationsPlan state={state} onGenerate={vi.fn()} />);
    expect(screen.getByText('Plan de contingencia')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Equipo 1 · 2 min')).toBeInTheDocument();
    expect(screen.queryByText('Acción 6')).not.toBeInTheDocument();
  });

  it('keeps the generate action available after an error', () => {
    const state: AsyncState<Plan> = { status: 'error', data: null, error: 'Backend desconectado' };
    render(<OperationsPlan state={state} onGenerate={vi.fn()} />);
    expect(screen.getByText('Backend desconectado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generar plan operativo/i })).toBeEnabled();
  });
});
