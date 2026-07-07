import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, apiErrorMessage } from '@/lib/api'
import {
  LoyaltyTier,
  OrderInternalStatus,
  type VaultField,
  type VaultResourceType,
} from '@workflo/types'
import { VAULT_TYPE_OPTIONS, VaultTypedFieldsEditor } from '@workflo/app-core'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  StatusDot,
  Tabs,
} from '@workflo/ui'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { INTERNAL_STATUS_META, useOrders } from '@/lib/orders'
import { useOrder } from '@/lib/orderDetail'
import { type CompanyLoyalty, useCompanyLoyalty, useSetLoyaltyOverride } from '@/lib/loyalty'
import {
  useClientActivity,
  useClientMembers,
  useInviteClientMember,
  useRemoveClientMember,
  useResetClientMemberPassword,
  useUpdateClientMemberRole,
  type ClientActivityItem,
} from '@/lib/clients'
import {
  type Credential,
  type VaultShare,
  useCreateCredential,
  useCredentials,
  useDeleteCredential,
  useGrantShare,
  useSetCredentialExpiry,
  useRevokeCredential,
  useRevokeShare,
  useVaultShares,
} from '@/lib/credentials'
import { type TeamMember, useTeam } from '@/lib/payouts'
import { SecretRow } from '@/components/SecretRow'
import { VaultStepUpModal } from '@/components/VaultStepUpModal'
import { useClientMargin } from '@/lib/margin'
import {
  type ClientRequisitesInput,
  useClientRequisites,
  useUpdateClientRequisites,
} from '@/lib/requisites'
import { useCompanyProjects } from '@/lib/projects'
import { type WsCharge, useCompanyCharges } from '@/lib/billing'
import {
  type ClientDocument,
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  openContractFile,
  openDocumentPdf,
  registerExternalContract,
  useClientDocuments,
} from '@/lib/documents'
import { isoDay } from '@/lib/finance'
import { deadlineMeta, formatDate, formatDateTime, formatMoney } from '@/lib/format'

const LEGAL_TYPE_LABEL: Record<string, string> = {
  fop: 'ФОП',
  tov: 'ТОВ',
  individual: 'Фізособа',
  foreign: 'Іноземна',
}

const MODEL_LABEL: Record<string, string> = {
  fixed_monthly_advance: 'Абонплата (аванс)',
  hourly_prepaid: 'Погодинно (аванс)',
  hourly_postpaid: 'Погодинно (факт)',
}

const CYCLE_LABEL: Record<string, string> = {
  monthly_day_n: 'Щомісяця',
  weekly_day_x: 'Щотижня',
  manual: 'Вручну',
}

const TIER_LABEL: Record<LoyaltyTier, string> = {
  [LoyaltyTier.NEW]: 'Новий',
  [LoyaltyTier.REGULAR]: 'Постійний',
  [LoyaltyTier.PARTNER]: 'Партнер',
  [LoyaltyTier.VIP]: 'VIP',
}

const fmtUsd = (v: string | number | null | undefined): string =>
  `$${Number(v ?? 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })}`

/** Owner — a single client (company): its orders + aggregate stats. Name resolved
 * from one order's detail (no companies endpoint yet — S5). */
