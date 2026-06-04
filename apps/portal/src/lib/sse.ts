import { API_URL, getAccessToken, refreshAccessToken } from './api'

export interface SseHandlers {
  onEvent?: (event: string, data: string, id?: string) => void
  onOpen?: () => void
  onError?: (err: unknown) => void
}

/**
 * Subscribe to a Server-Sent-Events stream WITH Authorization. The native
 * EventSource can't set headers and the access token isn't in a cookie, so we
 * read the stream via fetch + ReadableStream. Refreshes the token on 401 and
 * auto-reconnects with backoff. Returns an unsubscribe function.
 */
export function subscribeSse(path: string, handlers: SseHandlers): () => void {
  let closed = false
  let controller: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

  function parseChunk(raw: string) {
    let event = 'message'
    let data = ''
    let id: string | undefined
    for (const line of raw.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) {
        const value = line.slice(5).replace(/^ /, '') // strip one leading space per spec
        data = data.length > 0 ? `${data}\n${value}` : value
      } else if (line.startsWith('id:')) id = line.slice(3).trim()
    }
    if (data) handlers.onEvent?.(event, data, id)
  }

  async function connect() {
    if (closed) return
    controller = new AbortController()
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_URL}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
      })
      // Refresh once on 401 so the reconnect carries a fresh token.
      if (res.status === 401) {
        await refreshAccessToken()
        throw new Error('SSE 401')
      }
      if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
      handlers.onOpen?.()
      attempt = 0
      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          parseChunk(buffer.slice(0, idx))
          buffer = buffer.slice(idx + 2)
        }
      }
      throw new Error('SSE stream ended')
    } catch (err) {
      if (closed || (err instanceof DOMException && err.name === 'AbortError')) return
      handlers.onError?.(err)
      attempt += 1
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15_000)
      reconnectTimer = setTimeout(() => void connect(), delay)
    } finally {
      if (reader) {
        try {
          await reader.cancel()
        } catch {
          /* stream already errored — ignore */
        }
      }
    }
  }

  void connect()
  return () => {
    closed = true
    controller?.abort()
    if (reconnectTimer) clearTimeout(reconnectTimer)
  }
}
