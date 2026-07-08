import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanies } from '@/lib/projects'
import {
  type Lead,
  type LeadStage,
  useConvertLead,
  useCreateLead,
  useCreateLeadStage,
  useDeleteLead,
  useDeleteLeadStage,
  useLeadStages,
  useLeads,
  useUpdateLead,
  useUpdateLeadStage,
} from '@/lib/leads'

/** Leads board (module 26) — pipeline kanban з КАСТОМНИМИ стадіями (ХВІСТ-4). Drag карток
 * між стадіями; owner редагує стадії; convert ліда в замовлення. Internal team. */
export function LeadBoardPage() {
  const { data, isLoading } = useLeads()
  const { data: stagesData } = useLeadStages()
  const update = useUpdateLead()
  const del = useDeleteLead()
  const [over, setOver] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingStages, setEditingStages] = useState(false)
  const [converting, setConverting] = useState<Lead | null>(null)

  const leads = data?.leads ?? []
  const stages = stagesData ?? []
  const byCol = (stageId: string) => leads.filter((l) => l.stageId === stageId)

  const drop = (stage: LeadStage, lead: Lead) => {
    setOver(null)
    if (lead.stageId === stage.id) return
    // «Виграно» (won-стадія) = конвертація в замовлення — через модалку, не bare PATCH.
    if (stage.kind === 'won') {
      if (!lead.convertedOrderId) setConverting(lead)
      return
    }
    // «Втрачено» (lost-стадія) — фіксуємо причину; Cancel скасовує рух.
    if (stage.kind === 'lost') {
      const reason = window.prompt(`Причина втрати ліда «${lead.name}»?`, lead.lostReason ?? '')
      if (reason === null) return
      update.mutate({ id: lead.id, stageId: stage.id, lostReason: reason.trim() || null })
      return
    }
    update.mutate({ id: lead.id, stageId: stage.id })
  }

  // Pipeline stats (status мірориться kind — won/lost надійні).
  const activeCount = leads.filter((l) => l.status !== 'won' && l.status !== 'lost').length
  const wonCount = leads.filter((l) => l.status === 'won').length
  const lostCount = leads.filter((l) => l.status === 'lost').length
  const conversionPct =
    wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null
  const colSum = (stageId: string) =>
    byCol(stageId).reduce((acc, l) => acc + (l.estimatedValue ? Number(l.estimatedValue) : 0), 0)

  const { isOwner } = useAuth()

  const remove = (lead: Lead) => {
    if (!window.confirm(`Видалити лід «${lead.name}»?`)) return
    del.mutate(lead.id, {
      onSuccess: () => toast.success('Лід видалено'),
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
        <div className="wfp-ph-r" style={{ display: 'flex', gap: 8 }}>
          {isOwner && (
            <Button variant="ghost" onClick={() => setEditingStages(true)}>
              ⚙ Стадії
            </Button>
          )}
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
            gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(180px, 1fr))`,
            gap: 10,
            alignItems: 'start',
            overflowX: 'auto',
          }}
        >
          {stages.map((col) => (
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
                if (lead) drop(col, lead)
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
                  color:
                    col.kind === 'won'
                      ? 'var(--wf-accent)'
                      : col.kind === 'lost'
                        ? 'var(--wf-destructive)'
                        : 'var(--wf-fg-muted)',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{col.name}</span>
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
                    {l.stage?.kind === 'lost' && l.lostReason && (
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
      {editingStages && (
        <StageEditorModal stages={stages} onClose={() => setEditingStages(false)} />
      )}
    </div>
  )
}

/** ХВІСТ-4: owner-редактор стадій воронки. Додати/переймен/сорт/видалити open-стадії;
 * won/lost можна лише перейменувати. */
function StageEditorModal({ stages, onClose }: { stages: LeadStage[]; onClose: () => void }) {
  const create = useCreateLeadStage()
  const rename = useUpdateLeadStage()
  const move = useUpdateLeadStage()
  const del = useDeleteLeadStage()
  const [newName, setNewName] = useState('')

  const openStages = stages.filter((s) => s.kind === 'open')
  const addStage = () => {
    const name = newName.trim()
    if (name === '') return
    create.mutate(name, {
      onSuccess: () => {
        setNewName('')
        toast.success('Стадію додано')
      },
      onError: () => toast.error('Не вдалося (можливо, назва зайнята)'),
    })
  }
  const renameStage = (s: LeadStage) => {
    const name = window.prompt('Нова назва стадії', s.name)
    if (name === null || name.trim() === '' || name.trim() === s.name) return
    rename.mutate({ id: s.id, name: name.trim() }, { onError: () => toast.error('Не вдалося') })
  }
  const swap = (i: number, j: number) => {
    const a = openStages[i]
    const b = openStages[j]
    if (!a || !b) return
    move.mutate({ id: a.id, position: b.position })
    move.mutate({ id: b.id, position: a.position })
  }
  const removeStage = (s: LeadStage) => {
    if (!window.confirm(`Видалити стадію «${s.name}»? Ліди перейдуть на першу відкриту.`)) return
    del.mutate(s.id, {
      onSuccess: () => toast.success('Стадію видалено'),
      onError: () => toast.error('Не вдалося видалити'),
    })
  }

  return (
    <Modal open onClose={onClose} title="Стадії воронки">
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // відкриті стадії — редаговані; «Виграно/Втрачено» — термінальні (лише перейменувати)
        </div>
        {stages.map((s) => {
          const openIdx = openStages.findIndex((o) => o.id === s.id)
          return (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
              }}
            >
              <span
                className="wfp-mono"
                style={{
                  fontSize: 10,
                  width: 44,
                  color:
                    s.kind === 'won'
                      ? 'var(--wf-accent)'
                      : s.kind === 'lost'
                        ? 'var(--wf-destructive)'
                        : 'var(--wf-fg-muted)',
                }}
              >
                {s.kind === 'open' ? 'open' : s.kind === 'won' ? 'won' : 'lost'}
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span>
              {s.kind === 'open' && openIdx > 0 && (
                <button
                  type="button"
                  className="wfp-link"
                  style={{ fontSize: 12 }}
                  onClick={() => swap(openIdx, openIdx - 1)}
                >
                  ↑
                </button>
              )}
              {s.kind === 'open' && openIdx < openStages.length - 1 && (
                <button
                  type="button"
                  className="wfp-link"
                  style={{ fontSize: 12 }}
                  onClick={() => swap(openIdx, openIdx + 1)}
                >
                  ↓
                </button>
              )}
              <button
                type="button"
                className="wfp-link"
                style={{ fontSize: 11 }}
                onClick={() => renameStage(s)}
              >
                переймен.
              </button>
              {s.kind === 'open' && (
                <button
                  type="button"
                  className="wfp-link"
                  style={{ fontSize: 11, color: 'var(--wf-destructive)' }}
                  onClick={() => removeStage(s)}
                >
                  видалити
                </button>
              )}
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Нова стадія"
              value={newName}
              placeholder="напр. Демо / Переговори"
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button variant="primary" loading={create.isPending} onClick={addStage}>
            Додати
          </Button>
        </div>
      </div>
    </Modal>
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
