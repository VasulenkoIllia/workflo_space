import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Icon, Input, Modal, Skeleton } from '@workflo/ui'
import { VaultStepUpModal } from '@/components/VaultStepUpModal'
import { useAuth } from '@/contexts/AuthContext'
import {
  hasValidRevealGrant,
  type PortalCredential,
  type PortalCredentialInput,
  STEP_UP_REQUIRED,
  useCreatePortalCredential,
  useDeletePortalCredential,
  usePortalCredentialAudit,
  usePortalCredentials,
  useRevealPortalCredential,
  useRevokePortalCredential,
} from '@/lib/credentials'
import { formatDateTime } from '@/lib/format'

/**
 * Portal «Секрети» (17-А self-service + 17-Б журнал): the client's company owner adds
 * accesses for the agency, reveals them behind a password step-up (auto-hide 20s),
 * revokes any access at any moment, deletes own rows, and reads the journal of who
 * from the team opened what and when. Design canon: `design-v2/project/portal-secrets.jsx`
 * (typed cards 17-Д — a later slice; this is the freeform-fields subset).
 */

const CRED_ACTION_LABEL: Record<string, string> = {
  'credentials.created': 'створено',
  'credentials.revealed': 'показано',
  'credentials.revoked': 'відкликано',
  'credentials.deleted': 'видалено',
  'credentials.updated': 'змінено',
}

const AUTO_HIDE_MS = 20_000

export function SecretsPage() {
  const { user } = useAuth()
  const activeRole = user?.companies.find((c) => c.id === user.activeCompanyId)?.role
  const isOwner = activeRole === 'owner'
  const emailVerified = user?.profile.emailVerified !== false

  const { data, isLoading } = usePortalCredentials(isOwner)
  const revoke = useRevokePortalCredential()
  const del = useDeletePortalCredential()
  const [adding, setAdding] = useState(false)
  const [stepUpRetry, setStepUpRetry] = useState<(() => void) | null>(null)

  if (!isOwner) {
    return (
      <div>
        <PageHeader onAdd={null} />
        <EmptyState
          glyph="// 403"
          title="Лише власник компанії"
          description="Секрети бачить і керує ними тільки власник вашої компанії."
        />
      </div>
    )
  }

  const creds = data?.credentials ?? []

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader onAdd={() => setAdding(true)} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wf-accent)', flexShrink: 0, marginTop: 2 }}>
            <Icon name="lock" size={18} />
          </span>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 2 }}>Зашифроване сховище</div>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
              Значення секретів шифруються (AES-256-GCM) і ніколи не показуються списком. Кожне
              розкриття — і вами, і командою агенції — вимагає підтвердження пароля та потрапляє в
              журнал нижче. Ви можете відкликати будь-який доступ у будь-який момент.
            </div>
          </div>
        </div>
        {!emailVerified && (
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-warning, #b45309)', marginTop: 10 }}
          >
            // додавання і показ секретів доступні після підтвердження email (лист — у
            Налаштуваннях)
          </div>
        )}
      </Card>

      {isLoading ? (
        <Skeleton style={{ height: 160 }} />
      ) : creds.length === 0 ? (
        <EmptyState
          glyph="// vault"
          title="Ще немає секретів"
          description="Додайте доступи (CRM, хостинг, FTP…), якими має користуватись команда агенції."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {creds.map((c) => (
            <PortalSecretRow
              key={c.id}
              cred={c}
              onNeedStepUp={(retry) => setStepUpRetry(() => retry)}
              onRevoke={() => {
                if (!window.confirm(`Відкликати «${c.label}»? Показ стане неможливим.`)) return
                revoke.mutate(c.id, { onSuccess: () => toast.success('Відкликано') })
              }}
              onDelete={
                c.mine
                  ? () => {
                      if (!window.confirm(`Видалити «${c.label}» назавжди?`)) return
                      del.mutate(c.id, { onSuccess: () => toast.success('Видалено') })
                    }
                  : null
              }
            />
          ))}
        </div>
      )}

      <AddSecretModal open={adding} onClose={() => setAdding(false)} />
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

function PageHeader({ onAdd }: { onAdd: (() => void) | null }) {
  return (
    <div className="wfp-ph">
      <div className="wfp-ph-l">
        <div className="wfp-ph-sub">// доступи для команди агенції</div>
        <h1 className="wfp-ph-h1">Секрети</h1>
      </div>
      {onAdd && (
        <div className="wfp-ph-r">
          <Button variant="primary" onClick={onAdd}>
            + Додати ресурс
          </Button>
        </div>
      )}
    </div>
  )
}

