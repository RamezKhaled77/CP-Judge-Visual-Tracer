import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl } from '@workspace/api-client-react';

import './index.css';

// When bundled for production (or served from a different origin than the
// API), point the generated client at the API via VITE_API_URL so requests
// resolve to an absolute origin instead of relative `/api/*` (which would land
// on the frontend's own origin). When unset, requests stay relative and the
// Vite dev proxy handles /api/* forwarding during local development.
setBaseUrl(import.meta.env.VITE_API_URL || null);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
