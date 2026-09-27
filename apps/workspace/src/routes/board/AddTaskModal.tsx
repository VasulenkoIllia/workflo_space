import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { OrderInternalStatus } from '@workflo/types'
import { Button, Input, Modal } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useOrders } from '@/lib/orders'
import { useTeam } from '@/lib/payouts'
import { useCreateBoardTask } from '@/lib/tasks'
import type { Team } from '@/lib/teams'

/** Замовлення, куди ще має сенс додавати роботу. */
const CLOSED: ReadonlySet<string> = new Set([
  OrderInternalStatus.DONE,
  OrderInternalStatus.CANCELLED,
])
const FROM_PROJECT = '__project__'
const NO_TEAM = '__none__'

/**
 * CORE-FLOWS (D3) · design-v2 workspace-board-modals.jsx → AddTaskModal. У дизайні драйвер —
 * проєкт; у нас задача живе в ЗАМОВЛЕННІ (воно й несе клієнта/проєкт/білінг), тому першим
 * обираємо замовлення. Команда за замовчуванням — з проєкту замовлення (або активний таб
 * дошки). Без виконавця задача падає у «Вхідні» команди — забрати її може будь-хто.
 */
export function AddTaskModal({
  teams,
  defaultTeamId,
  onClose,
}: {
  teams: Team[]
  defaultTeamId: string | null
  onClose: () => void
}) {
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ limit: 100 })
  const { data: rosterData } = useTeam()
  const create = useCreateBoardTask()
  const orders = useMemo(
    () => (ordersData?.orders ?? []).filter((o) => !CLOSED.has(o.internalStatus ?? '')),
    [ordersData]
  )
  const people = (rosterData?.members ?? []).filter((m) => m.role !== 'client')

  const [title, setTitle] = useState('')
  const [orderId, setOrderId] = useState('')
  const [team, setTeam] = useState(defaultTeamId ?? FROM_PROJECT)
  const [assignees, setAssignees] = useState<string[]>([])

  const toggle = (id: string) =>
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  const teamName =
    team === FROM_PROJECT
      ? 'команда проєкту'
      : team === NO_TEAM
        ? 'без команди'
        : (teams.find((t) => t.id === team)?.name ?? '—')
  const canSubmit = title.trim() !== '' && orderId !== ''

  const submit = () =>
    create.mutate(
      {
        orderId,
        title: title.trim(),
        teamId: team === FROM_PROJECT ? undefined : team === NO_TEAM ? null : team,
        assigneeIds: assignees,
      },
      {
        onSuccess: () => {
          toast.success('Задачу створено')
          onClose()
        },
      }
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="Нова задача"
      aux={`// ${orderId ? `#${orderId.slice(0, 6)}` : 'замовлення'} → ${teamName} · Вхідні`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!canSubmit}
            onClick={submit}
          >
            Створити задачу
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Input
          label="Назва"
          value={title}
          autoFocus
          placeholder="напр. Оновити сертифікат · додати інтеграцію…"
          onChange={(e) => setTitle(e.target.value)}
        />

        <Select
          label="Замовлення"
          value={orderId}
          disabled={ordersLoading}
          onChange={setOrderId}
          options={[
            { value: '', label: ordersLoading ? 'завантаження…' : '— оберіть замовлення —' },
            ...orders.map((o) => ({ value: o.id, label: `#${o.id.slice(0, 6)} · ${o.title}` })),
          ]}
        />

        <Select
          label="Команда / дошка"
          value={team}
          onChange={setTeam}
          options={[
            { value: FROM_PROJECT, label: 'з проєкту замовлення' },
            ...teams.map((t) => ({ value: t.id, label: t.name })),
            { value: NO_TEAM, label: 'без команди (лише «Усі»)' },
          ]}
        />

        <div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
          >
            // ВИКОНАВЦІ <span style={{ color: 'var(--wf-fg-subtle)' }}>— опційно</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {people.map((p) => {
              const on = assignees.includes(p.profileId)
              const main = assignees[0] === p.profileId
              return (
                <button
                  key={p.profileId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.profileId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    font: 'inherit',
                    fontSize: 12,
                    cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--wf-accent)' : 'var(--wf-border)'}`,
                    background: on
                      ? 'color-mix(in oklab, var(--wf-accent) 12%, transparent)'
                      : 'transparent',
                    color: on ? 'var(--wf-fg)' : 'var(--wf-fg-secondary)',
                  }}
                >
                  {p.name}
                  {main && (
                    <span className="wfp-mono" style={{ fontSize: 9, color: 'var(--wf-accent)' }}>
                      головний
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--wf-fg-muted)',
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            {assignees.length > 0
              ? `Призначено ${assignees.length} — перший обраний головний, решта співвиконавці.`
              : 'Без виконавця — задача впаде у «Вхідні» команди; її можна забрати собі або призначити пізніше.'}
          </div>
        </div>
      </div>
    </Modal>
  )
}
