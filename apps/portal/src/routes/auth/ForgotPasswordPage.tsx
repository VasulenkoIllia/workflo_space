import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { forgotPasswordSchema } from '@workflo/types'
import { AuthShell, AuthHeader, AuthStatus, Input, Button } from '@workflo/ui'
import { api } from '@/lib/api'

type ForgotForm = { email: string }

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotPasswordSchema) })

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const submit = handleSubmit(async ({ email }) => {
    // Always treated as success (anti-enumeration) — the API never reveals existence.
    try {
      await api.post('/auth/forgot-password', { email })
    } catch {
      /* ignore */
    }
    setSent(true)
    setSeconds(47)
  })

  if (sent) {
    return (
      <AuthShell>
        <AuthHeader title="Перевірте пошту" sub={`// надіслали лист на ${getValues('email')}`} />
        <div className="wfp-field-hint">
          Якщо такий акаунт існує, лист із посиланням для скидання вже летить. Посилання діє 60
          хвилин — перевірте і папку «Спам».
        </div>
        <Button
          type="button"
          variant="primary"
          fullWidth
          disabled={seconds > 0}
          onClick={() => void submit()}
        >
          {seconds > 0 ? `Надіслати ще раз · ${seconds} с` : 'Надіслати ще раз'}
        </Button>
        <div className="wfp-auth-foot">
          <Link to="/login" style={{ color: 'var(--wf-accent)' }}>
            ← повернутися на вхід
          </Link>
        </div>
        <AuthStatus left="email sent" />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeader title="Забули пароль?" sub="// введіть email — надішлемо посилання" />
      <form onSubmit={(e) => void submit(e)} style={{ display: 'contents' }}>
        <Input
          label="Email акаунту"
          type="email"
          placeholder="olena@brunky.ua"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
          Надіслати посилання
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
