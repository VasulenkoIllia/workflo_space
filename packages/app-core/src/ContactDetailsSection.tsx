import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, Input } from '@workflo/ui'
import { api } from './api.js'

/**
 * S9-06 (хвіст): контактні дані профілю — телефон + IANA-часовий пояс. Спільна
 * секція для portal /settings і workspace /profile (PATCH /profile). Часовий пояс
 * зараз довідковий (тихі години лишаються Kyiv-anchored) — але зберігається, щоб
 * майбутня per-user локалізація часу мала джерело.
 */
const TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['Europe/Kyiv', 'Europe/Warsaw', 'Europe/Berlin', 'Europe/London', 'America/New_York']
  }
})()

export function ContactDetailsSection(props: {
  initialPhone?: string | null
  initialTimezone?: string | null
  /** Викликається після успішного збереження (напр., reload auth-стану). */
  onSaved?: () => void
  cardStyle?: React.CSSProperties
}) {
  const [phone, setPhone] = useState(props.initialPhone ?? '')
  const [timezone, setTimezone] = useState(props.initialTimezone ?? '')

  const save = useMutation({
    mutationFn: (body: { phone: string | null; timezone: string | null }) =>
      api.patch('/profile', body),
    onSuccess: () => {
      toast.success('Контактні дані збережено')
      props.onSaved?.()
    },
    onError: () => toast.error('Не вдалося зберегти'),
  })

  const dirty = phone !== (props.initialPhone ?? '') || timezone !== (props.initialTimezone ?? '')

  return (
    <Card title="Контактні дані" style={props.cardStyle}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label="Телефон"
          placeholder="+380 __ ___ __ __"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div>
          <label
            className="wfp-mono"
            style={{ display: 'block', fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 4 }}
          >
            часовий пояс
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--wf-surface)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '8px 10px',
              fontSize: 14,
            }}
          >
            <option value="">— не вказано —</option>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!dirty}
            onClick={() => save.mutate({ phone: phone.trim() || null, timezone: timezone || null })}
          >
            Зберегти
          </Button>
        </div>
      </div>
    </Card>
  )
}
