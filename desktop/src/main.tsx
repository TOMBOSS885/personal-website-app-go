import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter } from 'react-router-dom'
import { App } from './app/App'
import { SettingsProvider } from './shared/settings/SettingsContext'
import { UserAuthProvider } from './features/account/UserAuthContext'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error) => {
        const status = typeof error === 'object' && error && 'status' in error
          ? Number(error.status)
          : 0
        return status >= 400 && status < 500 ? false : failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <UserAuthProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </UserAuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
