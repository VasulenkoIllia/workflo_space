import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'

const resetForm = z
  .object({
    password: z.string().min(8, 'Мінімум 8 символів').max(128, 'Задовгий пароль'),
    confirm: z.string().min(1, 'Підтвердіть пароль'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Паролі не співпадають' })

type ResetForm = z.infer<typeof resetForm>

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetForm) })
  const password = watch('password', '')

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await api.post('/auth/reset-password', { token, password: values.password })
      toast.success('Пароль змінено. Увійдіть з новим паролем.')
      navigate('/login', { replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Не вдалося змінити пароль')
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
            {...register('password')}
          />
          <PasswordStrengthMeter value={password} />
        </div>
        <Input
          label="Підтвердження пароля"
          type="password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        {serverError != null && (
          <div className="wfp-field-hint wfp-field-hint--error">{serverError}</div>
        )}
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
