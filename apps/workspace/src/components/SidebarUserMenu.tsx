import { useState, type ReactNode } from 'react'

export interface UserMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

/** Sidebar footer user-card with a pop-up menu (design-v2 `.wfp-sb-user--menu` + `.wfp-sb-rolemenu`).
 * No role-switch — the app uses server-enforced RBAC; this is a plain account menu. */
export function SidebarUserMenu({
  name,
  roleLabel,
  items,
}: {
  name: string
  roleLabel: string
  items: UserMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const initial = name.trim().slice(0, 1).toUpperCase() || 'W'

  return (
    <div className="wfp-sb-foot">
      <div className="wfp-sb-user wfp-sb-user--menu">
        <button
          type="button"
          className="wfp-sb-user-btn"
          onClick={() => setOpen((v) => !v)}
          data-open={open || undefined}
        >
          <div className="wfp-sb-user-av">{initial}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div className="wfp-sb-user-name">{name}</div>
            <div className="wfp-sb-user-meta">
              {roleLabel} <span className="wfp-sb-user-chev">▾</span>
            </div>
          </div>
        </button>
        {open && (
          <>
            <div className="wfp-sb-rolemenu-scrim" onClick={() => setOpen(false)} />
            <div className="wfp-sb-rolemenu">
              <div className="wfp-sb-rolemenu-h">// акаунт</div>
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  className="wfp-sb-rolemenu-item"
                  onClick={() => {
                    setOpen(false)
                    it.onClick()
                  }}
                >
                  <div
                    className="wfp-sb-rolemenu-item-t"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: it.danger ? 'var(--wf-destructive)' : undefined,
                    }}
                  >
                    {it.icon}
                    {it.label}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
