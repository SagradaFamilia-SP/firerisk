import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';

import { AppRouter } from './AppRouter';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><AppRouter /></AppErrorBoundary>
  </StrictMode>,
);
