import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { loginSchema } from '@workflo/types'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { api, ApiError } from '@/lib/api'
import { safeRedirect } from '@/lib/navigation'
import { startGoogleLogin, useOauthProviders } from '@/lib/oauth'

type LoginForm = { email: string; password: string }

const OAUTH_ERRORS: Record<string, string> = {
  state: 'Сесія входу через Google прострочена — спробуйте ще раз',
  denied: 'Вхід через Google скасовано',
  exchange: 'Google не підтвердив вхід — спробуйте ще раз',
  unverified: 'Email у Google не підтверджено — підтвердіть його в Google і повторіть',
  inactive: 'Обліковий запис деактивовано',
}

export function LoginPage() {
  const { login, verifyTwoFactor, adoptTwoFactorChallenge } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const providers = useOauthProviders()
  const [formError, setFormError] = useState<string | null>(null)
  const [twoFactor, setTwoFactor] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  // 01-А magic-link: 'form' → email-only форма, 'sent' → «перевірте пошту»
  const [magicStep, setMagicStep] = useState<'off' | 'form' | 'sent'>('off')
  const [magicEmail, setMagicEmail] = useState('')
  const [magicSending, setMagicSending] = useState(false)

  // OAuth redirect landings: ?oauth2fa=<challenge> → straight to the code step;
  // ?oauthError=<code> → inline error. Params are consumed (removed) on arrival.
  useEffect(() => {
    const challenge = params.get('oauth2fa')
    const oauthError = params.get('oauthError')
    if (!challenge && !oauthError) return
    if (challenge) {
      adoptTwoFactorChallenge(challenge)
      setTwoFactor(true)
    }
    if (oauthError) setFormError(OAUTH_ERRORS[oauthError] ?? 'Не вдалося увійти через Google')
    setParams({}, { replace: true })
  }, [params, setParams, adoptTwoFactorChallenge])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const goHome = () => {
    const from = (location.state as { from?: string } | null)?.from
    navigate(safeRedirect(from === '/login' ? null : from), { replace: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { twoFactorRequired } = await login(values.email, values.password)
      if (twoFactorRequired) setTwoFactor(true)
      else goHome()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не вдалося увійти')
    }
  })

  const submitCode = async () => {
    setFormError(null)
    setVerifying(true)
    try {
      await verifyTwoFactor(code.trim())
      goHome()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Невірний код')
    } finally {
      setVerifying(false)
    }
  }

  const sendMagicLink = async () => {
    setFormError(null)
    setMagicSending(true)
    try {
      await api.post('/auth/magic-link', { email: magicEmail.trim() })
      setMagicStep('sent')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не вдалося надіслати посилання')
    } finally {
      setMagicSending(false)
    }
  }

  if (magicStep !== 'off') {
    return (
      <AuthShell>
        <AuthHeader title="Вхід без пароля" sub="// одноразове посилання на email" />
        {magicStep === 'sent' ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
              Якщо акаунт із адресою <strong>{magicEmail.trim()}</strong> існує — лист уже в дорозі.
              Посилання діє 15 хвилин.
            </div>
            <Button type="button" variant="ghost" fullWidth onClick={() => setMagicStep('off')}>
              ← Назад до входу
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="olena@brunky.ua"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && magicEmail.trim().length > 3) void sendMagicLink()
              }}
              error={formError ?? undefined}
            />
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={magicSending}
              disabled={magicEmail.trim().length < 4}
              onClick={() => void sendMagicLink()}
            >
              Надіслати посилання
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={() => setMagicStep('off')}>
              ← Вхід з паролем
            </Button>
          </>
        )}
        <AuthStatus />
      </AuthShell>
    )
  }

  if (twoFactor) {
    return (
      <AuthShell>
        <AuthHeader title="Двофакторна автентифікація" sub="// код з застосунку-автентифікатора" />
        <Input
          label="Код 2FA"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitCode()
          }}
          error={formError ?? undefined}
        />
        <Button
          type="button"
          variant="primary"
          fullWidth
          loading={verifying}
          disabled={code.trim().length < 6}
          onClick={() => void submitCode()}
        >
          Підтвердити
        </Button>
        <div className="wfp-auth-foot" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          Немає доступу до застосунку? Введіть один із резервних кодів.
        </div>
        <AuthStatus />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeader title="Вхід у кабінет" sub="// portal.workflo.space" />
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'contents' }}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="olena@brunky.ua"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Пароль"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message ?? formError ?? undefined}
          {...register('password')}
        />
        <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
          Увійти
        </Button>
      </form>
      {providers.data?.google && (
        <Button type="button" variant="ghost" fullWidth onClick={() => startGoogleLogin('portal')}>
          Увійти через Google
        </Button>
      )}
      <Button type="button" variant="ghost" fullWidth onClick={() => setMagicStep('form')}>
        Увійти без пароля (посилання на email)
      </Button>
      <div className="wfp-auth-foot">
        немає акаунту?{' '}
        <Link to="/register" style={{ color: 'var(--wf-accent)' }}>
          зареєструватися →
        </Link>
      </div>
      <AuthStatus />
    </AuthShell>
  )
}
