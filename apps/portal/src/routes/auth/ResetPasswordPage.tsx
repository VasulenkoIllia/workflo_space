import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'

type ResetForm = { password: string; confirm: string }

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>()
  const password = watch('password', '')

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    if (values.password.length < 8) {
      setFormError('Пароль має містити щонайменше 8 символів')
      return
    }
    if (values.password !== values.confirm) {
      setFormError('Паролі не співпадають')
      return
    }
    try {
      await api.post('/auth/reset-password', { token, password: values.password })
      toast.success('Пароль змінено. Увійдіть з новим паролем.')
      navigate('/login', { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не вдалося змінити пароль')
    }
  })

  if (!token) {
    return (
      <AuthShell>
        <AuthHeader title="Новий пароль" sub="// посилання недійсне" />
        <div className="wfp-field-hint wfp-field-hint--error">
          Посилання недійсне або застаріле. Запитайте нове.
        </div>
        <div className="wfp-auth-foot">
          <Link to="/forgot-password" style={{ color: 'var(--wf-accent)' }}>
            Запитати нове посилання →
          </Link>
        </div>
        <AuthStatus left="reset link invalid" />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeader title="Новий пароль" sub="// встановіть новий пароль" />
      <form onSubmit={(e) => void submit(e)} style={{ display: 'contents' }}>
        <div>
          <Input
            label="Новий пароль"
            type="password"
            error={errors.password?.message}
            {...register('password', { required: 'Введіть пароль' })}
          />
          <PasswordStrengthMeter value={password} />
        </div>
        <Input
          label="Підтвердження пароля"
          type="password"
          error={(errors.confirm?.message ?? formError) || undefined}
          {...register('confirm', { required: 'Підтвердіть пароль' })}
        />
        <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
          Зберегти пароль
        </Button>
      </form>
      <div className="wfp-auth-foot">
        <Link to="/login" style={{ color: 'var(--wf-accent)' }}>
          ← повернутися на вхід
        </Link>
      </div>
      <AuthStatus />
    </AuthShell>
  )
}
