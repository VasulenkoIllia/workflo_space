import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input } from '@workflo/ui'
import { OrderPriority } from '@workflo/types'
import { PRIORITY_LABEL, useCreateOrder } from '@/lib/orders'

const PRIORITIES: OrderPriority[] = [
  OrderPriority.LOW,
  OrderPriority.MEDIUM,
  OrderPriority.HIGH,
  OrderPriority.URGENT,
]

const controlStyle = {
  width: '100%',
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 14,
} as const

/** Client creates a request (POST /orders). dueDate → ISO end-of-day (schema needs a future datetime). */
export function OrderCreatePage() {
  const navigate = useNavigate()
  const create = useCreateOrder()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<OrderPriority>(OrderPriority.MEDIUM)
  const [dueDate, setDueDate] = useState('')

  const titleInvalid = title.trim().length < 3

  const submit = () => {
    if (titleInvalid) return
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
      },
      { onSuccess: (res) => navigate(`/orders/${res.order.id}`) }
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Нове замовлення</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 20 }}
      >
        // опишіть задачу — команда візьме її в роботу
      </div>
      <Card>
        <div style={{ display: 'grid', gap: 14 }}>
          <Input
            label="Назва"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={titleInvalid && title.length > 0 ? 'мін. 3 символи' : undefined}
          />
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ОПИС
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Деталі, посилання, контекст…"
              style={{ ...controlStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                ПРІОРИТЕТ
              </span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as OrderPriority)}
                style={controlStyle}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                ДЕДЛАЙН (ОПЦ.)
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={controlStyle}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <Button variant="ghost" onClick={() => navigate('/orders')} disabled={create.isPending}>
              Скасувати
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={titleInvalid}
              onClick={submit}
            >
              Створити замовлення
            </Button>
          </div>
          {create.isError && (
            <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
              {create.error instanceof Error
                ? create.error.message
                : 'Не вдалося створити замовлення — спробуйте ще раз.'}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
