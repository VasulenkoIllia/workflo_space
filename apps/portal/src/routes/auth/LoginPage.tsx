import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { loginSchema } from '@workflo/types'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
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
