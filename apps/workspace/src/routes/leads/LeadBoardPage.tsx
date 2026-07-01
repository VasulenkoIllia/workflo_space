import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useCompanies } from '@/lib/projects'
import {
  type Lead,
  type LeadStatus,
  useConvertLead,
  useCreateLead,
  useDeleteLead,
  useLeads,
  useUpdateLead,
} from '@/lib/leads'

const COLUMNS: { id: LeadStatus; label: string }[] = [
  { id: 'new', label: 'Нові' },
  { id: 'contacted', label: 'Контакт' },
  { id: 'qualified', label: 'Кваліфіковані' },
  { id: 'proposal', label: 'Пропозиція' },
  { id: 'won', label: 'Виграні' },
  { id: 'lost', label: 'Втрачені' },
]

/** Leads board (module 26) — pipeline kanban. Drag cards between stages; create new leads;
 * convert a lead into a client order. Internal team. */
export function LeadBoardPage() {
  const { data, isLoading } = useLeads()
  const update = useUpdateLead()
  const del = useDeleteLead()
  const [over, setOver] = useState<LeadStatus | null>(null)
  const [creating, setCreating] = useState(false)
  const [converting, setConverting] = useState<Lead | null>(null)

  const leads = data?.leads ?? []
  const byCol = (s: LeadStatus) => leads.filter((l) => l.status === s)

  const drop = (status: LeadStatus, lead: Lead) => {
    setOver(null)
    if (lead.status === status) return
    // «Виграно» means converting to an order (creates the linked Order) — route the drop through
    // the convert modal instead of a bare status PATCH (which the backend rejects anyway).
    if (status === 'won') {
      if (!lead.convertedOrderId) setConverting(lead)
      return
    }
    // «Втрачено» — capture the reason (CRM lost-reason tracking); Cancel aborts the move.
    if (status === 'lost') {
      const reason = window.prompt(`Причина втрати ліда «${lead.name}»?`, lead.lostReason ?? '')
      if (reason === null) return
      update.mutate(
        { id: lead.id, status, lostReason: reason.trim() || null },
        { onError: () => toast.error('Не вдалося перемістити лід') }
      )
      return
    }
    update.mutate(
      { id: lead.id, status },
      { onError: () => toast.error('Не вдалося перемістити лід') }
    )
  }

  // Pipeline stats from the current set (design: active count + conversion %).
  const activeCount = leads.filter((l) => l.status !== 'won' && l.status !== 'lost').length
  const wonCount = leads.filter((l) => l.status === 'won').length
  const lostCount = leads.filter((l) => l.status === 'lost').length
  const conversionPct =
    wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null
  const colSum = (s: LeadStatus) =>
    byCol(s).reduce((acc, l) => acc + (l.estimatedValue ? Number(l.estimatedValue) : 0), 0)

  const remove = (lead: Lead) => {
    if (!window.confirm(`Видалити лід «${lead.name}»?`)) return
    del.mutate(lead.id, {
      onSuccess: () => toast.success('Лід видалено'),
      onError: () => toast.error('Не вдалося видалити'),
    })
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            // воронка продажів · {activeCount} активних
            {conversionPct != null ? ` · конверсія ${conversionPct}%` : ''}
          </div>
          <h1 className="wfp-ph-h1">Ліди</h1>
        </div>
        <div className="wfp-ph-r">
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Лід
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(180px, 1fr))`,
            gap: 10,
            alignItems: 'start',
            overflowX: 'auto',
          }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e: DragEvent) => {
                e.preventDefault()
                setOver(col.id)
              }}
              onDragLeave={() => setOver((c) => (c === col.id ? null : c))}
              onDrop={(e: DragEvent) => {
                const id = e.dataTransfer.getData('text/plain')
                const lead = leads.find((l) => l.id === id)
                if (lead) drop(col.id, lead)
              }}
              style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: 8,
                minHeight: 140,
                ...(over === col.id ? { outline: '2px dashed var(--wf-accent)' } : {}),
              }}
            >
              <div
                className="wfp-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--wf-fg-muted)',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{col.label}</span>
                <span>
                  {byCol(col.id).length}
                  {colSum(col.id) > 0 ? ` · $${colSum(col.id).toLocaleString('uk-UA')}` : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {byCol(col.id).map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/plain', l.id)}
                    style={{
                      background: 'var(--wf-bg)',
                      border: '1px solid var(--wf-border)',
                      borderRadius: 'var(--wf-radius)',
                      padding: '8px 10px',
                      cursor: 'grab',
                    }}
                  >
                    <Link
                      to={`/leads/${l.id}`}
                      className="wfp-link"
                      style={{ fontSize: 13, fontWeight: 500 }}
                    >
                      {l.name}
                    </Link>
                    {(l.contactName || l.estimatedValue) && (
                      <div
                        className="wfp-mono"
                        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 2 }}
                      >
                        {l.contactName ?? ''}
                        {l.contactName && l.estimatedValue ? ' · ' : ''}
                        {l.estimatedValue ? `${Number(l.estimatedValue)} ${l.currency}` : ''}
                      </div>
                    )}
                    {l.status === 'lost' && l.lostReason && (
                      <div
                        className="wfp-mono"
                        style={{ fontSize: 11, color: 'var(--wf-destructive)', marginTop: 2 }}
                      >
                        ✕ {l.lostReason}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      {l.convertedOrderId ? (
                        <span
                          className="wfp-mono"
                          style={{ fontSize: 10, color: 'var(--wf-accent)' }}
                        >
                          ✓ замовлення
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="wfp-link"
                          style={{ fontSize: 11 }}
                          onClick={() => setConverting(l)}
                        >
                          конвертувати
                        </button>
                      )}
                      <button
                        type="button"
                        className="wfp-link"
                        style={{ fontSize: 11, color: 'var(--wf-destructive)' }}
                        onClick={() => remove(l)}
                      >
                        видалити
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <CreateLeadModal onClose={() => setCreating(false)} />}
      {converting && <ConvertLeadModal lead={converting} onClose={() => setConverting(null)} />}
    </div>
  )
}

function CreateLeadModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLead()
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')

  const submit = () => {
    if (name.trim() === '') {
      toast.error('Вкажіть назву ліда')
      return
    }
    const v = value.trim() === '' ? null : Number(value.replace(',', '.'))
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      toast.error('Сума: невідʼємне число')
      return
    }
    create.mutate(
      {
        name: name.trim(),
        contactName: contactName.trim() || null,
        email: email.trim() || null,
        source: source.trim() || null,
        estimatedValue: v,
      },
      {
        onSuccess: () => {
          toast.success('Лід створено')
          onClose()
        },
        onError: () => toast.error('Не вдалося створити лід'),
      }
    )
  }

  return (
    <Modal open onClose={onClose} title="Новий лід">
      <div style={{ display: 'grid', gap: 10 }}>
        <Input label="Назва / угода" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Контактна особа"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Орієнтовна сума"
          inputMode="decimal"
          placeholder="1000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Input
          label="Джерело"
          placeholder="website / referral / telegram"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            Створити
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ConvertLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const convert = useConvertLead()
  const { data } = useCompanies()
  const companies = data?.companies ?? []
  const [companyId, setCompanyId] = useState('')
  const [title, setTitle] = useState(lead.name)

  const submit = () => {
    if (companyId === '') {
      toast.error('Оберіть компанію-клієнта')
      return
    }
    convert.mutate(
      { id: lead.id, companyId, title: title.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Лід конвертовано в замовлення')
          onClose()
        },
        onError: () => toast.error('Не вдалося конвертувати'),
      }
    )
  }

  return (
    <Modal open onClose={onClose} title={`Конвертувати: ${lead.name}`}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // створить замовлення для обраної компанії-клієнта й позначить лід «виграно»
        </div>
        <Select
          label="Компанія-клієнт"
          value={companyId}
          onChange={setCompanyId}
          options={[
            { value: '', label: '— оберіть —' },
            ...companies.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Input label="Назва замовлення" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button variant="primary" loading={convert.isPending} onClick={submit}>
            Конвертувати
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
        </div>
      </div>
    </Modal>
  )
}
