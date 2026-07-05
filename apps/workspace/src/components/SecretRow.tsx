import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { VaultTypedCardFields, vaultTypeLabel } from '@workflo/app-core'
import type { VaultField } from '@workflo/types'
import {
  hasValidRevealGrant,
  type RevealResult,
  STEP_UP_REQUIRED,
  useCredentialAudit,
  useRevealGlobal,
} from '@/lib/credentials'

/** Minimal shape a secret row needs — satisfied by both `Credential` (+companyId) and
 * `GlobalCredential`. */
export interface SecretRowData {
  id: string
  companyId: string
  label: string
  service: string | null
  url: string | null
  username: string | null
  resourceType: string | null
  publicFields: VaultField[] | null
  revoked: boolean
  companyName?: string | null
}

const CRED_ACTION_LABEL: Record<string, string> = {
  'credentials.created': 'створено',
  'credentials.revealed': 'показано',
  'credentials.revoked': 'відкликано',
  'credentials.deleted': 'видалено',
  'credentials.updated': 'змінено',
}

const AUTO_HIDE_MS = 20_000

/**
 * Shared vault secret row for both the 360° «Секрети» tab and the global `/vault` screen.
 * Owns its OWN reveal mutation (so one row's pending state doesn't disable the others) and a
 * cleaned-up auto-hide timer (cleared on unmount and before each re-reveal — no setState on an
 * unmounted row, no stacked timers). Reveal routes through the per-company endpoint via companyId.
 */
export function SecretRow({
  cred,
  onRevoke,
  onDelete,
  onNeedStepUp,
  showCompanyLink = false,
  showJournal = true,
  formatDate,
}: {
  cred: SecretRowData
  onRevoke: () => void
  onDelete: () => void
  onNeedStepUp: (retry: () => void) => void
  showCompanyLink?: boolean
  showJournal?: boolean
  formatDate: (iso: string) => string
}) {
  const reveal = useRevealGlobal()
  const [shown, setShown] = useState<RevealResult | null>(null)
  const [showLog, setShowLog] = useState(false)
  const audit = useCredentialAudit(cred.companyId, cred.id, showLog && showJournal)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTyped = cred.resourceType != null
  const typeLabel = vaultTypeLabel(cred.resourceType)

  const clearHideTimer = () => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }
  // Clear any pending auto-hide when the row unmounts (revoke/delete refetch, navigation).
  useEffect(() => clearHideTimer, [])

  const runReveal = () => {
    reveal.mutate(
      { companyId: cred.companyId, credId: cred.id },
      {
        onSuccess: (r) => {
          setShown(r)
          clearHideTimer()
          hideTimer.current = setTimeout(() => setShown(null), AUTO_HIDE_MS)
        },
        onError: (err) => {
          // Grant expired between the check and the call → prompt for password, then retry.
          // Any OTHER error is toasted by the global mutationCache handler (single pipeline).
          if ((err as { code?: unknown }).code === STEP_UP_REQUIRED) {
            onNeedStepUp(runReveal)
          }
        },
      }
    )
  }
  const doReveal = () => {
    if (shown != null) {
      // toggle off
      clearHideTimer()
      setShown(null)
      return
    }
    // Skip the password prompt if a live step-up grant is already cached (5-min window).
    if (hasValidRevealGrant()) runReveal()
    else onNeedStepUp(runReveal)
  }
  const copy = () => {
    if (shown?.secret == null) return
    void navigator.clipboard?.writeText(shown.secret)
    toast.success('Скопійовано')
  }

  return (
    <div
      style={{
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        padding: '10px 12px',
        opacity: cred.revoked ? 0.55 : 1,
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
            {cred.label}
            {(typeLabel ?? cred.service) && (
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
              >
                {typeLabel ?? cred.service}
              </span>
            )}
            {cred.revoked && (
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-destructive)', marginLeft: 8 }}
              >
                відкликано
              </span>
            )}
          </div>
          {(showCompanyLink || cred.username || cred.url) && (
            <div
              className="wfp-mono"
              style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 2 }}
            >
              {showCompanyLink && cred.companyName && (
                <Link to={`/clients/${cred.companyId}`} className="wfp-link">
                  {cred.companyName}
                </Link>
              )}
              {showCompanyLink && cred.companyName && (cred.username || cred.url) ? ' · ' : ''}
              {cred.username ?? ''}
              {cred.username && cred.url ? ' · ' : ''}
              {cred.url ?? ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          {!cred.revoked && (
            <button
              type="button"
              className="wfp-link"
              style={{ fontSize: 12 }}
              disabled={reveal.isPending}
              onClick={doReveal}
            >
              {shown != null ? 'сховати' : 'показати'}
            </button>
          )}
          {showJournal && (
            <button
              type="button"
              className="wfp-link"
              style={{ fontSize: 12, color: showLog ? 'var(--wf-accent)' : undefined }}
              onClick={() => setShowLog((v) => !v)}
            >
              журнал
            </button>
          )}
          {!cred.revoked && (
            <button type="button" className="wfp-link" style={{ fontSize: 12 }} onClick={onRevoke}>
              відкликати
            </button>
          )}
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12, color: 'var(--wf-destructive)' }}
            onClick={onDelete}
          >
            видалити
          </button>
        </div>
      </div>

      {/* 17-Д typed card: public fields always visible, secret fields after reveal */}
      {isTyped && (
        <VaultTypedCardFields
          publicFields={cred.publicFields ?? []}
          secretFields={shown?.secretFields ?? null}
        />
      )}

      {!isTyped && shown?.secret != null && (
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
            {shown.secret}
          </code>
          <button type="button" className="wfp-link" style={{ fontSize: 12 }} onClick={copy}>
            копіювати
          </button>
        </div>
      )}

      {showJournal && showLog && (
        <div style={{ marginTop: 8, borderTop: '1px dashed var(--wf-border)', paddingTop: 8 }}>
          {audit.isLoading ? (
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              // завантаження журналу…
            </div>
          ) : (audit.data?.entries.length ?? 0) === 0 ? (
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              // ще не було дій
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 3 }}>
              {audit.data?.entries.map((e) => (
                <div
                  key={e.id}
                  className="wfp-mono"
                  style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}
                >
                  {formatDate(e.createdAt)} · {CRED_ACTION_LABEL[e.action] ?? e.action} ·{' '}
                  {e.actorName ?? '—'}
                  {e.ip ? ` · ${e.ip}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
