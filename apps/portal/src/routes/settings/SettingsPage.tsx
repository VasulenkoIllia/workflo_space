import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Locale } from '@workflo/i18n'
import { Button, Card, Input, useTheme, type ThemeMode } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Світла' },
  { id: 'dark', label: 'Темна' },
  { id: 'system', label: 'Системна' },
]
const LOCALES: { id: Locale; label: string }[] = [
  { id: 'uk', label: 'UA' },
  { id: 'en', label: 'EN' },
]

export function SettingsPage() {
  const { user, reload } = useAuth()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useI18n()
  const [name, setName] = useState(user?.profile.displayName ?? '')

  // Display-name save → confirm + refresh auth (sidebar/topbar reflect it).
  const profileMut = useMutation({
    mutationFn: (body: { displayName: string }) => api.patch('/profile', body),
    onSuccess: () => {
      toast.success('Збережено')
      void reload()
    },
  })

  // Appearance prefs → silent server-sync (localStorage already updated instantly).
  const prefMut = useMutation({
    mutationFn: (body: { theme?: ThemeMode; language?: Locale }) => api.patch('/profile', body),
  })

  const setThemePref = (t: ThemeMode) => {
    setTheme(t)
    prefMut.mutate({ theme: t })
  }
  const setLocalePref = (l: Locale) => {
    setLocale(l)
    prefMut.mutate({ language: l })
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Налаштування</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // {user?.profile.email}
      </div>

      <Card title="Профіль" style={{ marginBottom: 16 }}>
        <Input label="Імʼя та прізвище" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <Button
            variant="primary"
            loading={profileMut.isPending}
            disabled={name.trim().length < 2 || name.trim() === user?.profile.displayName}
            onClick={() => profileMut.mutate({ displayName: name.trim() })}
          >
            Зберегти
          </Button>
        </div>
      </Card>

      <Card title="Вигляд" style={{ marginBottom: 16 }}>
        <div className="wfp-side">
          <div className="wfp-side-row">
            <div className="wfp-side-k">тема</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="wfp-pill"
                  data-on={theme === t.id || undefined}
                  onClick={() => setThemePref(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="wfp-side-row">
            <div className="wfp-side-k">мова</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {LOCALES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="wfp-pill"
                  data-on={locale === l.id || undefined}
                  onClick={() => setLocalePref(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <PasswordSection />
    </div>
  )
}

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.patch('/profile/password', body),
    meta: { suppressGlobalToast: true }, // surface the server error inline instead
    onSuccess: () => {
      toast.success('Пароль змінено. Інші сесії завершено.')
      setCurrent('')
      setNext('')
      setConfirm('')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося змінити пароль'),
  })

  const submit = () => {
    setError(null)
    if (next.length < 8 || next.length > 128) {
      setError('Пароль — від 8 до 128 символів')
      return
    }
    if (next !== confirm) {
      setError('Паролі не співпадають')
      return
    }
    mut.mutate({ currentPassword: current, newPassword: next })
  }

  return (
    <Card title="Безпека">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label="Поточний пароль"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <div>
          <Input
            label="Новий пароль"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <PasswordStrengthMeter value={next} />
        </div>
        <Input
          label="Підтвердження"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error ?? undefined}
        />
        <div>
          <Button
            variant="primary"
            loading={mut.isPending}
            disabled={!current || !next || !confirm}
            onClick={submit}
          >
            Змінити пароль
          </Button>
        </div>
      </div>
    </Card>
  )
}
