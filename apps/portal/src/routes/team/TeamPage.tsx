import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { COMPANY_PERMISSIONS, type CompanyPermissionKey } from '@workflo/types'
import { Button, Card, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyAccess } from '@/lib/companyAccess'
import { formatDate } from '@/lib/format'

const EMAIL_RE = /^\S+@\S+\.\S+$/

interface CompanyMember {
  profileId: string
  name: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
  /** PORTAL-MEMBER: прапорці учасника (у власника порожні — має все). */
  permissions?: Partial<Record<CompanyPermissionKey, boolean>>
}

const MEMBERS_KEY = ['portal-company-members'] as const

/**
 * Портал · Учасники (design-v2 portal-team.jsx → PortalTeam + PortalSettingsMembers).
 * PORTAL-MEMBER: власник компанії вмикає учасникам права (фінанси / погодження / запрошення)
 * і видаляє учасників; учасник із «запрошує» може запрошувати колег.
 */
export function TeamPage() {
  const { user } = useAuth()
  const myId = user?.profile.id
  const { company, isOwner, canInvite } = useCompanyAccess()
  const [email, setEmail] = useState('')
  const [removing, setRemoving] = useState<CompanyMember | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: () => api.get<{ members: CompanyMember[] }>('/portal/company/members'),
  })
  const members = data?.members ?? []

  const invite = useMutation({
    mutationFn: (value: string) => api.post('/company/members/invite', { email: value }),
    onSuccess: () => {
      toast.success('Запрошення надіслано')
      setEmail('')
      void qc.invalidateQueries({ queryKey: MEMBERS_KEY })
    },
  })

  const setFlag = useMutation({
    mutationFn: (v: { profileId: string; key: CompanyPermissionKey; on: boolean }) =>
      api.patch(`/portal/company/members/${v.profileId}/permissions`, { [v.key]: v.on }),
    onSuccess: () => {
      toast.success('Права оновлено — діють з наступного входу учасника (до 15 хв)')
      void qc.invalidateQueries({ queryKey: MEMBERS_KEY })
    },
  })

  const remove = useMutation({
    mutationFn: (profileId: string) => api.delete(`/portal/company/members/${profileId}`),
    onSuccess: () => {
      toast.success('Учасника видалено з компанії')
      setRemoving(null)
      void qc.invalidateQueries({ queryKey: MEMBERS_KEY })
    },
  })

  const memberCount = members.filter((m) => m.role === 'member').length

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Учасники</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // {company?.name ?? '—'} · {members.length}{' '}
        {members.length === 1 ? 'учасник' : 'учасників'}
        {members.length > 0 ? ` · 1 власник · ${memberCount} учасн.` : ''}
      </div>

      {canInvite && (
        <Card title="Запросити учасника" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <Input
                label="Email"
                type="email"
                placeholder="colleague@company.com"
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
            style={{ fontSize: 10.5, color: 'var(--wf-fg-subtle)', marginTop: 8 }}
          >
            // запрошення діє 7 днів · новий учасник бачить замовлення, чат, файли й документи без
            фінансів — права вмикає власник нижче
          </div>
        </Card>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton style={{ height: 64 }} />
          <Skeleton style={{ height: 64 }} />
        </div>
      ) : isError ? (
        <EmptyState
          glyph="// помилка"
          title="Не вдалося завантажити учасників"
          description="Оновіть сторінку або спробуйте пізніше."
        />
      ) : members.length === 0 ? (
        <EmptyState
          title="Поки лише ви"
          description="Запросіть колег — вони зʼявляться тут після прийняття запрошення."
        />
      ) : (
        <div>
          {members.map((m) => {
            const me = m.profileId === myId
            const editable = isOwner && m.role === 'member' && !me
            return (
              <div
                key={m.profileId}
                className="wfp-member-row"
                data-me={me || undefined}
                style={{ gridTemplateColumns: '44px minmax(0, 1fr) auto auto' }}
              >
                <span
                  className="wfp-member-row-av"
                  style={{
                    background: me ? 'var(--wf-accent-bg)' : 'var(--wf-fg)',
                    color: me ? 'var(--wf-fg)' : 'var(--wf-bg)',
                  }}
                >
                  {initials(m.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="wfp-member-row-name">
                    {m.name}
                    {me && <span className="wfp-member-row-me">ви</span>}
                  </div>
                  <div
                    className="wfp-member-row-sub"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {m.email} · з {formatDate(m.joinedAt)}
                  </div>
                </div>
                <span
                  className={`wfp-role-pill wfp-role-pill--${m.role === 'owner' ? 'owner' : 'executor'}`}
                >
                  {m.role === 'owner' ? 'власник' : 'учасник'}
                </span>
                <div>
                  {editable && (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                      Видалити
                    </Button>
                  )}
                </div>

                {m.role === 'member' && (
                  <div
                    style={{
                      gridColumn: '2 / -1',
                      display: 'flex',
                      gap: 16,
                      flexWrap: 'wrap',
                      paddingTop: 10,
                      borderTop: '1px dashed var(--wf-border)',
                    }}
                  >
                    {COMPANY_PERMISSIONS.map((p) => {
                      const on = m.permissions?.[p.key] === true
                      return (
                        <label
                          key={p.key}
                          title={p.hint}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12.5,
                            color: on ? 'var(--wf-fg)' : 'var(--wf-fg-muted)',
                            cursor: editable ? 'pointer' : 'default',
                          }}
                        >
                          <span
                            className="wfp-notif-toggle"
                            data-on={on || undefined}
                            style={{ opacity: editable ? 1 : 0.55 }}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!editable || setFlag.isPending}
                              aria-label={`${m.name}: ${p.label}`}
                              onChange={(e) =>
                                setFlag.mutate({
                                  profileId: m.profileId,
                                  key: p.key,
                                  on: e.target.checked,
                                })
                              }
                            />
                            <span className="wfp-notif-toggle-track" />
                          </span>
                          {p.label}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div
        className="wfp-mono"
        style={{
          marginTop: 14,
          padding: '12px 16px',
          background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)',
          border: '1px dashed var(--wf-border)',
          borderRadius: 6,
          fontSize: 11.5,
          color: 'var(--wf-fg-secondary)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--wf-fg)' }}>// як працює:</strong> учасник бачить замовлення,
        чат, файли й документи компанії. Фінанси (рахунки, оплати, гаманець, бонуси), погодження
        кошторисів і запрошення колег — лише з увімкненим правом.{' '}
        <strong style={{ color: 'var(--wf-fg)' }}>// власник</strong> має все, змінює реквізити й
        керує учасниками.
      </div>

      <Modal
        open={removing != null}
        onClose={() => setRemoving(null)}
        title="Видалити учасника?"
        aux={removing?.email}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={remove.isPending}>
              Скасувати
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => removing && remove.mutate(removing.profileId)}
            >
              Видалити
            </Button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--wf-fg-secondary)', lineHeight: 1.5 }}>
          {removing?.name} втратить доступ до замовлень, чатів і документів компанії. Повернути
          можна новим запрошенням.
        </div>
      </Modal>
    </div>
  )
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}
