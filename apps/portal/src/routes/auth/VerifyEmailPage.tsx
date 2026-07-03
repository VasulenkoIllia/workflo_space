import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthShell, AuthHeader, AuthStatus, Button } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

/**
 * /verify-email?token=… — landing for the emailed confirmation link (S9).
 * Public: the token itself is the proof; works logged-in or logged-out.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, reload } = useAuth()
  const [state, setState] = useState<'pending' | 'ok' | 'error'>(token ? 'pending' : 'error')
  const [message, setMessage] = useState<string | null>(null)
  // StrictMode double-mount guard — the token is single-use.
  const firedRef = useRef(false)

  useEffect(() => {
    if (!token || firedRef.current) return
    firedRef.current = true
    void (async () => {
      try {
        await api.post('/auth/verify-email', { token })
        setState('ok')
        // Logged-in user: refresh /auth/me so the banner disappears immediately.
        if (user) await reload().catch(() => undefined)
      } catch (err) {
        setState('error')
        setMessage(err instanceof ApiError ? err.message : 'Не вдалося підтвердити email')
      }
    })()
  }, [token, user, reload])

  return (
    <AuthShell>
      <AuthHeader
        title="Підтвердження email"
        sub={
          state === 'pending'
            ? '// перевіряємо посилання…'
            : state === 'ok'
              ? '// готово'
              : '// посилання недійсне'
        }
      />
      {state === 'ok' ? (
        <>
          <div style={{ fontSize: 14 }}>
            Email підтверджено — акаунт повністю активний. Дякуємо!
          </div>
          <Link to={user ? '/' : '/login'}>
            <Button variant="primary" fullWidth>
              {user ? 'До кабінету' : 'Увійти'}
            </Button>
          </Link>
        </>
      ) : state === 'error' ? (
        <>
          <div className="wfp-field-hint wfp-field-hint--error">
            {message ?? 'Посилання недійсне або застаріле. Запросіть новий лист у налаштуваннях.'}
          </div>
          <Link to={user ? '/settings' : '/login'}>
            <Button variant="primary" fullWidth>
              {user ? 'До налаштувань' : 'Увійти'}
            </Button>
          </Link>
        </>
      ) : (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          зачекайте…
        </div>
      )}
      <AuthStatus />
    </AuthShell>
  )
}
