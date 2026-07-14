import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar, Button, Card, EmptyState, Input, Modal, Skeleton, Tabs } from '@workflo/ui'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateTeam, useSetMemberTeam, useTeams, useUpdateTeam, type Team } from '@/lib/teams'
import { api } from '@/lib/api'
import {
  num,
  usePayouts,
  useSetCapacity,
  useSetRate,
  useSetRole,
  useSetZeroCost,
  useTeam,
  type TeamMember,
} from '@/lib/payouts'
import { formatDate } from '@/lib/format'

const EMAIL_RE = /^\S+@\S+\.\S+$/

const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  manager: 'менеджер',
  executor: 'виконавець',
}

/** TEAM-ADMIN-2 (дизайн workspace-admin.jsx): «Адмін · команда» — KPI-стріп +
 * таби Підрозділи · Команда-ролі · Permissions(→S14) · Запрошення. Owner/manager —
 * повний екран; executor-ТІМЛІД — read-only ростер свого підрозділу; решта — 403-стан. */
export function TeamPage() {
  const { user, isOwner, isManager } = useAuth()
  const myId = user?.profile.id
  const { data, isLoading } = useTeam()
  const { data: teams = [] } = useTeams()
  const [tab, setTab] = useState('members')
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [search, setSearch] = useState('')
  const members = data?.members ?? []
  const isAdmin = isOwner || isManager

  // Тімлід-скоуп: executor бачить лише свій підрозділ (teams вже скоуплені беком)
  const myLeadTeam = !isAdmin ? (teams.find((t) => t.leadId === myId) ?? null) : null

  if (!isAdmin) {
    if (!myLeadTeam) {
      return (
        <EmptyState
          title="Розділ доступний керівництву"
          description="Ростер команди бачать власник, менеджери й тімліди підрозділів."
        />
      )
    }
    const unit = members.filter((m) => m.teamId === myLeadTeam.id)
    return (
      <div style={{ maxWidth: 880 }}>
        <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>
          Підрозділ · {myLeadTeam.name}
        </div>
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
        >
          // ви тімлід · {unit.length} у підрозділі · компенсації видимі лише власнику
        </div>
        <Card title="Склад підрозділу">
          <div style={{ display: 'grid', gap: 2 }}>
            {unit.map((m) => (
              <MemberRow key={m.profileId} member={m} canEdit={false} onEdit={() => {}} />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    : members

  return (
    <div style={{ maxWidth: 980 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Адмін · команда</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // {isOwner ? 'owner' : 'manager'} · підрозділи, ролі, доступи
          </div>
        </div>
        <Button variant="primary" onClick={() => setTab('invites')}>
          + Запросити члена
        </Button>
      </div>

      <TeamKpiStrip members={members} />

      <Tabs
        value={tab}
        onChange={(t) => {
          if (t === 'permissions') {
            toast.info('Permissions-матриця — у SaaS-фазі (S14, custom roles)')
            return
          }
          setTab(t)
        }}
        items={[
          { id: 'departments', label: 'Підрозділи' },
          { id: 'members', label: 'Команда · ролі' },
          { id: 'permissions', label: 'Permissions 🔒' },
          { id: 'invites', label: 'Запрошення' },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {tab === 'departments' && (
          <DepartmentsTab teams={teams} members={members} canEdit={isOwner} />
        )}

        {tab === 'members' && (
          <Card title="Склад команди">
            <div style={{ marginBottom: 12, maxWidth: 320 }}>
              <Input
                placeholder="Шукати по імені, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isLoading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Skeleton style={{ height: 40 }} />
                <Skeleton style={{ height: 40 }} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={q ? 'Нікого не знайдено' : 'Поки лише ви'}
                description={q ? 'Змініть запит.' : 'Запросіть виконавців у табі «Запрошення».'}
              />
            ) : (
              <div style={{ display: 'grid', gap: 2 }}>
                {filtered.map((m) => (
                  <div key={m.profileId}>
                    <MemberRow member={m} canEdit={isOwner} onEdit={setEditing} />
                    <ReportsToLine member={m} teams={teams} members={members} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'invites' && <InvitesTab />}
      </div>

      {editing && <EditMemberModal member={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** KPI-стріп (дизайн): команда N · payroll поточного місяця · pending-інвайти · середня rate. */
function TeamKpiStrip({ members }: { members: TeamMember[] }) {
  const period = new Date().toISOString().slice(0, 7)
  const payouts = usePayouts(period)
  const { data: invitesData } = useInvites()
  const owners = members.filter((m) => m.role === 'owner').length
  const managers = members.filter((m) => m.role === 'manager').length
  const executors = members.filter((m) => m.role === 'executor').length
  const rates = members
    .map((m) => (m.rate?.hourlyRate ? Number(m.rate.hourlyRate) : null))
    .filter((r): r is number => r != null && r > 0)
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  const payrollTotal = (payouts.data?.payouts ?? []).reduce((s, p) => s + (num(p.total) ?? 0), 0)
  const pending = (invitesData?.invites ?? []).length

  const tile = (k: string, v: string, sub: string) => (
    <div style={{ flex: 1, minWidth: 150, padding: '12px 14px' }}>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, margin: '2px 0' }}>{v}</div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {sub}
      </div>
    </div>
  )

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        marginBottom: 16,
      }}
    >
      {tile(
        'команда',
        String(members.length),
        `${owners} owner · ${managers} managers · ${executors} executors`
      )}
      {tile(
        `payroll · ${period}`,
        payrollTotal ? `$${Math.round(payrollTotal)}` : '—',
        'нараховано'
      )}
      {tile('запрошень pending', String(pending), 'чекають accept')}
      {tile('середня rate', avgRate != null ? `$${avgRate}/h` : '—', 'по команді')}
    </div>
  )
}

/** «звітує: …» — computed-ієрархія: член → тімлід підрозділу → власник (reportsTo-поля нема). */
function ReportsToLine({
  member,
  teams,
  members,
}: {
  member: TeamMember
  teams: Team[]
  members: TeamMember[]
}) {
  const ownerMember = members.find((m) => m.role === 'owner')
  const team = member.teamId ? teams.find((t) => t.id === member.teamId) : null
  let text: string
  if (member.role === 'owner') text = 'вершина ієрархії'
  else if (team?.lead && team.leadId !== member.profileId) text = `звітує: ${team.lead.name}`
  else text = ownerMember ? `звітує: ${ownerMember.name}` : 'звітує: власнику'
  return (
    <div
      className="wfp-mono"
      style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', padding: '0 8px 8px 46px' }}
    >
      ↳ {text}
    </div>
  )
}

/** Таб «Підрозділи»: картки команд з лідом (★) і складом + створення підрозділу. */
function DepartmentsTab({
  teams,
  members,
  canEdit,
}: {
  teams: Team[]
  members: TeamMember[]
  canEdit: boolean
}) {
  const create = useCreateTeam()
  const update = useUpdateTeam()
  const [name, setName] = useState('')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {teams.map((t) => {
          const unit = members.filter((m) => m.teamId === t.id)
          return (
            <Card key={t.id} title={t.name}>
              <div
                className="wfp-mono"
                style={{
                  fontSize: 11,
                  color: t.color ?? 'var(--wf-fg-muted)',
                  marginBottom: 10,
                }}
              >
                ● {unit.length} {unit.length === 1 ? 'член' : 'членів'}
                {t.lead ? ` · лід: ${t.lead.name}` : ' · без тімліда'}
              </div>
              {unit.map((m) => (
                <div
                  key={m.profileId}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                >
                  <Avatar name={m.name} size={22} />
                  <span style={{ fontSize: 13, flex: 1 }}>{m.name}</span>
                  {t.leadId === m.profileId && (
                    <span
                      className="wfp-mono"
                      title="тімлід підрозділу"
                      style={{ fontSize: 10, color: 'var(--wf-accent)' }}
                    >
                      ★ лід
                    </span>
                  )}
                </div>
              ))}
              {canEdit && (
                <div style={{ marginTop: 10 }}>
                  <Select
                    label="Тімлід"
                    value={t.leadId ?? ''}
                    disabled={update.isPending}
                    onChange={(v) =>
                      update.mutate(
                        { id: t.id, leadId: v || null },
                        {
                          onSuccess: () =>
                            toast.success(v ? 'Тімліда призначено' : 'Тімліда знято'),
                          onError: () => toast.error('Лід має бути членом команди'),
                        }
                      )
                    }
                    options={[
                      { value: '', label: 'без тімліда' },
                      ...unit.map((m) => ({ value: m.profileId, label: `★ ${m.name}` })),
                    ]}
                  />
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, maxWidth: 380 }}>
          <Input
            placeholder="Новий підрозділ, напр. «QA»"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={name.trim().length === 0}
            onClick={() =>
              create.mutate(name.trim(), {
                onSuccess: () => {
                  setName('')
                  toast.success('Підрозділ створено')
                },
              })
            }
          >
            Створити
          </Button>
        </div>
      )}
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        // членів у підрозділ призначайте в табі «Команда · ролі»; дошку підрозділу тімлід
        налаштовує на «Дошці задач»
      </div>
    </div>
  )
}

// ── TEAM-ADMIN-2: запрошення — список pending + resend/cancel ────────────────
interface PendingInvite {
  id: string
  email: string
  createdAt: string
  expiresAt: string
  invitedByName: string
  expired: boolean
}

function useInvites() {
  return useQuery({
    queryKey: ['team-invites'],
    queryFn: () => api.get<{ invites: PendingInvite[] }>('/workspace/team/invites'),
  })
}

function InvitesTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useInvites()
  const [email, setEmail] = useState('')
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['team-invites'] })

  const invite = useMutation({
    mutationFn: (value: string) => api.post('/workspace/team/invite', { email: value }),
    onSuccess: () => {
      toast.success('Запрошення надіслано')
      setEmail('')
      invalidate()
    },
  })
  const resend = useMutation({
    mutationFn: (id: string) => api.post(`/workspace/team/invites/${id}/resend`, {}),
    onSuccess: () => {
      toast.success('Запрошення повторно надіслано')
      invalidate()
    },
  })
  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/team/invites/${id}`),
    onSuccess: () => {
      toast.success('Запрошення скасовано')
      invalidate()
    },
  })

  const invites = data?.invites ?? []
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Запросити виконавця">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Email"
              type="email"
              placeholder="executor@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            loading={invite.isPending}
            disabled={!EMAIL_RE.test(email.trim())}
            onClick={() => invite.mutate(email.trim())}
          >
            Запросити
          </Button>
        </div>
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 8 }}
        >
          // запрошення дійсне 7 днів; неприйняте можна повторити або скасувати нижче
        </div>
      </Card>

      <Card title={`Очікують прийняття · ${invites.length}`}>
        {isLoading ? (
          <Skeleton style={{ height: 60 }} />
        ) : invites.length === 0 ? (
          <EmptyState title="Немає pending-запрошень" description="Всі запрошення прийняті." />
        ) : (
          invites.map((i) => (
            <div
              key={i.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--wf-border)',
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {i.email}
              </span>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                від {i.invitedByName} · до {formatDate(i.expiresAt)}
                {i.expired && (
                  <span style={{ color: 'var(--wf-warning, #f59e0b)' }}> · прострочене</span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                loading={resend.isPending && resend.variables === i.id}
                onClick={() => resend.mutate(i.id)}
              >
                Resend
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={cancel.isPending && cancel.variables === i.id}
                onClick={() => cancel.mutate(i.id)}
              >
                Cancel
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function MemberRow({
  member,
  canEdit,
  onEdit,
}: {
  member: TeamMember
  canEdit: boolean
  onEdit: (m: TeamMember) => void
}) {
  const rate = member.rate

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1.2fr 1.1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 8px',
        borderBottom: '1px solid var(--wf-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Avatar name={member.name} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Link
              to={`/team/${member.profileId}`}
              className="wfp-link"
              style={{ color: 'inherit' }}
              title="KPI-картка виконавця"
            >
              {member.name}
            </Link>
          </div>
          <div
            className="wfp-mono"
            style={{
              fontSize: 11,
              color: 'var(--wf-fg-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {member.email}
          </div>
        </div>
      </div>
      <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
        {ROLE_LABEL[member.role] ?? member.role}
        <MemberTeamCell member={member} canEdit={canEdit} />
      </span>
      <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
        з {formatDate(member.joinedAt)} ·{' '}
        {member.weeklyCapacityHours != null
          ? `${member.weeklyCapacityHours} год/тиж`
          : '40 год/тиж'}
      </span>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        <span className="wfp-mono" style={{ fontSize: 12, textAlign: 'right' }}>
          {rate
            ? `${rate.monthlySalary ? `${Number(rate.monthlySalary)} ${rate.currency}/міс` : '—'}${
                Number(rate.commissionPercent) ? ` · ${Number(rate.commissionPercent)}%` : ''
              }`
            : '—'}
        </span>
        {rate?.zeroCostDefault && (
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            без собівартості
          </span>
        )}
      </span>
      {canEdit ? (
        <Button size="sm" variant="ghost" onClick={() => onEdit(member)}>
          Редагувати
        </Button>
      ) : (
        <span />
      )}
    </div>
  )
}

/**
 * 12-EDITMEMBER (design workspace-admin.jsx EditMemberModal, чесний субсет без
 * підрозділів/керівника — їх нема в API): роль + компенсація + норма + zeroCost
 * в ОДНОМУ місці. Save виконує лише мутації змінених груп: роль (PATCH role),
 * компенсація (POST rates → нове вікно), норма (PATCH capacity), прапорець
 * (PATCH zero-cost).
 */
function EditMemberModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const rate = member.rate
  const isOwnerRow = member.role === 'owner'
  const setRole = useSetRole()
  const setRate = useSetRate()
  const setCapacity = useSetCapacity()
  const setZeroCost = useSetZeroCost()

  const [role, setRoleValue] = useState(member.role)
  const [salary, setSalary] = useState(rate?.monthlySalary ?? '')
  const [hourly, setHourly] = useState(rate?.hourlyRate ?? '')
  const [commission, setCommission] = useState(rate?.commissionPercent ?? '')
  const [currency, setCurrency] = useState(rate?.currency ?? 'USD')
  const [capacity, setCapacityValue] = useState(member.weeklyCapacityHours?.toString() ?? '')
  const [zeroCost, setZeroCostValue] = useState(rate?.zeroCostDefault ?? false)
  const [saving, setSaving] = useState(false)

  const compChanged =
    (num(salary || null) ?? null) !== (num(rate?.monthlySalary ?? null) ?? null) ||
    (num(hourly || null) ?? null) !== (num(rate?.hourlyRate ?? null) ?? null) ||
    (num(commission || null) ?? null) !== (num(rate?.commissionPercent ?? null) ?? null) ||
    currency !== (rate?.currency ?? 'USD')
  const compEmpty = !(Number(salary) > 0) && !(Number(commission) > 0) && !(Number(hourly) > 0)
  const capParsed = capacity.trim() === '' ? null : Number(capacity)
  const capInvalid =
    capParsed != null && (!Number.isFinite(capParsed) || capParsed < 0 || capParsed > 168)

  const save = async () => {
    if (capInvalid || (compChanged && compEmpty)) return
    setSaving(true)
    // СТРОГО послідовно: rates-POST і zero-cost-PATCH обидва закривають/відкривають
    // вікно ExecutorRate — паралельний виклик може лишити ДВА відкриті вікна (гонка
    // read→close→create). Порядок: спершу компенсація (переносить старий прапорець),
    // потім прапорець (закриє щойно створене вікно, якщо змінився).
    const jobs: (() => Promise<unknown>)[] = []
    if (!isOwnerRow && role !== member.role && (role === 'manager' || role === 'executor')) {
      jobs.push(() => setRole.mutateAsync({ profileId: member.profileId, role }))
    }
    if (compChanged && !compEmpty) {
      jobs.push(() =>
        setRate.mutateAsync({
          executorId: member.profileId,
          ...(Number(salary) > 0 ? { monthlySalary: Number(salary) } : {}),
          ...(Number(hourly) > 0 ? { hourlyRate: Number(hourly) } : {}),
          ...(Number(commission) > 0 ? { commissionPercent: Number(commission) } : {}),
          currency,
        })
      )
    }
    if (zeroCost !== (rate?.zeroCostDefault ?? false)) {
      jobs.push(() =>
        setZeroCost.mutateAsync({ profileId: member.profileId, zeroCostDefault: zeroCost })
      )
    }
    if (capParsed !== (member.weeklyCapacityHours ?? null)) {
      jobs.push(() =>
        setCapacity.mutateAsync({ profileId: member.profileId, weeklyCapacityHours: capParsed })
      )
    }
    if (jobs.length === 0) {
      setSaving(false)
      onClose()
      return
    }
    try {
      for (const job of jobs) await job()
      toast.success('Зміни збережено')
      onClose()
    } catch {
      toast.error('Не всі зміни збереглися — перевірте значення')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={member.name}
      aux="edit member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={capInvalid || (compChanged && compEmpty)}
            onClick={() => void save()}
          >
            Зберегти
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: -6 }}
        >
          {member.email} · з {formatDate(member.joinedAt)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Select
              label="Роль"
              value={role}
              onChange={setRoleValue}
              disabled={isOwnerRow}
              options={
                isOwnerRow
                  ? [{ value: 'owner', label: 'власник' }]
                  : [
                      { value: 'executor', label: 'виконавець' },
                      { value: 'manager', label: 'менеджер' },
                    ]
              }
            />
            {isOwnerRow && (
              <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                // роль власника — лише передачею власності
              </div>
            )}
          </div>
          <Input
            label="Норма, год/тиж"
            type="number"
            placeholder="40"
            value={capacity}
            onChange={(e) => setCapacityValue(e.target.value)}
            error={capInvalid ? '0–168' : undefined}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input
            label="Оклад / міс"
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <Input
            label="Ставка год (собівар.=оплата)"
            type="number"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
          />
          <Input
            label="Комісія, %"
            type="number"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </div>
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          // ставка год = собівартість (маржа) + оплата погодиннику (payout за прийняті години)
        </div>
        <Select
          label="Валюта"
          value={currency}
          onChange={setCurrency}
          options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
        />
        {compChanged && (
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            // зміна компенсації відкриє нове вікно ставки (історія зберігається)
          </div>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            cursor: 'pointer',
            padding: '10px 12px',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
          }}
        >
          <input
            type="checkbox"
            checked={zeroCost}
            onChange={(e) => setZeroCostValue(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--wf-accent)' }}
          />
          <span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Без собівартості (zeroCost)</span>
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              весь дохід проєктів цієї людини = дохід агенції
            </div>
          </span>
        </label>
      </div>
    </Modal>
  )
}

/** TEAM-BOARDS: команда члена — owner редагує селектом, решта бачить назву. */
function MemberTeamCell({ member, canEdit }: { member: TeamMember; canEdit: boolean }) {
  const { data: teams = [] } = useTeams()
  const setTeam = useSetMemberTeam()
  if (teams.length === 0) return null
  // TEAM-ADMIN-1: бейдж тімліда — головного у підрозділі
  const isLead =
    !!member.teamId && teams.some((t) => t.id === member.teamId && t.leadId === member.profileId)
  const leadBadge = isLead ? (
    <span
      className="wfp-mono"
      title="тімлід підрозділу"
      style={{ marginLeft: 6, fontSize: 10, color: 'var(--wf-accent)' }}
    >
      ★ лід
    </span>
  ) : null
  if (!canEdit) {
    return member.team ? (
      <span style={{ marginLeft: 8, color: member.team.color ?? 'var(--wf-fg-subtle)' }}>
        · {member.team.name}
        {leadBadge}
      </span>
    ) : null
  }
  return (
    <>
      <select
        value={member.teamId ?? ''}
        onChange={(e) =>
          setTeam.mutate({ profileId: member.profileId, teamId: e.target.value || null })
        }
        className="wfp-mono"
        title="Команда"
        style={{
          marginLeft: 8,
          fontSize: 11,
          padding: '1px 4px',
          background: 'transparent',
          border: '1px solid var(--wf-border)',
          borderRadius: 4,
          color: member.team?.color ?? 'var(--wf-fg-muted)',
        }}
      >
        <option value="">без команди</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {leadBadge}
    </>
  )
}
