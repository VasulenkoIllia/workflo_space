import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'

/**
 * 01-Г: підтвердження зміни email — лінк із листа на НОВУ адресу (?token=).
 * Публічна сторінка (сесія не потрібна). firedRef гасить StrictMode-подвійний
 * виклик — токен одноразовий.
 */
type State = 'confirming' | 'done' | 'error'

export function ConfirmEmailChangePage() {
  const [params] = useSearchParams()
  const [state, setState] = useState<State>('confirming')
  const [error, setError] = useState<string | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    const token = params.get('token') ?? ''
    if (token === '') {
      setState('error')
      return
    }
    void (async () => {
      try {
        await api.post('/auth/confirm-email-change', { token })
        setState('done')
      } catch (err) {
        setError(err instanceof ApiError ? err.message : null)
        setState('error')
      }
    })()
  }, [params])

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {state === 'confirming' ? (
          <div className="wfp-mono" style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
            // підтверджуємо…
          </div>
        ) : state === 'done' ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Email змінено ✓</div>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)', marginBottom: 16 }}>
              Тепер входьте з новою адресою.
            </div>
            <Link to="/login">
              <Button variant="primary">До входу</Button>
            </Link>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Не вдалося підтвердити
            </div>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)', marginBottom: 16 }}>
              {error ?? 'Посилання недійсне або прострочене (діє 24 години).'}
            </div>
            <Link to="/settings">
              <Button variant="primary">До налаштувань</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
