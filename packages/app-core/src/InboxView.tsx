import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Skeleton } from '@workflo/ui'
import { formatDateTime } from './format.js'
import {
  KIND_ICON,
  KIND_LABEL,
  isMentionType,
  isSystemKind,
  notifKind,
  notifLinkId,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotifications,
  useSnoozeNotification,
  type Notification,
} from './notifications.js'

type Filter = 'all' | 'unread' | 'mentions' | 'system'

/** Інбокс — master-detail (design: inbox-screens.jsx). Left: searchable, tab-filtered list;
 * right: the focused notification + a jump-to-order link. Shared by portal + workspace — the only
 * per-app difference is the header `subtitle`. Both apps route the order at `/orders/:id`. */
export function InboxView({ subtitle }: { subtitle: string }) {
  const { data, isLoading } = useNotifications(50)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const markUnread = useMarkNotificationUnread()
  const snooze = useSnoozeNotification()
  const navigate = useNavigate()

  const items = useMemo(() => data?.notifications ?? [], [data])
  const counts = {
    all: items.length,
    unread: items.filter((n) => !n.isRead).length,
    mentions: items.filter((n) => isMentionType(n.type)).length,
    system: items.filter((n) => isSystemKind(n.type)).length,
  }

  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = items.filter((n) => {
    if (filter === 'unread' && n.isRead) return false
    if (filter === 'mentions' && !isMentionType(n.type)) return false
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
    { key: 'mentions', label: '@згадки', count: counts.mentions },
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
            // {counts.unread} {subtitle}
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

          <InboxDetail
            n={selected}
            onGo={(id) => navigate(`/orders/${id}`)}
            onUnread={(id) => markUnread.mutate(id)}
            onSnooze={(id, hours) => snooze.mutate({ id, hours })}
          />
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
      <span className="wfp-ibox-row-ts">
        {n.snoozedUntil && new Date(n.snoozedUntil) > new Date() ? '💤 ' : ''}
        {formatDateTime(n.createdAt).split(' ')[0]}
      </span>
    </div>
  )
}

function InboxDetail({
  n,
  onGo,
  onUnread,
  onSnooze,
}: {
  n: Notification | null
  onGo: (id: string) => void
  onUnread: (id: string) => void
  onSnooze: (id: string, hours: number) => void
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  if (!n) {
    return (
      <div className="wfp-ibox-detail">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: 40,
          }}
        >
          <EmptyState
            glyph="// inbox"
            title="Оберіть сповіщення"
            description="Деталі зʼявляться тут."
          />
        </div>
      </div>
    )
  }
  const kind = notifKind(n.type)
  const linkId = notifLinkId(n.metadata)
  return (
    <div className="wfp-ibox-detail">
      <div className="wfp-ibox-detail-h">
        <div className="wfp-ibox-detail-meta">
          <span className={`wfp-ibox-row-kind wfp-ibox-row-kind--${kind}`}>{KIND_LABEL[kind]}</span>
          <span>·</span>
          <span>{formatDateTime(n.createdAt)}</span>
        </div>
        <div className="wfp-ibox-detail-t">{n.title}</div>
      </div>
      <div style={{ padding: '16px 20px', minWidth: 0 }}>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--wf-fg-secondary)', margin: 0 }}>
          {n.body}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {linkId && (
            <Button variant="primary" size="sm" onClick={() => onGo(linkId)}>
              Перейти до замовлення →
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onUnread(n.id)}>
            Позначити непрочитаним
          </Button>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Button variant="ghost" size="sm" onClick={() => setSnoozeOpen((v) => !v)}>
              💤 Snooze ▾
            </Button>
            {snoozeOpen && (
              <span
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 30,
                  display: 'grid',
                  minWidth: 150,
                  background: 'var(--wf-surface)',
                  border: '1px solid var(--wf-border)',
                  borderRadius: 8,
                  boxShadow: '0 6px 24px rgba(0,0,0,.25)',
                  overflow: 'hidden',
                }}
              >
                {(
                  [
                    { label: 'на 1 годину', hours: 1 },
                    { label: 'до завтра', hours: 24 },
                    { label: 'на тиждень', hours: 168 },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.hours}
                    type="button"
                    onClick={() => {
                      onSnooze(n.id, o.hours)
                      setSnoozeOpen(false)
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '7px 12px',
                      fontSize: 13,
                      color: 'var(--wf-fg)',
                      textAlign: 'left',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
