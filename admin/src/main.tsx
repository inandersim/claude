import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { SessionProvider } from './auth/session';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n';
import { applyTheme } from './theme/tokens';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// İlk boyama öncesi tema değişkenlerini yerleştir (yanıp sönmeyi önler).
applyTheme(
  (() => {
    try {
      const stored = window.localStorage.getItem('zirtan.admin.theme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      /* yoksay */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  })(),
);

const container = document.getElementById('root');
if (!container) throw new Error('#root bulunamadı');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ToastProvider>
            <BrowserRouter>
              <SessionProvider>
                <App />
              </SessionProvider>
            </BrowserRouter>
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
