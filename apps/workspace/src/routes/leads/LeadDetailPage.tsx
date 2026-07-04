import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useCompanies } from '@/lib/projects'
import {
  type Lead,
  type LeadStatus,
  useConvertLead,
  useDeleteLead,
  useLead,
  useUpdateLead,
} from '@/lib/leads'

// «won» is set only by convert; the free-edit dropdown offers the other stages.
const STAGE_OPTIONS: { value: Exclude<LeadStatus, 'won'>; label: string }[] = [
  { value: 'new', label: 'Новий' },
  { value: 'contacted', label: 'Контакт' },
  { value: 'qualified', label: 'Кваліфікований' },
  { value: 'proposal', label: 'Пропозиція' },
  { value: 'lost', label: 'Втрачено' },
]

export function LeadDetailPage() {
  const { id = '' } = useParams()
  const { data: lead, isLoading, isError } = useLead(id)

  if (isLoading) return <Skeleton style={{ height: 320 }} />
  if (isError || !lead) {
    return (
      <div>
        <Link to="/leads" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          ← ліди
        </Link>
        <EmptyState glyph="// 404" title="Лід не знайдено" description="Можливо, його видалено." />
      </div>
    )
  }
  return <LeadEditor lead={lead} />
}

function LeadEditor({ lead }: { lead: Lead }) {
  const navigate = useNavigate()
  const update = useUpdateLead()
  const convert = useConvertLead()
  const del = useDeleteLead()
  const { data: companiesData } = useCompanies()
  const companies = companiesData?.companies ?? []

  const [f, setF] = useState({
    name: lead.name,
    contactName: lead.contactName ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    source: lead.source ?? '',
    estimatedValue: lead.estimatedValue ?? '',
    status: lead.status === 'won' ? ('qualified' as const) : lead.status,
    lostReason: lead.lostReason ?? '',
    notes: lead.notes ?? '',
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const [companyId, setCompanyId] = useState('')

  const converted = Boolean(lead.convertedOrderId)

  const save = () => {
    if (f.name.trim() === '') {
      toast.error('Назва обовʼязкова')
      return
    }
    const v = f.estimatedValue === '' ? null : Number(String(f.estimatedValue).replace(',', '.'))
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      toast.error('Сума: невідʼємне число')
      return
    }
    update.mutate(
      {
        id: lead.id,
        name: f.name.trim(),
        contactName: f.contactName.trim() || null,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        source: f.source.trim() || null,
        estimatedValue: v,
        // don't re-send status/lostReason for an already-won lead (won is convert-only)
        ...(converted ? {} : { status: f.status }),
        ...(f.status === 'lost' ? { lostReason: f.lostReason.trim() || null } : {}),
        notes: f.notes.trim() || null,
      },
      {
        onSuccess: () => toast.success('Збережено'),
      }
    )
  }

  const doConvert = () => {
    if (companyId === '') {
      toast.error('Оберіть компанію-клієнта')
      return
    }
    convert.mutate(
      { id: lead.id, companyId },
      {
        onSuccess: () => {
          toast.success('Лід конвертовано в замовлення')
        },
      }
    )
  }

  const remove = () => {
    if (!window.confirm(`Видалити лід «${lead.name}»?`)) return
    del.mutate(lead.id, {
      onSuccess: () => {
        toast.success('Лід видалено')
        navigate('/leads')
      },
    })
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            //{' '}
            <Link to="/leads" className="wfp-link">
              ліди
            </Link>{' '}
            / {lead.name}
          </div>
          <h1 className="wfp-ph-h1">{lead.name}</h1>
        </div>
        <div className="wfp-ph-r">
          <Button variant="ghost" onClick={remove}>
            Видалити
          </Button>
        </div>
      </div>

      <Card title="Деталі ліда" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <Input
            label="Назва / угода"
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Контактна особа"
            value={f.contactName}
            onChange={(e) => set('contactName', e.target.value)}
          />
          <Input label="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Телефон" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Джерело" value={f.source} onChange={(e) => set('source', e.target.value)} />
          <Input
            label="Орієнтовна сума"
            inputMode="decimal"
            value={String(f.estimatedValue)}
            onChange={(e) => set('estimatedValue', e.target.value)}
          />
          {!converted && (
            <Select
              label="Стадія"
              value={f.status}
              onChange={(v) => set('status', v)}
              options={STAGE_OPTIONS}
            />
          )}
          {!converted && f.status === 'lost' && (
            <Input
              label="Причина втрати"
              value={f.lostReason}
              onChange={(e) => set('lostReason', e.target.value)}
            />
          )}
        </div>

        <label style={{ display: 'grid', gap: 4, marginTop: 12 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            НОТАТКИ
          </span>
          <textarea
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={4}
            style={{
              background: 'var(--wf-surface)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '8px 10px',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
        </label>

        <div style={{ marginTop: 14 }}>
          <Button variant="primary" loading={update.isPending} onClick={save}>
            Зберегти
          </Button>
        </div>
      </Card>

      <Card title="Конвертація">
        {converted ? (
          <div style={{ fontSize: 13 }}>
            <span className="wfp-mono" style={{ color: 'var(--wf-accent)' }}>
              ✓ конвертовано в замовлення
            </span>{' '}
            <Link to={`/orders/${lead.convertedOrderId}`} className="wfp-link">
              відкрити замовлення →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <Select
                label="Компанія-клієнт"
                value={companyId}
                onChange={setCompanyId}
                options={[
                  { value: '', label: '— оберіть —' },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <Button variant="secondary" loading={convert.isPending} onClick={doConvert}>
              Конвертувати в замовлення
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
