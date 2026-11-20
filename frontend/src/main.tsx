import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { ApiError } from './api/transport'
import { sessionKey } from './session'
import './theme.css'

function onRequestError(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && error.requiresSession) {
    queryClient.setQueryData(sessionKey, null)
    queryClient.removeQueries({ queryKey: ['private'] })
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
  queryCache: new QueryCache({
    onError: onRequestError,
    onSuccess: (data, query) => {
      if (query.queryKey[0] === sessionKey[0] && data === null) {
        queryClient.removeQueries({ queryKey: ['private'] })
      }
    },
  }),
  mutationCache: new MutationCache({ onError: onRequestError }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
