import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { registerSchema } from '@workflo/types'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'

type RegisterForm = { displayName: string; email: string; password: string; companyName: string }

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), mode: 'onBlur' })
  const password = watch('password', '')

  const goNext = async () => {
    const ok = await trigger(['displayName', 'email', 'password'])
    if (ok) setStep(1)
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await registerUser(values)
      navigate('/orders', { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не вдалося зареєструватися')
    }
  })

  return (
    <AuthShell wide>
      <AuthHeader
        title={step === 0 ? 'Створіть акаунт' : 'Розкажіть про компанію'}
        sub={step === 0 ? '// 60 секунд · 0 ₴' : '// для рахунків і документів'}
      />
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        // крок {step + 1} з 2
      </div>
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'contents' }}>
        {step === 0 ? (
          <>
            <Input
              label="Імʼя та прізвище"
              placeholder="Олена Іваненко"
              error={errors.displayName?.message}
              {...register('displayName')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="olena@brunky.ua"
              hint="Цей email буде вашим логіном"
              error={errors.email?.message}
              {...register('email')}
            />
            <div>
              <Input
                label="Пароль"
                type="password"
                error={errors.password?.message}
                {...register('password')}
              />
              <PasswordStrengthMeter value={password} />
            </div>
            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 12,
                color: 'var(--wf-fg-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ accentColor: 'var(--wf-accent-bg)', marginTop: 2 }}
              />
              <span>Я погоджуюсь з умовами використання та політикою конфіденційності</span>
            </label>
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={!agreed}
              onClick={() => void goNext()}
            >
              Далі · крок 2 →
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Назва компанії"
              placeholder="ТОВ «Брунки»"
              hint="Для рахунків і документів"
              error={errors.companyName?.message}
              {...register('companyName')}
            />
            {formError != null && (
              <div className="wfp-field-hint wfp-field-hint--error">{formError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                ← Назад
              </Button>
              <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                Створити акаунт
              </Button>
            </div>
          </>
        )}
      </form>
      <div className="wfp-auth-foot">
        вже маєте акаунт?{' '}
        <Link to="/login" style={{ color: 'var(--wf-accent)' }}>
          увійти →
        </Link>
      </div>
      <AuthStatus left="реєстрація відкрита" right="$ invite-free" />
    </AuthShell>
  )
}
