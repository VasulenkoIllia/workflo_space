import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema } from '@workflo/types'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'

type LoginForm = { email: string; password: string }

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values.email, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/orders', { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не вдалося увійти')
    }
  })

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
