import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('IGNIS render error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <TriangleAlert size={28} />
          <h1>No se pudo mostrar el centro de mando</h1>
          <p>Recarga la aplicación para recuperar el último escenario.</p>
          <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Recargar
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

