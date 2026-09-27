import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { NotificationsSection, TelegramSection } from '@workflo/app-core'
import type { TestNotificationInput } from '@workflo/types'
import { Button, Card, Tabs } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { AnnouncementsPage } from '@/routes/announcements/AnnouncementsPage'
import { EmailReportsSection, SlaPoliciesSection } from '@/routes/settings/SettingsPage'

type Channel = TestNotificationInput['channel']
const CHANNELS: { id: Channel; label: string; hint: string }[] = [
  { id: 'email', label: 'Email', hint: 'лист на вашу адресу входу' },
  { id: 'telegram', label: 'Telegram-бот', hint: 'повідомлення від бота (треба привʼязати)' },
  { id: 'in_app', label: 'In-app', hint: 'сповіщення в дзвіночку' },
]

/**
 * DSN-7 · design-v2 workspace-notify.jsx → WsNotifications: ОДИН хаб сповіщень замість
 * розкиданих екранів (оголошення — окремий пункт меню; дайджест і пороги — у «Налаштування →
 * Воркфлоу»; матриця — у «Налаштування → Акаунт»). Адмін-таби — за правами; «Мої канали» і
 * «Тест» — кожному (лише про себе).
 */
export function NotificationsHubPage() {
  const { can } = useAuth()
  const [params] = useSearchParams()
  const items = [
    ...(can('announcements.manage') || can('broadcasts.manage')
      ? [{ id: 'announce', label: 'Оголошення й розсилки' }]
      : []),
    ...(can('settings.manage') ? [{ id: 'digest', label: 'Дайджест' }] : []),
    ...(can('settings.manage') ? [{ id: 'thresholds', label: 'Пороги відповіді' }] : []),
    { id: 'matrix', label: 'Мої канали' },
    { id: 'test', label: 'Тест' },
  ]
  const wanted = params.get('tab')
  const [tab, setTab] = useState(
    items.some((i) => i.id === wanted) ? (wanted as string) : (items[0]?.id ?? 'matrix')
  )

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Сповіщення</h1>
          <div className="wfp-ph-sub">
            // оголошення · дайджест · пороги відповіді · канали · тест доставки
          </div>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} items={items} />

      <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
        {tab === 'announce' && <AnnouncementsPage embedded />}
        {tab === 'digest' && <EmailReportsSection />}
        {tab === 'thresholds' && <SlaPoliciesSection />}
        {tab === 'matrix' && (
          <>
            <NotificationsSection />
            <TelegramSection app="workspace" />
          </>
        )}
        {tab === 'test' && <TestChannel />}
      </div>
    </div>
  )
}

function TestChannel() {
  const [channel, setChannel] = useState<Channel>('in_app')
  const send = useMutation({
    mutationFn: (c: Channel) =>
      api.post<{ channel: Channel; status: string; to?: string }>('/notifications/test', {
        channel: c,
      }),
    onSuccess: (r) =>
      toast.success(
        r.channel === 'email'
          ? `Тестовий лист надіслано на ${r.to ?? 'вашу адресу'}`
          : r.channel === 'telegram'
            ? 'Тестове повідомлення надіслано в Telegram'
            : 'Тестове сповіщення — у дзвіночку'
      ),
  })

  return (
    <Card title="Тестове сповіщення" style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', marginBottom: 14 }}>
        Надішліть тестове сповіщення собі, щоб перевірити, що канал підключений і доходить.
      </div>
      <div role="radiogroup" style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {CHANNELS.map((c) => (
          <label
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: `1px solid ${channel === c.id ? 'var(--wf-accent)' : 'var(--wf-border)'}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="test-channel"
              checked={channel === c.id}
              onChange={() => setChannel(c.id)}
            />
            <span style={{ fontWeight: 500 }}>{c.label}</span>
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              {c.hint}
            </span>
          </label>
        ))}
      </div>
      <Button variant="primary" loading={send.isPending} onClick={() => send.mutate(channel)}>
        Надіслати тестове
      </Button>
      {send.isSuccess && (
        <div
          className="wfp-mono"
          style={{ fontSize: 12, color: 'var(--wf-success)', marginTop: 12 }}
        >
          ✓ надіслано через {CHANNELS.find((c) => c.id === send.data?.channel)?.label}
        </div>
      )}
    </Card>
  )
}
