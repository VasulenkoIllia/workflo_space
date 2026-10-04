import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Locale } from '@workflo/i18n'
import {
  ContactDetailsSection,
  DataExportSection,
  EmailChangeSection,
  LinkedAccountsSection,
  NotificationsSection,
  PasswordSection,
  SessionsSection,
  TelegramSection,
  TwoFactorSection,
} from '@workflo/app-core'
import { Button, Card, Input, useTheme, type ThemeMode } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Світла' },
  { id: 'dark', label: 'Темна' },
  { id: 'system', label: 'Системна' },
]

export function SettingsPage() {
  const { user, reload } = useAuth()
  const { theme, setTheme } = useTheme()
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
          {/* D17: вибір мови повернеться з i18n (DSN-9) */}
        </div>
      </Card>

      <ContactDetailsSection
        initialPhone={user?.profile.phone}
        initialTimezone={user?.profile.timezone}
        onSaved={() => void reload()}
        cardStyle={{ marginBottom: 16 }}
      />

      {/* DEDUP C10: реквізити компанії — у «Моя компанія» (дім компанії), тут лише особисте */}

      <NotificationsSection cardStyle={{ marginBottom: 16 }} />

      <TelegramSection app="portal" cardStyle={{ marginBottom: 16 }} />

      <PasswordSection cardStyle={{ marginBottom: 16 }} />

      <EmailChangeSection
        currentEmail={user?.profile.email ?? ''}
        pendingEmail={user?.pendingEmail}
        cardStyle={{ marginBottom: 16 }}
      />

      <TwoFactorSection app="portal" cardStyle={{ marginBottom: 16 }} />

      <LinkedAccountsSection app="portal" cardStyle={{ marginBottom: 16 }} />

      <DataExportSection cardStyle={{ marginBottom: 16 }} />

      <SessionsSection />
    </div>
  )
}
