import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import {
  type GlobalCredential,
  useDeleteGlobal,
  useGlobalVault,
  useRevokeGlobal,
} from '@/lib/credentials'
import { SecretRow } from '@/components/SecretRow'
import { VaultStepUpModal } from '@/components/VaultStepUpModal'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'

/** Global credentials vault (module 17-ГЛОБАЛ + 17-SHARE). Owner: every client's secrets with
 * client/service/search filters + CRUD. Executor: read-only view of the secrets shared with
 * them (reveal via the same step-up; no revoke/delete/journal). Manager never reaches this
 * route. Reveal/revoke/delete route back to per-company endpoints via each row's companyId. */
export function VaultPage() {
  const { isOwner } = useAuth()
  const { data, isLoading } = useGlobalVault()
  const revoke = useRevokeGlobal()
  const del = useDeleteGlobal()

  const [q, setQ] = useState('')
  const [company, setCompany] = useState('')
  const [service, setService] = useState('')
  const [showRevoked, setShowRevoked] = useState(false)
  const [stepUpRetry, setStepUpRetry] = useState<(() => void) | null>(null)

  const all = useMemo(() => data?.credentials ?? [], [data])

  const companies = useMemo(() => {
    const m = new Map<string, string>()
    all.forEach((c) => m.set(c.companyId, c.companyName))
    return [...m.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [all])

  const services = useMemo(() => {
    const s = new Set<string>()
    all.forEach((c) => c.service && s.add(c.service))
    return [...s].sort()
  }, [all])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((c) => {
      if (!showRevoked && c.revoked) return false
      if (company !== '' && c.companyId !== company) return false
      if (service !== '' && c.service !== service) return false
      if (needle !== '') {
        const hay =
          `${c.label} ${c.username ?? ''} ${c.url ?? ''} ${c.companyName} ${c.service ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [all, q, company, service, showRevoked])

  const activeCount = all.filter((c) => !c.revoked).length
  const revokedCount = all.length - activeCount

  const doRevoke = (c: GlobalCredential) => {
    if (!window.confirm(`Відкликати секрет «${c.label}» (${c.companyName})?`)) return
    revoke.mutate(
      { companyId: c.companyId, credId: c.id },
      {
        onSuccess: () => toast.success('Секрет відкликано'),
      }
    )
  }
  const doDelete = (c: GlobalCredential) => {
    if (!window.confirm(`Назавжди видалити секрет «${c.label}» (${c.companyName})?`)) return
    del.mutate(
      { companyId: c.companyId, credId: c.id },
      {
        onSuccess: () => toast.success('Секрет видалено'),
      }
    )
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            // сховище ключів агенції · {activeCount} активних
            {revokedCount > 0 ? ` · ${revokedCount} відкликаних` : ''}
          </div>
          <h1 className="wfp-ph-h1">Секрети</h1>
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 280 }} />
      ) : all.length === 0 ? (
        <EmptyState
          glyph="// vault"
          title={isOwner ? 'Секретів ще немає' : 'Вам ще не видано доступів'}
          description={
            isOwner
              ? 'Додайте доступи клієнта у картці клієнта → таб «Секрети».'
              : 'Власник агенції може відкрити вам секрети клієнта — точково або всі по клієнту.'
          }
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              alignItems: 'end',
              marginBottom: 16,
            }}
          >
            <Input
              label="Пошук"
              value={q}
              placeholder="назва / логін / url…"
              onChange={(e) => setQ(e.target.value)}
            />
            <Select
              label="Клієнт"
              value={company}
              onChange={setCompany}
              options={[{ value: '', label: 'усі клієнти' }, ...companies]}
            />
            <Select
              label="Сервіс"
              value={service}
              onChange={setService}
              options={[
                { value: '', label: 'усі сервіси' },
                ...services.map((s) => ({ value: s, label: s })),
              ]}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                paddingBottom: 8,
              }}
            >
              <input
                type="checkbox"
                checked={showRevoked}
                onChange={(e) => setShowRevoked(e.target.checked)}
              />
              показувати відкликані
            </label>
          </div>

          <Card title="Секрети" aux={`${filtered.length}`}>
            {filtered.length === 0 ? (
              <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                // нічого не знайдено за фільтрами
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {filtered.map((c) => (
                  <SecretRow
                    key={c.id}
                    cred={c}
                    onRevoke={() => doRevoke(c)}
                    onDelete={() => doDelete(c)}
                    onNeedStepUp={(retry) => setStepUpRetry(() => retry)}
                    showCompanyLink={isOwner}
                    readOnly={!isOwner}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
      <VaultStepUpModal
        open={stepUpRetry !== null}
        onClose={() => setStepUpRetry(null)}
        onSuccess={() => {
          const retry = stepUpRetry
          setStepUpRetry(null)
          retry?.()
        }}
      />
    </div>
  )
}
