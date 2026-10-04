import { Icon } from '@workflo/ui'
import { formatDateTime } from './format.js'
import {
  KIND_ICON,
  notifKind,
  useMarkAllNotificationsRead,
  useNotifications,
} from './notifications.js'

/**
 * Bell-dropdown (18): прев'ю останніх 4 сповіщень + «прочитати все» + перехід в
 * інбокс. Рендериться через Topbar.bellPanel; клік по рядку веде в інбокс —
 * там повний master-detail.
 */
export function BellDropdown({
  onOpenInbox,
  close,
}: {
  onOpenInbox: () => void
  close: () => void
}) {
  const { data } = useNotifications(4)
  const markAll = useMarkAllNotificationsRead()
  const items = data?.notifications ?? []
  const unread = data?.meta.unreadCount ?? 0

  return (
    <div
      style={{
        width: 320,
        maxWidth: '86vw',
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 10,
        boxShadow: '0 10px 34px rgba(0,0,0,.3)',
        overflow: 'hidden',
      }}
    >
      <div
        className="wfp-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--wf-fg-muted)',
          borderBottom: '1px solid var(--wf-border)',
        }}
      >
        <span>// нотифікації · {unread} нових</span>
        {unread > 0 && (
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 11 }}
            onClick={() => markAll.mutate()}
          >
            прочитати все
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="wfp-mono"
          style={{ padding: 18, fontSize: 12, color: 'var(--wf-fg-muted)', textAlign: 'center' }}
        >
          # порожньо
        </div>
      ) : (
        items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              close()
              onOpenInbox()
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              width: '100%',
              padding: '9px 12px',
              border: 'none',
              borderBottom: '1px solid var(--wf-border)',
              background: n.isRead
                ? 'transparent'
                : 'color-mix(in oklab, var(--wf-accent) 5%, transparent)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ color: 'var(--wf-fg-muted)', marginTop: 2 }}>
              <Icon name={KIND_ICON[notifKind(n.type)]} size={13} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: n.isRead ? 400 : 600,
                  color: 'var(--wf-fg)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.title}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--wf-fg-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.body}
              </span>
            </span>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}>
              {formatDateTime(n.createdAt).split(' ')[0]}
            </span>
          </button>
        ))
      )}

      <button
        type="button"
        className="wfp-mono"
        onClick={() => {
          close()
          onOpenInbox()
        }}
        style={{
          display: 'block',
          width: '100%',
          padding: '9px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 11,
          color: 'var(--wf-accent)',
          textAlign: 'center',
        }}
      >
        усі сповіщення →
      </button>
    </div>
  )
}