/** One secret row — reveal behind step-up (auto-hide), journal on expand. Portal twin of
 * the workspace SecretRow, minus IP in the journal and with mine-only delete. */
function PortalSecretRow({
  cred,
  onRevoke,
  onDelete,
  onNeedStepUp,
}: {
  cred: PortalCredential
  onRevoke: () => void
  onDelete: (() => void) | null
  onNeedStepUp: (retry: () => void) => void
}) {
  const reveal = useRevealPortalCredential()
  const [shown, setShown] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const audit = usePortalCredentialAudit(cred.id, showLog)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = () => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }
  useEffect(() => clearHideTimer, [])

  const runReveal = () => {
    reveal.mutate(cred.id, {
      onSuccess: (r) => {
        setShown(r.secret)
        clearHideTimer()
        hideTimer.current = setTimeout(() => setShown(null), AUTO_HIDE_MS)
      },
      onError: (err) => {
        if ((err as { code?: unknown }).code === STEP_UP_REQUIRED) {
          onNeedStepUp(runReveal)
        }
      },
    })
  }
  const doReveal = () => {
    if (shown != null) {
      clearHideTimer()
      setShown(null)
      return
    }
    if (hasValidRevealGrant()) runReveal()
    else onNeedStepUp(runReveal)
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
            {cred.service && (
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
              >
                {cred.service}
              </span>
            )}
            {cred.mine && (
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-accent)', marginLeft: 8 }}
              >
                додано вами
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
          {(cred.username || cred.url) && (
            <div
              className="wfp-mono"
              style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 2 }}
            >
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
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 12, color: showLog ? 'var(--wf-accent)' : undefined }}
            onClick={() => setShowLog((v) => !v)}
          >
            журнал
          </button>
          {!cred.revoked && (
            <button type="button" className="wfp-link" style={{ fontSize: 12 }} onClick={onRevoke}>
              відкликати
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="wfp-link"
              style={{ fontSize: 12, color: 'var(--wf-destructive)' }}
              onClick={onDelete}
            >
              видалити
            </button>
          )}
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
        </div>
      )}

      {showLog && (
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
                  {formatDateTime(e.createdAt)} · {CRED_ACTION_LABEL[e.action] ?? e.action} ·{' '}
                  {e.actorName ?? '—'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddSecretModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreatePortalCredential()
  const [f, setF] = useState({
    label: '',
    service: '',
    url: '',
    username: '',
    secret: '',
    notes: '',
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const close = () => {
    setF({ label: '', service: '', url: '', username: '', secret: '', notes: '' })
    onClose()
  }

  const submit = () => {
    if (f.label.trim() === '' || f.secret === '') {
      toast.error('Назва і значення секрету обовʼязкові')
      return
    }
    const body: PortalCredentialInput = {
      label: f.label.trim(),
      service: f.service.trim() || null,
      url: f.url.trim() || null,
      username: f.username.trim() || null,
      secret: f.secret,
      notes: f.notes.trim() || null,
    }
    create.mutate(body, {
      onSuccess: () => {
        toast.success('Секрет збережено (зашифровано)')
        close()
      },
    })
  }

  return (
    <Modal open={open} onClose={close} title="Додати ресурс">
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label="Назва *"
          placeholder="Напр. «Адмінка сайту»"
          value={f.label}
          onChange={(e) => set('label', e.target.value)}
        />
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <Input
            label="Сервіс"
            placeholder="wordpress / ftp / crm…"
            value={f.service}
            onChange={(e) => set('service', e.target.value)}
          />
          <Input
            label="Логін"
            value={f.username}
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
        <Input
          label="URL входу"
          placeholder="https://…"
          value={f.url}
          onChange={(e) => set('url', e.target.value)}
        />
        <Input
          label="Секрет (пароль / ключ / токен) *"
          type="password"
          value={f.secret}
          onChange={(e) => set('secret', e.target.value)}
        />
        <Input
          label="Нотатки"
          placeholder="Необовʼязково"
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // значення буде зашифровано; команда агенції побачить його лише через «показати» з
          підтвердженням пароля
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            Зберегти
          </Button>
          <Button variant="ghost" onClick={close}>
            Скасувати
          </Button>
        </div>
      </div>
    </Modal>
  )
}
