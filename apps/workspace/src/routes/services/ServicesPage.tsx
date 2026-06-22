import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import {
  num,
  useDeleteService,
  useSaveService,
  useServices,
  type CatalogService,
  type ServiceInput,
} from '@/lib/services'

function ServiceModal({
  service,
  onClose,
}: {
  service: CatalogService | null
  onClose: () => void
}) {
  const save = useSaveService()
  const editing = service != null
  const [name, setName] = useState(service?.name ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [price, setPrice] = useState(service?.defaultPriceUsd ?? '')
  const [hours, setHours] = useState(service?.estimatedHours ?? '')
  const [recurring, setRecurring] = useState(service?.isRecurring ?? true)

  const nameInvalid = name.trim().length < 2

  const submit = () => {
    if (nameInvalid) return
    const body: ServiceInput & { id?: string } = {
      id: service?.id,
      name: name.trim(),
      description: description.trim() || null,
      defaultPriceUsd: price === '' ? null : Number(price),
      estimatedHours: hours === '' ? null : Number(hours),
      isRecurring: recurring,
    }
    save.mutate(body, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Редагувати послугу' : 'Нова послуга'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Скасувати
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? 'Зберегти' : 'Створити'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Input
          label="Назва"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameInvalid ? 'Мінімум 2 символи' : undefined}
        />
        <Input label="Опис" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Ціна за замовч., USD"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            label="Орієнтовні години"
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          Регулярна (абонентська) послуга
        </label>
        {save.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
            Не вдалося зберегти — перевірте поля.
          </div>
        )}
      </div>
    </Modal>
  )
}

export function ServicesPage() {
  const services = useServices()
  const del = useDeleteService()
  const save = useSaveService()
  const [editing, setEditing] = useState<CatalogService | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  const list = services.data?.services ?? []
  const q = search.trim().toLowerCase()
  const filtered = q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list
  const activeCount = list.filter((s) => s.isActive).length
  const recurringCount = list.filter((s) => s.isRecurring).length
  const oneTimeCount = list.length - recurringCount

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Каталог послуг</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // послуги для кошторисів і нарахувань
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          Нова послуга
        </Button>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 14 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-v">{list.length}</div>
          <div className="wfp-stat-k">усього</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-v wfp-stat-v--accent">{activeCount}</div>
          <div className="wfp-stat-k">активних</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-v">{recurringCount}</div>
          <div className="wfp-stat-k">абонентських</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-v">{oneTimeCount}</div>
          <div className="wfp-stat-k">разових</div>
        </div>
      </div>

      <div style={{ maxWidth: 320, marginBottom: 14 }}>
        <Input
          placeholder="Пошук послуги…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {services.isLoading ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <EmptyState
          title="Послуг ще немає"
          description="Створіть послуги, щоб формувати кошториси й рахунки."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Нічого не знайдено" description="Змініть запит пошуку." />
      ) : (
        <Card>
          {filtered.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--wf-border)',
                opacity: s.isActive ? 1 : 0.55,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.name}
                  {s.isRecurring && (
                    <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-accent)' }}>
                      // абон
                    </span>
                  )}
                  {!s.isActive && (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                    >
                      <StatusDot tone="muted" /> неактивна
                    </span>
                  )}
                </div>
                {s.description ? (
                  <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
                    {s.description}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {s.defaultPriceUsd ? `${formatMoney(num(s.defaultPriceUsd))}` : '—'}
                  {s.estimatedHours ? (
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}
                    >
                      {' '}
                      · {s.estimatedHours}год
                    </span>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => save.mutate({ id: s.id, isActive: !s.isActive })}
                >
                  {s.isActive ? 'Вимкнути' : 'Увімкнути'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Змінити
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={del.isPending}
                  onClick={() => del.mutate(s.id)}
                >
                  Видалити
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {(creating || editing) && (
        <ServiceModal
          service={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
