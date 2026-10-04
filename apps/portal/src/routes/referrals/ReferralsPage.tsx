import { useState } from 'react'
import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { formatDate, formatMoney } from '@/lib/format'
import { num, useReferral } from '@/lib/referral'

export function ReferralsPage() {
  const referral = useReferral()
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  if (referral.isLoading) {
    return (
      <div>
        <Skeleton variant="title" />
        <div style={{ marginTop: 16 }}>
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    )
  }
  if (referral.isError || !referral.data) {
    return (
      <EmptyState
        title="Не вдалося завантажити реферали"
        description="Спробуйте оновити сторінку."
        action={<Button onClick={() => void referral.refetch()}>Оновити</Button>}
      />
    )
  }

  const r = referral.data
  const inviteLink = `${window.location.origin}/register?ref=${r.referralCode}`
  const copy = () => {
    void navigator.clipboard?.writeText(r.referralCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  const copyLink = () => {
    void navigator.clipboard?.writeText(inviteLink).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 1500)
    })
  }

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Реферали</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // приводьте клієнтів і отримуйте бонус на гаманець
      </div>

      {!r.enabled && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--wf-fg-muted)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
            padding: '10px 12px',
            marginBottom: 16,
          }}
        >
          <StatusDot tone="muted" /> Реферальна програма зараз вимкнена — нові бонуси не
          нараховуються.
        </div>
      )}

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <div className="wfp-stat">
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--wf-accent)' }}>
            {formatMoney(num(r.totalEarned))}
          </div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            зароблено всього
          </div>
        </div>
        <div className="wfp-stat">
          <div style={{ fontSize: 22, fontWeight: 600 }}>{r.referrals.length}</div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            приведено клієнтів
          </div>
        </div>
      </div>

      <Card title="Ваш реферальний код">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span
            className="wfp-mono"
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 0.5,
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '8px 12px',
              userSelect: 'all',
            }}
          >
            {r.referralCode}
          </span>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? 'Код скопійовано ✓' : 'Копіювати код'}
          </Button>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copiedLink ? 'Посилання ✓' : 'Копіювати посилання'}
          </Button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)', marginTop: 10 }}>
          Дайте цей код або посилання новому клієнту — коли він зареєструється й оплатить, ви
          отримаєте бонус на гаманець.
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginTop: 18,
        }}
      >
        <StepCard
          n={1}
          title="Поділіться кодом"
          text="Надішліть код або посилання потенційному клієнту."
        />
        <StepCard
          n={2}
          title="Клієнт реєструється"
          text="Він створює акаунт із вашим кодом і починає роботу."
        />
        <StepCard
          n={3}
          title="Ви отримуєте бонус"
          text="Після його оплати бонус нараховується на ваш гаманець."
        />
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 12 }}>
        Приведені клієнти
      </div>
      {r.referrals.length === 0 ? (
        <EmptyState
          title="Поки нікого не приведено"
          description="Поділіться кодом — приведені клієнти зʼявляться тут."
        />
      ) : (
        <Card>
          {r.referrals.map((ref) => (
            <div
              key={ref.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{ref.name}</div>
                <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  з {formatDate(ref.since)}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--wf-accent)' }}>
                +{formatMoney(num(ref.totalEarned))}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function StepCard({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="wfp-card">
      <div
        className="wfp-mono"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: 'var(--wf-accent-soft)',
          color: 'var(--wf-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {n}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>{text}</div>
    </div>
  )
}
