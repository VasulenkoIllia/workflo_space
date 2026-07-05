import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { api, setAccessToken } from '@/lib/api'

/**
 * 01-А: обмін magic-link токена на сесію. Лінк з листа веде сюди (?token=).
 * 2FA не обходиться: увімкнена → редірект на /login?oauth2fa=<challenge> (той самий
 * крок коду, що після пароля/OAuth). StrictMode-подвійний виклик гаситься firedRef
 * (токен одноразовий — другий виклик зʼїв би його даремно).
 */
type State = 'exchanging' | 'error'

export function MagicLoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { reload } = useAuth()
  const [state, setState] = useState<State>('exchanging')
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
        const data = await api.post<{
          accessToken?: string
          twoFactorRequired?: boolean
          challengeToken?: string
        }>('/auth/magic-login', { token })
        if (data.twoFactorRequired && data.challengeToken) {
          navigate(`/login?oauth2fa=${encodeURIComponent(data.challengeToken)}`, {
            replace: true,
          })
          return
        }
        if (data.accessToken) {
          setAccessToken(data.accessToken)
          await reload()
          navigate('/orders', { replace: true })
          return
        }
        setState('error')
      } catch {
        setState('error')
      }
    })()
  }, [params, navigate, reload])

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        {state === 'exchanging' ? (
          <div className="wfp-mono" style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
            // входимо…
          </div>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Посилання недійсне</div>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)', marginBottom: 16 }}>
              Воно могло прострочитись (діє 15 хвилин) або вже було використане.
            </div>
            <Link to="/login">
              <Button variant="primary">До входу</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
