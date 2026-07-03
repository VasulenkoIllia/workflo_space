import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema } from '@workflo/types'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { safeRedirect } from '@/lib/navigation'

type LoginForm = { email: string; password: string }

export function LoginPage() {
  const { login, verifyTwoFactor } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const [twoFactor, setTwoFactor] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
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
