import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, EmptyState, Input, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import {
  type GlobalCredential,
  useDeleteGlobal,
  useGlobalVault,
  useRevealGlobal,
  useRevokeGlobal,
} from '@/lib/credentials'

/** Global credentials vault (module 17-ГЛОБАЛ) — owner-only. Every client's secrets on one
 * screen with client/service/search filters. Same envelope-encrypted store as the 360° tab;
 * reveal/revoke/delete route back to the per-company endpoints via each row's companyId. */
export function VaultPage() {
  const { data, isLoading } = useGlobalVault()
  const reveal = useRevealGlobal()
  const revoke = useRevokeGlobal()
  const del = useDeleteGlobal()

  const [q, setQ] = useState('')
  const [company, setCompany] = useState('')
  const [service, setService] = useState('')
  const [showRevoked, setShowRevoked] = useState(false)

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
        onError: () => toast.error('Не вдалося відкликати'),
      }
    )
  }
  const doDelete = (c: GlobalCredential) => {
    if (!window.confirm(`Назавжди видалити секрет «${c.label}» (${c.companyName})?`)) return
    del.mutate(
      { companyId: c.companyId, credId: c.id },
      {
        onSuccess: () => toast.success('Секрет видалено'),
        onError: () => toast.error('Не вдалося видалити'),
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
          title="Секретів ще немає"
          description="Додайте доступи клієнта у картці клієнта → таб «Секрети»."
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
                  <VaultRow
                    key={c.id}
                    c={c}
                    reveal={reveal}
                    onRevoke={doRevoke}
                    onDelete={doDelete}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function VaultRow({
  c,
  reveal,
  onRevoke,
  onDelete,
}: {
  c: GlobalCredential
  reveal: ReturnType<typeof useRevealGlobal>
  onRevoke: (c: GlobalCredential) => void
  onDelete: (c: GlobalCredential) => void
}) {
  const [shown, setShown] = useState<string | null>(null)

  const doReveal = () => {
    reveal.mutate(
      { companyId: c.companyId, credId: c.id },
      {
        onSuccess: (r) => {
          setShown(r.secret)
          window.setTimeout(() => setShown(null), 20000) // auto-hide plaintext
        },
        onError: () => toast.error('Не вдалося показати секрет'),
      }
    )
  }
  const copy = () => {
    if (shown == null) return
    void navigator.clipboard?.writeText(shown)
    toast.success('Скопійовано')
  }

  return (
    <div
      style={{
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        padding: '10px 12px',
        opacity: c.revoked ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'baseline',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500 }}>
            {c.label}
            {c.service && (
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
              >
                {c.service}
              </span>
            )}
            {c.revoked && (
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-destructive)', marginLeft: 8 }}
              >
                відкликано
              </span>
            )}
          </div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 2 }}
          >
            <Link to={`/clients/${c.companyId}`} className="wfp-link">
              {c.companyName}
            </Link>
            {c.username ? ` · ${c.username}` : ''}
            {c.url ? ` · ${c.url}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          {!c.revoked && (
            <button
              type="button"
              className="wfp-link"
              style={{ fontSize: 12 }}
              disabled={reveal.isPending}
              onClick={doReveal}
            >
              показати
            </button>
          )}
          {!c.revoked && (
            <button
              type="button"
              className="wfp-link"
              style={{ fontSize: 12 }}
              onClick={() => onRevoke(c)}
            >
              відкликати
            </button>
          )}
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12, color: 'var(--wf-destructive)' }}
            onClick={() => onDelete(c)}
          >
            видалити
          </button>
        </div>
      </div>
      {shown != null && (
        <div
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}
        >
          <code
            style={{
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '4px 8px',
              fontSize: 13,
              wordBreak: 'break-all',
            }}
          >
            {shown}
          </code>
          <button type="button" className="wfp-link" style={{ fontSize: 12 }} onClick={copy}>
            копіювати
          </button>
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}
            onClick={() => setShown(null)}
          >
            сховати
          </button>
        </div>
      )}
    </div>
  )
}
