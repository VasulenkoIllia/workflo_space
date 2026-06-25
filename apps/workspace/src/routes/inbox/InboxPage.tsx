import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Skeleton } from '@workflo/ui'
import { formatDateTime } from '@/lib/format'
import {
  KIND_ICON,
  KIND_LABEL,
  isSystemKind,
  notifKind,
  notifLinkId,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from '@/lib/notifications'

type Filter = 'all' | 'unread' | 'system'

/** Інбокс — master-detail (design: inbox-screens.jsx). Left: searchable, tab-filtered list;
 * right: the focused notification + a jump-to-order link. Bell → /inbox (no separate dropdown). */
export function InboxPage() {
  const { data, isLoading } = useNotifications(50)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const navigate = useNavigate()

  const items = useMemo(() => data?.notifications ?? [], [data])
  const counts = {
    all: items.length,
    unread: items.filter((n) => !n.isRead).length,
    system: items.filter((n) => isSystemKind(n.type)).length,
  }

  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = items.filter((n) => {
    if (filter === 'unread' && n.isRead) return false
    if (filter === 'system' && !isSystemKind(n.type)) return false
    if (q && !`${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  const selected =
    filtered.find((n) => n.id === openId) ?? filtered.find((n) => !n.isRead) ?? filtered[0] ?? null

  const open = (n: Notification) => {
    setOpenId(n.id)
    if (!n.isRead) markRead.mutate(n.id)
  }

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'усі', count: counts.all },
    { key: 'unread', label: 'непрочитані', count: counts.unread },
    { key: 'system', label: 'система', count: counts.system },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Інбокс</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // {counts.unread} нових · по всіх клієнтах і команді
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {counts.unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Позначити прочитаним
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
            <Icon name="settings" size={13} /> Канали
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton style={{ height: 56 }} />
          <Skeleton style={{ height: 56 }} />
          <Skeleton style={{ height: 56 }} />
        </div>
      ) : (
        <div className="wfp-ibox">
          <div className="wfp-ibox-list">
            <div className="wfp-ibox-list-h">
              <div className="wfp-search" style={{ height: 32, minWidth: 0 }}>
                <Icon name="search" size={13} />
                <input
                  placeholder="Шукати в інбоксі…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="wfp-ibox-list-tabs">
                {TABS.map((t) => (
                  <span
                    key={t.key}
                    className="wfp-ibox-list-tab"
                    data-on={filter === t.key || undefined}
                    onClick={() => setFilter(t.key)}
                    role="button"
                  >
                    {t.label} <span className="wfp-ibox-list-tab-count">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="wfp-ibox-list-rows">
              {filtered.length === 0 ? (
                <div
                  className="wfp-mono"
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--wf-fg-muted)',
                  }}
                >
                  $ ls inbox/{filter}
                  <br />
                  <span style={{ color: 'var(--wf-fg-subtle)' }}># нічого тут</span>
                </div>
              ) : (
                filtered.map((n) => (
                  <InboxRow
                    key={n.id}
                    n={n}
                    selected={selected?.id === n.id}
                    onOpen={() => open(n)}
                  />
                ))
              )}
            </div>
          </div>

          <InboxDetail n={selected} onGo={(id) => navigate(`/orders/${id}`)} />
        </div>
      )}
    </div>
  )
}

function InboxRow({
  n,
  selected,
  onOpen,
}: {
  n: Notification
  selected: boolean
  onOpen: () => void
}) {
  const kind = notifKind(n.type)
  return (
    <div
      className="wfp-ibox-row"
      data-unread={!n.isRead || undefined}
      data-selected={selected || undefined}
      onClick={onOpen}
      style={{ cursor: 'pointer' }}
    >
      <span className="wfp-ibox-row-unread" />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'color-mix(in oklab, var(--wf-fg) 6%, transparent)',
          color: 'var(--wf-fg-muted)',
        }}
      >
        <Icon name={KIND_ICON[kind]} size={14} />
      </span>
      <div className="wfp-ibox-row-body">
        <div className="wfp-ibox-row-meta">
          <span className={`wfp-ibox-row-kind wfp-ibox-row-kind--${kind}`}>{KIND_LABEL[kind]}</span>
        </div>
        <div className="wfp-ibox-row-title">{n.title}</div>
        <div className="wfp-ibox-row-preview">{n.body}</div>
      </div>
      <span className="wfp-ibox-row-ts">{formatDateTime(n.createdAt).split(' ')[0]}</span>
    </div>
  )
}

function InboxDetail({ n, onGo }: { n: Notification | null; onGo: (id: string) => void }) {
  if (!n) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <EmptyState
          glyph="// inbox"
          title="Оберіть сповіщення"
          description="Деталі зʼявляться тут."
        />
      </div>
    )
  }
  const kind = notifKind(n.type)
  const linkId = notifLinkId(n.metadata)
  return (
    <div style={{ padding: '20px 24px', minWidth: 0 }}>
      <span className={`wfp-ibox-row-kind wfp-ibox-row-kind--${kind}`}>{KIND_LABEL[kind]}</span>
      <div style={{ fontSize: 20, fontWeight: 600, margin: '10px 0 6px' }}>{n.title}</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 16 }}
      >
        {formatDateTime(n.createdAt)}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--wf-fg-secondary)' }}>{n.body}</p>
      {linkId && (
        <Button variant="primary" size="sm" style={{ marginTop: 16 }} onClick={() => onGo(linkId)}>
          Перейти до замовлення →
        </Button>
      )}
    </div>
  )
}
