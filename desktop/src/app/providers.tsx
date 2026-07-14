import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@features/auth/AuthContext'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (count, error) => count < 1 && !(error instanceof Error && error.message.includes('登录状态')) },
    mutations: { retry: false },
  },
})

export function AppProviders() {
  return <QueryClientProvider client={queryClient}><AuthProvider><RouterProvider router={router} future={{ v7_startTransition: true }} /></AuthProvider></QueryClientProvider>
}
