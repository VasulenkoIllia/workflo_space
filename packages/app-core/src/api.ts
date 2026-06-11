import { ApiErrorCode } from '@workflo/types'

/**
 * Shared API client for portal + workspace (AR-42, audit 2026-06-11: this file
 * existed as a near-identical copy in both apps and had ALREADY diverged — the
 * `??`/`||` build-arg bug shipped to one app only. Single source of truth now.)
 *
 * Base URL. In dev, `/api` is proxied to the API (vite strips the prefix). In
 * prod the SPA calls the API cross-origin, so `VITE_API_URL` is baked at build
 * (e.g. https://api.workflo.space). `||` (not `??`) so an empty build-arg falls
 * back to `/api` rather than producing an empty base.
 */
export const API_URL = import.meta.env.VITE_API_URL || '/api'

// Access token lives in memory only (never localStorage). Refresh token is an
// httpOnly cookie (Path=/auth/refresh) the browser sends automatically.
let accessToken: string | null = null
export function setAccessToken(token: string | null): void {
  accessToken = token
}
export function getAccessToken(): string | null {
  return accessToken
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  body?: unknown
  _retry?: boolean
}

type ApiEnvelope = {
  success?: boolean
  data?: unknown
  error?: { code?: string; message?: string; details?: unknown }
}

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshInFlight: Promise<boolean> | null = null
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false
        const json = (await res.json().catch(() => null)) as {
          success?: boolean
          data?: { accessToken?: string }
        } | null
        if (json?.success && json.data?.accessToken) {
          accessToken = json.data.accessToken
          return true
        }
        return false
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, headers, _retry, ...rest } = opts
  const isForm = body instanceof FormData

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    ...rest,
  })

  // Auto-refresh once on 401 (except for the refresh endpoint itself).
  if (res.status === 401 && !_retry && path !== '/auth/refresh') {
    if (await refreshAccessToken()) {
      return request<T>(method, path, { ...opts, _retry: true })
    }
  }

  const text = await res.text()
  let json: ApiEnvelope | null = null
  if (text) {
    try {
      json = JSON.parse(text) as ApiEnvelope
    } catch {
      throw new ApiError(res.status, ApiErrorCode.INTERNAL_ERROR, 'Невалідна відповідь сервера.')
    }
  }

  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? ApiErrorCode.INTERNAL_ERROR,
      json?.error?.message ?? 'Сталася помилка. Спробуйте ще раз.',
      json?.error?.details
    )
  }
  return (json?.data ?? json) as T
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { body: form }),
}
