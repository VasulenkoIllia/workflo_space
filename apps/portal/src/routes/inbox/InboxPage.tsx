import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { formatDateTime } from '@/lib/format'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from '@/lib/notifications'

export function InboxPage() {
  const { data, isLoading } = useNotifications(50)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const items = data?.notifications ?? []
  const unread = data?.meta.unreadCount ?? 0

  return (
    <div style={{ maxWidth: 760 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Інбокс</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // {unread > 0 ? `${unread} непрочитаних` : 'усе прочитано'}
          </div>
        </div>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Позначити всі прочитаними
          </Button>
        )}
      </div>

      <Card style={{ marginTop: 16 }}>
        {isLoading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <Skeleton style={{ height: 48 }} />
            <Skeleton style={{ height: 48 }} />
            <Skeleton style={{ height: 48 }} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            glyph="// ∅"
            title="Сповіщень ще немає"
            description="Тут зʼявлятимуться оновлення замовлень, рахунки та документи."
          />
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {items.map((n) => (
              <Row key={n.id} n={n} onRead={() => !n.isRead && markRead.mutate(n.id)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Row({ n, onRead }: { n: Notification; onRead: () => void }) {
  return (
    <button
      type="button"
      onClick={onRead}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'start',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 8px',
        border: 0,
        borderBottom: '1px solid var(--wf-border)',
        background: n.isRead
          ? 'transparent'
          : 'color-mix(in oklab, var(--wf-accent) 7%, transparent)',
        cursor: n.isRead ? 'default' : 'pointer',
      }}
    >
      <span style={{ paddingTop: 5 }}>
        <StatusDot tone={n.isRead ? 'muted' : 'accent'} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: n.isRead ? 400 : 600 }}>{n.title}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
          {n.body}
        </span>
      </span>
      <span
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', whiteSpace: 'nowrap' }}
      >
        {formatDateTime(n.createdAt)}
      </span>
    </button>
  )
}
