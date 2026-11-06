import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadTheme } from './store';
import './styles.css';

document.documentElement.dataset.theme = loadTheme();

// The desktop shell serves the same bundle from tauri.localhost. Installing a
// service worker there would cache an old build and hide app upgrades, so the
// PWA worker is limited to the real web deployment.
const isDesktopShell =
  '__TAURI_INTERNALS__' in window || '__TAURI__' in window;

if (!isDesktopShell) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
