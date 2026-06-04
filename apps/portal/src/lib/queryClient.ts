import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'

const NON_RETRYABLE = new Set([400, 401, 403, 404, 409, 422])

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // 401s are handled by the auth bootstrap/redirect — don't toast those.
      if (error instanceof ApiError && error.status === 401) return
      toast.error(error instanceof ApiError ? error.message : 'Помилка завантаження даних')
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Сталася помилка. Спробуйте ще раз.')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        if (error instanceof ApiError && NON_RETRYABLE.has(error.status)) return false
        return count < 2
      },
    },
  },
})