export function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useOrders({ companyId: id, limit: 100 })
  const orders = data?.orders ?? []
  const firstId = orders[0]?.id ?? ''
  const { data: sample } = useOrder(firstId)
  const name = sample?.company?.name ?? `Клієнт · ${id.slice(0, 8)}`
  const { isManager, isOwner } = useAuth()
  const [tab, setTab] = useState('overview')

  if (isLoading) return <Skeleton style={{ height: 280 }} />
  if (isError) {
    return (
      <EmptyState
        glyph="// error"
        title="Не вдалося завантажити клієнта"
        description="Спробуйте оновити сторінку."
      />
    )
  }

  const active = orders.filter(
    (o) =>
      o.internalStatus !== OrderInternalStatus.DONE &&
      o.internalStatus !== OrderInternalStatus.CANCELLED
  ).length
  const totalValue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0)

  // Projects/Finance/Requisites/Активність/Секрети are internal-non-manager on the backend → a
  // manager sees only Огляд (the rest would 403). «Секрети» (vault, module 17) is owner-only.
  // «Активність» — агрегований per-client timeline (28-Б, GET /clients/:id/activity).
  const ALL_TABS = [
    { id: 'overview', label: 'Огляд' },
    { id: 'people', label: 'Люди' },
    { id: 'projects', label: 'Проєкти' },
    { id: 'finance', label: 'Фінанси' },
    { id: 'docs', label: 'Документи' },
    { id: 'activity', label: 'Активність' },
    { id: 'secrets', label: 'Секрети' },
    { id: 'requisites', label: 'Реквізити' },
  ]
  const visibleTabs = isManager
    ? ALL_TABS.filter((t) => t.id === 'overview')
    : // «Секрети» is owner-only (executors don't reach this page; the vault API 403s non-owners).
      ALL_TABS.filter((t) => t.id !== 'secrets' || isOwner)
  const safeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'overview'

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            //{' '}
            <Link to="/clients" className="wfp-link">
              клієнти
            </Link>{' '}
            / {name}
          </div>
          <h1 className="wfp-ph-h1">{name}</h1>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Tabs items={visibleTabs} value={safeTab} onChange={setTab} />
      </div>

      {safeTab === 'overview' && (
        <>
          <OverviewAttention companyId={id} />
          <div className="wfp-stats" style={{ marginBottom: 20 }}>
            <div className="wfp-stat">
              <div className="wfp-stat-k">усього замовлень</div>
              <div className="wfp-stat-v">{orders.length}</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">активних</div>
              <div className="wfp-stat-v wfp-stat-v--accent">{active}</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">сумарна вартість</div>
              <div className="wfp-stat-v">{formatMoney(totalValue)}</div>
            </div>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              title="Немає замовлень"
              description="У цього клієнта поки немає замовлень."
              action={
                <Link to="/clients">
                  <Button variant="secondary">← До клієнтів</Button>
                </Link>
              }
            />
          ) : (
            <table className="wfp-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Назва</th>
                  <th>Статус</th>
                  <th>Дедлайн</th>
                  <th className="wfp-num">Сума</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const meta = o.internalStatus ? INTERNAL_STATUS_META[o.internalStatus] : null
                  const dl = deadlineMeta(o.dueDate)
                  return (
                    <tr
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/orders/${o.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/orders/${o.id}`)
                        }
                      }}
                    >
                      <td className="wfp-mono">
                        <span className="wfp-link">#{o.id.slice(0, 6)}</span>
                      </td>
                      <td>{o.title}</td>
                      <td>
                        {meta ? (
                          <span className="wfp-order-status">
                            <StatusDot tone={meta.tone} /> {meta.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="wfp-mono"
                        style={{ color: dl.tone === 'over' ? 'var(--wf-destructive)' : undefined }}
                      >
                        {formatDate(o.dueDate)}
                      </td>
                      <td className="wfp-num">{formatMoney(o.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {safeTab === 'people' && <PeopleSection companyId={id} />}
      {safeTab === 'projects' && <ProjectsSection companyId={id} />}
      {safeTab === 'finance' && (
        <>
          <LoyaltySection companyId={id} />
          <MarginSection companyId={id} />
          <DunningToggleSection companyId={id} />
        </>
      )}
      {safeTab === 'docs' && <DocumentsSection companyId={id} />}
      {safeTab === 'activity' && <ActivitySection companyId={id} />}
      {safeTab === 'secrets' && <SecretsSection companyId={id} />}
      {safeTab === 'requisites' && <RequisitesSection companyId={id} />}
    </div>
  )
}

const DOC_STATUS_COLOR: Record<string, string> = {
  draft: 'var(--wf-fg-muted)',
  generated: 'var(--wf-fg-subtle)',
  sent: 'var(--wf-accent)',
  accepted: 'var(--wf-success, var(--wf-accent))', // 06-ПІДПИС
}

/** 06-ДОГОВІР-2: модалка реєстрації договору, підписаного поза системою. */
function ExternalContractModal({
  companyId,
  onClose,
  onDone,
}: {
  companyId: string
  onClose: () => void
  onDone: () => void
}) {
  const [number, setNumber] = useState('')
  const [contractDate, setContractDate] = useState('')
  const [signerName, setSignerName] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await registerExternalContract(companyId, {
        number: number.trim(),
        contractDate,
        signerName: signerName.trim(),
        externalUrl: externalUrl.trim() || undefined,
        file,
      })
      toast.success('Зовнішній договір зареєстровано')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося зареєструвати договір')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Зовнішній договір" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // договір підписано поза системою — фіксуємо реквізити; номер підтягнеться в рахунки/акти
          як «Підстава»
        </div>
        <Input
          label="Номер договору"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="№ 12/2026"
        />
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ДАТА ПІДПИСАННЯ
          </span>
          <input
            type="date"
            value={contractDate}
            onChange={(e) => setContractDate(e.target.value)}
            style={{
              background: 'var(--wf-surface)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '8px 10px',
              fontSize: 14,
            }}
          />
        </label>
        <Input
          label="Підписант (ПІБ з боку клієнта)"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
        />
        <Input
          label="Посилання на договір (опційно)"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://…"
        />
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ФАЙЛ ДОГОВОРУ (PDF, опційно)
          </span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={
              number.trim().length === 0 || contractDate === '' || signerName.trim().length < 3
            }
            onClick={() => void submit()}
          >
            Зареєструвати
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Документи tab (28-Б): all of the client's documents across orders. Internal-non-manager
 * (backend 403s managers → hidden). PDF opens via the Bearer-authed blob fetch. */
function DocumentsSection({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const qc = useQueryClient()
  const { data: docs, isLoading } = useClientDocuments(companyId, !isManager)
  const [externalOpen, setExternalOpen] = useState(false)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 120 }} />
  const documents = docs ?? []

  const open = (d: ClientDocument) => {
    // 06-ДОГОВІР-2: зовнішній договір з файлом → storage; лише лінк → нове вікно
    if (d.signedExternally) {
      if (d.storedAs) {
        openContractFile(d).catch((err) =>
          toast.error(apiErrorMessage(err, 'Не вдалося відкрити файл'))
        )
      } else if (d.externalUrl) {
        window.open(d.externalUrl, '_blank', 'noopener')
      } else {
        toast.info('Для цього договору не додано ні файл, ні посилання')
      }
      return
    }
    // 19-Г: monthly_report без замовлення відкривається generic-роутом
    openDocumentPdf(d.order?.id ?? null, d).catch((err) =>
      toast.error(apiErrorMessage(err, 'Не вдалося відкрити документ'))
    )
  }

  return (
    <Card
      title="Документи"
      aux={
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12 }}
            onClick={() => setExternalOpen(true)}
          >
            + Зовнішній договір
          </button>
          <span>{documents.length}</span>
        </span>
      }
    >
      {externalOpen && (
        <ExternalContractModal
          companyId={companyId}
          onClose={() => setExternalOpen(false)}
          onDone={() => {
            setExternalOpen(false)
            void qc.invalidateQueries({ queryKey: ['client-documents', companyId] })
          }}
        />
      )}
      {documents.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // ще немає документів — генеруються з замовлення
        </div>
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Тип</th>
              <th>Замовлення</th>
              <th>Статус</th>
              <th>Дата</th>
              <th className="wfp-num">PDF</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td className="wfp-mono">{d.number}</td>
                <td>
                  {DOC_TYPE_LABEL[d.type]}
                  {d.signedExternally && (
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}
                    >
                      {' '}
                      · зовнішній
                    </span>
                  )}
                </td>
                <td>
                  {d.order ? (
                    <Link to={`/orders/${d.order.id}`} className="wfp-link">
                      {d.order.title}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span style={{ color: DOC_STATUS_COLOR[d.status], fontSize: 13 }}>
                    {DOC_STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {formatDate(d.generatedAt)}
                </td>
                <td className="wfp-num">
                  <button className="wfp-link" type="button" onClick={() => open(d)}>
                    відкрити
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/** "Needs attention" strip for the Overview tab — overdue charges + drafts awaiting release,
 * derived from the client's charges (internal-non-manager). Renders nothing when all clear. */
function OverviewAttention({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const { data } = useCompanyCharges(companyId, !isManager)
  if (isManager) return null
  const charges = data?.charges ?? []
  const now = Date.now()
  const isOpen = (c: WsCharge) => c.status !== 'paid' && c.status !== 'written_off'
  const overdue = charges.filter(
    (c) => isOpen(c) && c.dueDate != null && new Date(c.dueDate).getTime() < now
  )
  const pending = charges.filter((c) => c.approvalStatus === 'pending')
  if (overdue.length === 0 && pending.length === 0) return null

  const overdueSum = overdue.reduce((s, c) => s + Number(c.totalAmount ?? c.amount), 0)
  const cur = overdue[0]?.currency ?? ''

  const dot = (color: string) => (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )

  return (
    <Card title="Потребує уваги" style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {overdue.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            {dot('var(--wf-destructive)')}
            <span>
              {overdue.length} прострочених рахунків · {overdueSum.toLocaleString('uk-UA')} {cur}
            </span>
            <Link to="/billing" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
              розглянути →
            </Link>
          </div>
        )}
        {pending.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            {dot('var(--wf-accent)')}
            <span>{pending.length} нарахувань на погодженні (чернетки)</span>
            <Link to="/billing" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
              черга →
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  member: 'учасник',
  billing: 'білінг',
}

/** «Секрети» tab (module 17 vault): agency-OWNER-only. Envelope-encrypted client credentials —
 * the list is metadata-only; «показати» fetches the plaintext once (never cached) and auto-hides
 * after 20s so it isn't left on screen. */
function SecretsSection({ companyId }: { companyId: string }) {
  const { data, isLoading } = useCredentials(companyId)
  const create = useCreateCredential(companyId)
  const revoke = useRevokeCredential(companyId)
  const del = useDeleteCredential(companyId)
  const setExpiry = useSetCredentialExpiry()
  const [adding, setAdding] = useState(false)
  const [stepUpRetry, setStepUpRetry] = useState<(() => void) | null>(null)

  // 17-SHARE (owner): executor grants — whole-client toggles + per-secret modal
  const { data: teamData } = useTeam()
  const executors = (teamData?.members ?? []).filter((m) => m.role === 'executor')
  const { data: sharesData } = useVaultShares(companyId)
  const shares = sharesData?.shares ?? []
  const companyShares = shares.filter((s) => s.companyId === companyId)
  const nameOf = (profileId: string) =>
    executors.find((e) => e.profileId === profileId)?.name ?? '—'
  const [shareModalCred, setShareModalCred] = useState<Credential | null>(null)

  /** Executor names with access to a given secret (point ∪ whole-client). */
  const sharedNamesFor = (credId: string) => [
    ...companyShares.map((s) => nameOf(s.executorId)),
    ...shares.filter((s) => s.credentialId === credId).map((s) => nameOf(s.executorId)),
  ]

  if (isLoading) return <Skeleton style={{ height: 160 }} />
  const creds = data?.credentials ?? []

  const doRevoke = (c: Credential) => {
    if (!window.confirm(`Відкликати секрет «${c.label}»? Reveal стане недоступним.`)) return
    revoke.mutate(c.id, {
      onSuccess: () => toast.success('Секрет відкликано'),
    })
  }
  // 17-РОТАЦІЯ: term prompt (YYYY-MM-DD; порожньо = зняти термін)
  const doSetExpiry = (c: Credential) => {
    const current = c.expiresAt ? c.expiresAt.slice(0, 10) : ''
    const raw = window.prompt('Термін дії доступу (РРРР-ММ-ДД, порожньо — без терміну):', current)
    if (raw === null) return
    const trimmed = raw.trim()
    if (trimmed !== '' && Number.isNaN(new Date(trimmed).getTime())) {
      toast.error('Невірна дата — формат РРРР-ММ-ДД')
      return
    }
    setExpiry.mutate(
      {
        companyId,
        credId: c.id,
        expiresAt: trimmed === '' ? null : new Date(trimmed).toISOString(),
      },
      { onSuccess: () => toast.success(trimmed === '' ? 'Термін знято' : 'Термін оновлено') }
    )
  }
  const doDelete = (c: Credential) => {
    if (!window.confirm(`Назавжди видалити секрет «${c.label}»?`)) return
    del.mutate(c.id, {
      onSuccess: () => toast.success('Секрет видалено'),
    })
  }

  return (
    <Card title="Секрети" aux={`${creds.length}`}>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // зашифровані доступи клієнта (AES-256-GCM). Пароль показується одноразово й не кешується.
      </div>
      {adding ? (
        <AddCredentialForm create={create} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Додати секрет
        </Button>
      )}

      {executors.length > 0 && (
        <ExecutorAccessBlock
          companyId={companyId}
          executors={executors}
          companyShares={companyShares}
        />
      )}

      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {creds.length === 0 && !adding ? (
          <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            // секретів ще немає
          </div>
        ) : (
          creds.map((c) => (
            <SecretRow
              key={c.id}
              cred={{ ...c, companyId }}
              onRevoke={() => doRevoke(c)}
              onDelete={() => doDelete(c)}
              onNeedStepUp={(retry) => setStepUpRetry(() => retry)}
              sharedNames={sharedNamesFor(c.id)}
              onManageShares={executors.length > 0 ? () => setShareModalCred(c) : undefined}
              onSetExpiry={() => doSetExpiry(c)}
              formatDate={formatDate}
            />
          ))
        )}
      </div>
      <VaultStepUpModal
        open={stepUpRetry !== null}
        onClose={() => setStepUpRetry(null)}
        onSuccess={() => {
          const retry = stepUpRetry
          setStepUpRetry(null)
          retry?.()
        }}
      />
      <SecretShareModal
        cred={shareModalCred}
        onClose={() => setShareModalCred(null)}
        executors={executors}
        shares={shares}
        companyShares={companyShares}
      />
    </Card>
  )
}

/** 17-SHARE: whole-client access toggles («всі секрети клієнта», incl. future ones). */
function ExecutorAccessBlock({
  companyId,
  executors,
  companyShares,
}: {
  companyId: string
  executors: TeamMember[]
  companyShares: VaultShare[]
}) {
  const grant = useGrantShare()
  const revokeShare = useRevokeShare()

  return (
    <div
      style={{
        border: '1px dashed var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        padding: 12,
        marginTop: 14,
      }}
    >
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        ДОСТУП ВИКОНАВЦІВ · всі секрети клієнта (точковий — на рядку секрету → «доступи»)
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {executors.map((e) => {
          const share = companyShares.find((s) => s.executorId === e.profileId)
          return (
            <label
              key={e.profileId}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={share != null}
                disabled={grant.isPending || revokeShare.isPending}
                onChange={() => {
                  if (share) {
                    revokeShare.mutate(share.id, {
                      onSuccess: () => toast.success(`Доступ ${e.name} відкликано`),
                    })
                  } else {
                    grant.mutate(
                      { executorId: e.profileId, companyId },
                      {
                        onSuccess: () => toast.success(`${e.name}: відкрито всі секрети клієнта`),
                      }
                    )
                  }
                }}
              />
              {e.name}
              {share != null && (
                <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-accent)' }}>
                  всі секрети
                </span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}

/** 17-SHARE: point shares of ONE secret (executors covered by a whole-client grant are
 * shown checked and locked — manage those in the block above). */
function SecretShareModal({
  cred,
  onClose,
  executors,
  shares,
  companyShares,
}: {
  cred: Credential | null
  onClose: () => void
  executors: TeamMember[]
  shares: VaultShare[]
  companyShares: VaultShare[]
}) {
  const grant = useGrantShare()
  const revokeShare = useRevokeShare()

  return (
    <Modal open={cred !== null} onClose={onClose} title={`Доступи · ${cred?.label ?? ''}`}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // точковий доступ саме до цього секрету; безстроково — до відкликання
        </div>
        {executors.map((e) => {
          const viaCompany = companyShares.some((s) => s.executorId === e.profileId)
          const point = cred
            ? shares.find((s) => s.credentialId === cred.id && s.executorId === e.profileId)
            : undefined
          return (
            <label
              key={e.profileId}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={viaCompany || point != null}
                disabled={viaCompany || grant.isPending || revokeShare.isPending}
                onChange={() => {
                  if (!cred) return
                  if (point) {
                    revokeShare.mutate(point.id, {
                      onSuccess: () => toast.success(`Доступ ${e.name} відкликано`),
                    })
                  } else {
                    grant.mutate(
                      { executorId: e.profileId, credentialId: cred.id },
                      { onSuccess: () => toast.success(`${e.name}: доступ видано`) }
                    )
                  }
                }}
              />
              {e.name}
              {viaCompany && (
                <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                  через «всі секрети клієнта»
                </span>
              )}
            </label>
          )
        })}
        <div>
          <Button variant="ghost" onClick={onClose}>
            Закрити
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const DEFAULT_TYPED_FIELDS: VaultField[] = [
  { kind: 'url', value: '' },
  { kind: 'login', value: '' },
  { kind: 'password', value: '' },
]

/** 17-Д: typed card builder — resource type + a dynamic field list from the shared catalog. */
function AddCredentialForm({
  create,
  onDone,
}: {
  create: ReturnType<typeof useCreateCredential>
  onDone: () => void
}) {
  const [label, setLabel] = useState('')
  const [resourceType, setResourceType] = useState<VaultResourceType>('other')
  const [fields, setFields] = useState<VaultField[]>(DEFAULT_TYPED_FIELDS)
  const [notes, setNotes] = useState('')

  const submit = () => {
    const filled = fields
      .map((f) => ({ ...f, value: f.value.trim() }))
      .filter((f) => f.value !== '')
    if (label.trim() === '') {
      toast.error('Вкажіть назву')
      return
    }
    if (filled.length === 0) {
      toast.error('Заповніть хоча б одне поле')
      return
    }
    create.mutate(
      { label: label.trim(), resourceType, fields: filled, notes: notes.trim() || null },
      {
        onSuccess: () => {
          toast.success('Секрет додано')
          onDone()
        },
      }
    )
  }

  return (
    <div
      style={{
        border: '1px dashed var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        padding: 12,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 200px' }}>
        <Input
          label="Назва"
          value={label}
          placeholder="Bitrix24 admin"
          onChange={(e) => setLabel(e.target.value)}
        />
        <Select
          label="Тип"
          value={resourceType}
          onChange={(v) => setResourceType(v as VaultResourceType)}
          options={VAULT_TYPE_OPTIONS}
        />
      </div>
      <VaultTypedFieldsEditor fields={fields} onChange={setFields} />
      <Input
        label="Нотатки (без секретів)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" loading={create.isPending} onClick={submit}>
          Зберегти
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Скасувати
        </Button>
      </div>
    </div>
  )
}

/** «Люди» tab (28-Б): the client company's member roster. Internal-non-manager → hidden for
 * managers. The agency OWNER can change roles / remove members (last-owner-guarded on backend). */
const ACTIVITY_GLYPH: Record<ClientActivityItem['kind'], string> = {
  order: '◆',
  payment: '$',
  document: '¶',
}
const ACTIVITY_TONE: Record<ClientActivityItem['kind'], string> = {
  order: 'var(--wf-fg-secondary)',
  payment: 'var(--wf-accent)',
  document: 'var(--wf-fg-secondary)',
}

/** 28-Б «Активність» — агрегований per-client timeline (замовлення+платежі+документи). */
function ActivitySection({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const { data, isLoading } = useClientActivity(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 200 }} />
  const items = data ?? []
  return (
    <Card title="Активність" aux={`${items.length}`}>
      {items.length === 0 ? (
        <EmptyState
          title="Поки порожньо"
          description="Тут з'являться події замовлень, платежі та документи цього клієнта."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
                padding: '8px 0',
                borderBottom: '1px solid var(--wf-border-subtle, var(--wf-border))',
              }}
            >
              <span
                className="wfp-mono"
                style={{ fontSize: 13, color: ACTIVITY_TONE[it.kind], width: 14, flexShrink: 0 }}
                aria-hidden
              >
                {ACTIVITY_GLYPH[it.kind]}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14 }}>
                  {it.orderId ? (
                    <Link to={`/orders/${it.orderId}`} className="wfp-link">
                      {it.title}
                    </Link>
                  ) : (
                    it.title
                  )}
                </div>
                <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {formatDateTime(it.at)}
                  {it.actorName ? ` · ${it.actorName}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function PeopleSection({ companyId }: { companyId: string }) {
  const { isManager, isOwner } = useAuth()
  const { data, isLoading } = useClientMembers(companyId, !isManager)
  const setRole = useUpdateClientMemberRole(companyId)
  const remove = useRemoveClientMember(companyId)
  const invite = useInviteClientMember(companyId)
  const resetPw = useResetClientMemberPassword(companyId)
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 120 }} />
  const members = data?.members ?? []

  const changeRole = (profileId: string, role: 'owner' | 'member') =>
    setRole.mutate({ profileId, role })

  const sendInvite = () => {
    const email = inviteEmail.trim()
    if (email === '') {
      toast.error('Вкажіть email')
      return
    }
    invite.mutate(email, {
      onSuccess: () => {
        toast.success('Запрошення надіслано')
        setInviteEmail('')
        setInviting(false)
      },
    })
  }

  const removeMember = (profileId: string, name: string) => {
    if (!window.confirm(`Видалити ${name} з компанії клієнта?`)) return
    remove.mutate(profileId, {
      onSuccess: () => toast.success('Користувача видалено'),
    })
  }

  const resetPassword = (profileId: string, name: string) => {
    if (!window.confirm(`Надіслати ${name} лист для скидання пароля?`)) return
    resetPw.mutate(profileId, {
      onSuccess: () => toast.success('Лист для скидання пароля надіслано'),
    })
  }

  return (
    <Card title="Люди" aux={`${members.length}`}>
      {isOwner && (
        <div style={{ marginBottom: members.length ? 12 : 8 }}>
          {inviting ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <Input
                  label="Email нового учасника"
                  type="email"
                  value={inviteEmail}
                  placeholder="person@client.com"
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Button variant="primary" loading={invite.isPending} onClick={sendInvite}>
                Надіслати
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setInviting(false)
                  setInviteEmail('')
                }}
              >
                Скасувати
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setInviting(true)}>
              + Запросити учасника
            </Button>
          )}
        </div>
      )}
      {members.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // у компанії клієнта ще немає користувачів
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {members.map((m) => (
            <div
              key={m.profileId}
              style={{
                display: 'grid',
                gridTemplateColumns: isOwner ? '2fr 1.1fr 1fr auto' : '2fr 1fr 1.2fr',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar name={m.name} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name}
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
                    {m.email}
                  </div>
                </div>
              </div>

              {isOwner ? (
                <select
                  value={m.role}
                  disabled={setRole.isPending}
                  onChange={(e) => changeRole(m.profileId, e.target.value as 'owner' | 'member')}
                  style={{
                    background: 'var(--wf-surface)',
                    color: 'var(--wf-fg)',
                    border: '1px solid var(--wf-border)',
                    borderRadius: 'var(--wf-radius)',
                    padding: '4px 6px',
                    fontSize: 12,
                  }}
                >
                  <option value="owner">власник</option>
                  <option value="member">учасник</option>
                </select>
              ) : (
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {MEMBER_ROLE_LABEL[m.role] ?? m.role}
                </span>
              )}

              <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
                з {formatDate(m.joinedAt)}
              </span>

              {isOwner && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="wfp-link"
                    style={{ fontSize: 12 }}
                    disabled={resetPw.isPending}
                    onClick={() => resetPassword(m.profileId, m.name)}
                  >
                    скинути пароль
                  </button>
                  <button
                    type="button"
                    className="wfp-link"
                    style={{ fontSize: 12, color: 'var(--wf-destructive)' }}
                    disabled={remove.isPending}
                    onClick={() => removeMember(m.profileId, m.name)}
                  >
                    видалити
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Loyalty tier panel for a client (S5-09). Read for team (owner/executor), hidden for
 * managers (the backend 403s them). Owner can override the tier (audit-logged). */
/** 05-Б дунінг: «не надсилати цьому клієнту нагадування про оплату» (owner-only).
 * Глушить лише листи/сповіщення — overdue-статус нарахувань ставиться незалежно. */
function DunningToggleSection({ companyId }: { companyId: string }) {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['company-dunning', companyId],
    queryFn: () => api.get<{ optOut: boolean }>(`/workspace/companies/${companyId}/dunning`),
    enabled: isOwner,
  })
  const patch = useMutation({
    mutationFn: (optOut: boolean) =>
      api.patch(`/workspace/companies/${companyId}/dunning`, { optOut }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['company-dunning', companyId] }),
    onError: (e) => toast.error(apiErrorMessage(e, 'Не вдалося зберегти')),
  })

  if (!isOwner) return null
  if (isLoading) return <Skeleton style={{ height: 60, marginBottom: 20 }} />
  if (!data) return null

  return (
    <Card title="Нагадування про оплату" style={{ marginBottom: 20 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={data.optOut}
          disabled={patch.isPending}
          onChange={(e) =>
            patch.mutate(e.target.checked, {
              onSuccess: () =>
                toast.success(
                  e.target.checked
                    ? 'Нагадування цьому клієнту вимкнено'
                    : 'Нагадування цьому клієнту увімкнено'
                ),
            })
          }
        />
        Не надсилати нагадування про оплату цьому клієнту
      </label>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        // для усних домовленостей. Прострочення в системі позначається незалежно — вимикаються лише
        листи/сповіщення клієнту.
      </div>
    </Card>
  )
}

function LoyaltySection({ companyId }: { companyId: string }) {
  const { isManager, isOwner } = useAuth()
  const { data, isLoading } = useCompanyLoyalty(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 120, marginBottom: 20 }} />
  if (!data) return null
  return <LoyaltyPanel companyId={companyId} data={data} canOverride={isOwner} />
}

function LoyaltyPanel({
  companyId,
  data,
  canOverride,
}: {
  companyId: string
  data: CompanyLoyalty
  canOverride: boolean
}) {
  const serverOverride: string = data.tierOverride ?? ''
  const [draft, setDraft] = useState<string>(serverOverride)
  const setOverride = useSetLoyaltyOverride(companyId)
  const dirty = draft !== serverOverride

  const save = () =>
    setOverride.mutate(draft === '' ? null : (draft as LoyaltyTier), {
      onSuccess: () => toast.success('Тір оновлено'),
    })

  const lifetime = Number(data.lifetimePaidUsd)
  const threshold = data.progress.nextThresholdUsd
  const fillPct = threshold ? Math.min(100, Math.round((lifetime / threshold) * 100)) : 100

  return (
    <Card title="Лояльність" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{TIER_LABEL[data.effectiveTier]}</span>
        <span className="wfp-mono" style={{ color: 'var(--wf-accent)' }}>
          −{data.discountPercent}% на рахунки
        </span>
        {data.tierOverride != null && (
          <span
            className="wfp-mono"
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 'var(--wf-radius)',
              border: '1px solid var(--wf-border)',
              color: 'var(--wf-fg-muted)',
            }}
          >
            ручний override · зароблено: {TIER_LABEL[data.earnedTier]}
          </span>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          className="wfp-mono"
          style={{
            fontSize: 12,
            color: 'var(--wf-fg-muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>сплачено за весь час: {fmtUsd(data.lifetimePaidUsd)}</span>
          {data.progress.nextTier ? (
            <span>
              ще {fmtUsd(data.progress.remainingUsd)} до «{TIER_LABEL[data.progress.nextTier]}»
            </span>
          ) : (
            <span>максимальний рівень 🎉</span>
          )}
        </div>
        <div
          style={{
            marginTop: 6,
            height: 6,
            borderRadius: 999,
            background: 'var(--wf-border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${fillPct}%`, height: '100%', background: 'var(--wf-accent)' }} />
        </div>
      </div>

      {canOverride && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 220 }}>
            <Select
              label="Ручний тір (override)"
              value={draft}
              onChange={setDraft}
              options={[
                { value: '', label: 'Авто (за витратами)' },
                { value: LoyaltyTier.NEW, label: TIER_LABEL[LoyaltyTier.NEW] },
                { value: LoyaltyTier.REGULAR, label: TIER_LABEL[LoyaltyTier.REGULAR] },
                { value: LoyaltyTier.PARTNER, label: TIER_LABEL[LoyaltyTier.PARTNER] },
                { value: LoyaltyTier.VIP, label: TIER_LABEL[LoyaltyTier.VIP] },
              ]}
            />
          </div>
          <Button
            variant="primary"
            disabled={!dirty}
            loading={setOverride.isPending}
            onClick={save}
          >
            Зберегти
          </Button>
        </div>
      )}

      {data.history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            // ІСТОРІЯ ТІРІВ
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {data.history.map((h, i) => (
              <div
                key={i}
                className="wfp-mono"
                style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}
              >
                {formatDate(h.createdAt)} · {TIER_LABEL[h.fromTier]} → {TIER_LABEL[h.toTier]}
                {h.reason ? ` (${h.reason})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Year-to-date margin for the client (S5.6 P-9). Owner-only — the backend 403s
 * everyone else. A compact roll-up; the full /margin screen has period controls + per-executor. */
function MarginSection({ companyId }: { companyId: string }) {
  const { isOwner } = useAuth()
  const range = useMemo(() => {
    const d = new Date()
    return { from: `${d.getFullYear()}-01-01`, to: isoDay(d) }
  }, [])
  const { data, isLoading } = useClientMargin(isOwner ? companyId : '', range.from, range.to)
  if (!isOwner) return null
  if (isLoading) return <Skeleton style={{ height: 110, marginBottom: 20 }} />
  const m = data?.margin
  if (!m) return null

  const marginPct = Number(m.marginPct)
  const marginTone = marginPct >= 0 ? 'var(--wf-accent)' : 'var(--wf-destructive)'

  return (
    <Card title="Маржа · з початку року (USD)" style={{ marginBottom: 20 }}>
      <div className="wfp-stats">
        <div className="wfp-stat">
          <div className="wfp-stat-k">дохід</div>
          <div className="wfp-stat-v">{fmtUsd(m.revenueUsd)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">собівартість</div>
          <div className="wfp-stat-v">{fmtUsd(m.costUsd)}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">маржа</div>
          <div className="wfp-stat-v" style={{ color: marginTone }}>
            {fmtUsd(m.marginUsd)} · {marginPct.toFixed(0)}%
          </div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">сплачено</div>
          <div className="wfp-stat-v">{Number(m.paidPct).toFixed(0)}%</div>
        </div>
      </div>

      {m.projects.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            // ЗА ПРОЄКТАМИ
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {m.projects.map((p) => (
              <div
                key={p.projectId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  gap: 12,
                  fontSize: 13,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--wf-border)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.projectName}
                </span>
                <span className="wfp-mono" style={{ textAlign: 'right' }}>
                  {fmtUsd(p.revenueUsd)}
                </span>
                <span className="wfp-mono" style={{ textAlign: 'right' }}>
                  {fmtUsd(p.costUsd)}
                </span>
                <span
                  className="wfp-mono"
                  style={{
                    textAlign: 'right',
                    color: Number(p.marginPct) >= 0 ? 'var(--wf-accent)' : 'var(--wf-destructive)',
                  }}
                >
                  {Number(p.marginPct).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Link to="/margin" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          → повний звіт маржі (період, за виконавцями)
        </Link>
      </div>
    </Card>
  )
}

/** Client legal requisites (06-Б, P-3) — the document "to" party. The team can edit on the
 * client's behalf (28-Б, PATCH); the client also edits in Portal. Managers are 403'd → hidden. */
function RequisitesSection({ companyId }: { companyId: string }) {
  const { isManager } = useAuth()
  const [editing, setEditing] = useState(false)
  const { data, isLoading } = useClientRequisites(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 110, marginBottom: 20 }} />
  const r = data?.requisites
  if (!r) return null

  if (editing) {
    return <RequisitesForm companyId={companyId} current={r} onDone={() => setEditing(false)} />
  }

  const rows: { k: string; v: string | null }[] = [
    { k: 'Тип', v: r.legalType ? (LEGAL_TYPE_LABEL[r.legalType] ?? r.legalType) : null },
    { k: 'Юр. назва', v: r.legalName },
    { k: 'ЄДРПОУ/ІПН', v: r.taxId },
    { k: 'ПДВ', v: r.vatPayer ? `Платник${r.vatId ? ` · ${r.vatId}` : ''}` : null },
    { k: 'Юр. адреса', v: r.legalAddress },
    { k: 'Банк', v: r.bankName },
    { k: 'IBAN', v: r.iban },
    {
      k: 'Підписант',
      v: r.signerName ? `${r.signerName}${r.signerTitle ? `, ${r.signerTitle}` : ''}` : null,
    },
    {
      k: 'Email для документів',
      v: r.documentEmail
        ? `${r.documentEmail}${r.documentEmailCc ? ` (cc: ${r.documentEmailCc})` : ''}`
        : null,
    },
  ].filter((row) => row.v)

  return (
    <Card
      title="Реквізити"
      style={{ marginBottom: 20 }}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            className="wfp-mono"
            style={{
              fontSize: 11,
              color: r.legalIsComplete ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
            }}
          >
            {r.legalIsComplete ? '✓ повні' : 'неповні'}
          </span>
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12 }}
            onClick={() => setEditing(true)}
          >
            редагувати
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // клієнт ще не заповнив реквізити — документи виставити не можна
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((row) => (
            <div
              key={row.k}
              style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, fontSize: 13 }}
            >
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                {row.k}
              </span>
              <span>{row.v}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const reqInputStyle = {
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 13,
  width: '100%',
} as const

/** Agency edit-on-behalf of a client's requisites (28-Б, PATCH /workspace/clients/:id/requisites).
 * Empty strings are sent as null; the server recomputes legalIsComplete + validates formats. */
function RequisitesForm({
  companyId,
  current,
  onDone,
}: {
  companyId: string
  current: { [K in keyof ClientRequisitesInput]?: unknown } & { vatPayer: boolean }
  onDone: () => void
}) {
  const update = useUpdateClientRequisites(companyId)
  const [f, setF] = useState({
    legalType: (current.legalType as string | null) ?? '',
    legalName: (current.legalName as string | null) ?? '',
    taxId: (current.taxId as string | null) ?? '',
    vatPayer: current.vatPayer,
    vatId: (current.vatId as string | null) ?? '',
    legalAddress: (current.legalAddress as string | null) ?? '',
    bankName: (current.bankName as string | null) ?? '',
    iban: (current.iban as string | null) ?? '',
    signerName: (current.signerName as string | null) ?? '',
    signerTitle: (current.signerTitle as string | null) ?? '',
    documentEmail: (current.documentEmail as string | null) ?? '',
    documentEmailCc: (current.documentEmailCc as string | null) ?? '',
  })
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))
  const clean = (s: string): string | null => (s.trim() === '' ? null : s.trim())

  const save = () =>
    update.mutate(
      {
        legalType: clean(f.legalType),
        legalName: clean(f.legalName),
        taxId: clean(f.taxId),
        vatPayer: f.vatPayer,
        vatId: clean(f.vatId),
        legalAddress: clean(f.legalAddress),
        bankName: clean(f.bankName),
        iban: clean(f.iban),
        signerName: clean(f.signerName),
        signerTitle: clean(f.signerTitle),
        documentEmail: clean(f.documentEmail),
        documentEmailCc: clean(f.documentEmailCc),
      },
      {
        onSuccess: () => {
          toast.success('Реквізити збережено')
          onDone()
        },
      }
    )

  const textField = (label: string, k: keyof typeof f) => (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {label.toUpperCase()}
      </span>
      <input
        value={f[k] as string}
        onChange={(e) => set(k, e.target.value)}
        style={reqInputStyle}
      />
    </label>
  )

  return (
    <Card title="Реквізити · редагування" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <Select
          label="Тип"
          value={f.legalType}
          onChange={(v) => set('legalType', v)}
          options={[
            { value: '', label: '—' },
            { value: 'fop', label: 'ФОП' },
            { value: 'tov', label: 'ТОВ' },
            { value: 'individual', label: 'Фізособа' },
            { value: 'foreign', label: 'Іноземна' },
          ]}
        />
        {textField('Юр. назва', 'legalName')}
        {textField('ЄДРПОУ/ІПН', 'taxId')}
        {textField('Юр. адреса', 'legalAddress')}
        {textField('Банк', 'bankName')}
        {textField('IBAN', 'iban')}
        {textField('Підписант', 'signerName')}
        {textField('Посада підписанта', 'signerTitle')}
        {textField('Email для документів', 'documentEmail')}
        {textField('Email CC', 'documentEmailCc')}
        {textField('ІПН ПДВ', 'vatId')}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={f.vatPayer}
          onChange={(e) => set('vatPayer', e.target.checked)}
        />
        Платник ПДВ
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Button variant="primary" loading={update.isPending} onClick={save}>
          Зберегти
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Скасувати
        </Button>
      </div>
    </Card>
  )
}

/** Client's financial projects (05-ПРОЕКТИ / P-1). Internal team, manager-blocked → hidden.
 * Read-only list here; full config (create/edit/close-cycle) lives on /projects/:id. */
function ProjectsSection({ companyId }: { companyId: string }) {
  const navigate = useNavigate()
  const { isManager } = useAuth()
  const { data, isLoading } = useCompanyProjects(companyId, !isManager)
  if (isManager) return null
  if (isLoading) return <Skeleton style={{ height: 110, marginBottom: 20 }} />
  const projects = data?.projects ?? []

  return (
    <Card
      title="Проєкти"
      style={{ marginBottom: 20 }}
      aux={`${projects.length}`}
      actions={
        <Link to="/projects" className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          + проєкт
        </Link>
      }
    >
      {projects.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // у клієнта ще немає фін-проєктів
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {projects.map((p) => {
            const amount =
              p.billingModel === 'fixed_monthly_advance'
                ? p.abonAmount
                  ? `${Number(p.abonAmount)} ${p.currency}/міс`
                  : '—'
                : p.clientHourlyRate
                  ? `${Number(p.clientHourlyRate)} ${p.currency}/год`
                  : '—'
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/projects/${p.id}`)
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 1.2fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 8px',
                  borderBottom: '1px solid var(--wf-border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span className="wfp-link" style={{ fontWeight: 500 }}>
                    {p.name}
                  </span>
                  {!p.active && (
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
                    >
                      (неактивний)
                    </span>
                  )}
                </div>
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  {MODEL_LABEL[p.billingModel] ?? p.billingModel}
                </span>
                <span className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
                  {CYCLE_LABEL[p.billingCycle] ?? p.billingCycle}
                </span>
                <span className="wfp-mono" style={{ fontSize: 12, textAlign: 'right' }}>
                  {amount}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
