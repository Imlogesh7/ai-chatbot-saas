import { AppRoutingSetup } from '@/routing/app-routing-setup';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error-boundary';

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        storageKey="vite-theme"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        <HelmetProvider>
          <BrowserRouter>
            <Toaster />
            <AppRoutingSetup />
          </BrowserRouter>
        </HelmetProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
