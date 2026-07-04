import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiErrorCode } from '@workflo/types'
import { toast } from 'sonner'
import { ApiError, apiErrorMessage } from './api.js'

const NON_RETRYABLE = new Set([400, 401, 403, 404, 409, 422])

/**
 * THE single frontend error pipeline (mirrors the backend's central errorHandler).
 * Every failed query/mutation surfaces the SERVER's message (via apiErrorMessage —
 * business rules / 403 / 409 carry a user-facing UA string; validation appends the
 * offending field). Components should NOT add their own generic error toast — it
 * would double up. Opt out with `meta: { suppressGlobalToast: true }` when a screen
 * renders its own inline error (auth forms, invite preview, vault step-up).
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressGlobalToast) return
      // 401s are handled by the auth bootstrap/redirect — don't toast those.
      if (error instanceof ApiError && error.status === 401) return
      toast.error(apiErrorMessage(error, 'Помилка завантаження даних'))
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.suppressGlobalToast) return
      // Step-up (vault reveal) is resolved by a password prompt, not a toast.
      if (error instanceof ApiError && error.code === (ApiErrorCode.STEP_UP_REQUIRED as string))
        return
      toast.error(apiErrorMessage(error, 'Сталася помилка. Спробуйте ще раз.'))
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
