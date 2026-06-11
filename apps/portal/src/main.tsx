import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@workflo/ui'
import { ErrorBoundary } from '@workflo/app-core'
import '@workflo/ui/styles.css'
import App from './App'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
import { I18nProvider } from '@/i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* AR-41: root boundary — a render error must never white-screen the app. */}
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider defaultTheme="system" defaultAccent="lime" className="wf-app">
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
              <Toaster position="top-right" richColors closeButton />
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
