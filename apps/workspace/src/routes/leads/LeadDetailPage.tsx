import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useCompanies } from '@/lib/projects'
import { useTeam } from '@/lib/payouts'
import {
  type Lead,
  type LeadActivity,
  type LeadStatus,
  useConvertLead,
  useDeleteLead,
  useLead,
  useLeadActivity,
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

const STAGE_LABELS: Record<string, string> = {
  new: 'Новий',
  contacted: 'Контакт',
  qualified: 'Кваліфікований',
  proposal: 'Пропозиція',
  won: 'Виграно',
  lost: 'Втрачено',
}

const FIELD_LABELS: Record<string, string> = {
  name: 'назва',
  contactName: 'контактна особа',
  email: 'email',
  phone: 'телефон',
  source: 'джерело',
  estimatedValue: 'сума',
  notes: 'нотатки',
}

const UTM_LABELS: [keyof Lead, string][] = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmTerm', 'utm_term'],
  ['utmContent', 'utm_content'],
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

      {UTM_LABELS.some(([k]) => lead[k]) && (
        <Card title="Джерело · UTM" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {UTM_LABELS.filter(([k]) => lead[k]).map(([k, label]) => (
              <span
                key={label}
                className="wfp-mono"
                style={{
                  fontSize: 11,
                  border: '1px solid var(--wf-border)',
                  borderRadius: 'var(--wf-radius)',
                  padding: '3px 8px',
                }}
              >
                <span style={{ color: 'var(--wf-fg-muted)' }}>{label}=</span>
                {String(lead[k])}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Конвертація" style={{ marginBottom: 16 }}>
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

      <ActivityTimeline leadId={lead.id} />
    </div>
  )
}

/** 26-ТАЙМЛАЙН: append-only journal of the lead's lifecycle (created / stage / assignee /
 * edits / convert). Website intakes have no actor and show as «сайт». */
function ActivityTimeline({ leadId }: { leadId: string }) {
  const { data: activities, isLoading } = useLeadActivity(leadId)
  const { data: teamData } = useTeam()
  const names = new Map((teamData?.members ?? []).map((m) => [m.profileId, m.name]))

  return (
    <Card title="Активність">
      {isLoading ? (
        <Skeleton style={{ height: 80 }} />
      ) : !activities || activities.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
          Подій ще немає — журнал ведеться з моменту цього оновлення.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {activities.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
              <span
                className="wfp-mono"
                style={{ color: 'var(--wf-fg-muted)', fontSize: 11, whiteSpace: 'nowrap' }}
              >
                {new Date(a.createdAt).toLocaleString('uk-UA', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span>
                <ActivityLine a={a} names={names} />{' '}
                <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  · {a.actorId === null ? 'сайт' : (names.get(a.actorId) ?? 'команда')}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ActivityLine({ a, names }: { a: LeadActivity; names: Map<string, string> }) {
  const m = a.metadata ?? {}
  switch (a.type) {
    case 'created':
      return m.via === 'website' ? (
        <>
          створено із заявки на сайті
          {typeof m.page === 'string' && m.page !== '' ? (
            <span className="wfp-mono" style={{ fontSize: 11 }}>
              {' '}
              ({m.page})
            </span>
          ) : null}
        </>
      ) : (
        <>створено вручну</>
      )
    case 'stage_changed':
      return (
        <>
          стадія: {STAGE_LABELS[String(m.from)] ?? String(m.from)} →{' '}
          <strong>{STAGE_LABELS[String(m.to)] ?? String(m.to)}</strong>
          {typeof m.lostReason === 'string' && m.lostReason !== ''
            ? ` — причина: ${m.lostReason}`
            : null}
        </>
      )
    case 'assigned': {
      const to = typeof m.to === 'string' ? m.to : null
      return to === null ? (
        <>відповідального знято</>
      ) : (
        <>
          відповідальний: <strong>{names.get(to) ?? to}</strong>
        </>
      )
    }
    case 'updated': {
      const fields = Array.isArray(m.fields) ? m.fields : []
      return <>оновлено: {fields.map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(', ')}</>
    }
    case 'converted': {
      const orderId = typeof m.orderId === 'string' ? m.orderId : ''
      return (
        <>
          конвертовано в{' '}
          <Link to={`/orders/${orderId}`} className="wfp-link">
            замовлення →
          </Link>
        </>
      )
    }
    default:
      return <>{a.type}</>
  }
}
