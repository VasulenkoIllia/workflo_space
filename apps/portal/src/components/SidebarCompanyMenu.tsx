import { useState, type ReactNode } from 'react'

export interface CompanyMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

/** Sidebar footer company-card with a pop-up account menu (design-v2 `.wfp-sb-user--menu` +
 * `.wfp-sb-rolemenu`). Fixes the prior bug where the whole card logged the user out — logout is
 * now one explicit item. Active-company switching needs a backend endpoint (none yet → S6). */
export function SidebarCompanyMenu({
  companyName,
  roleLabel,
  items,
}: {
  companyName: string
  roleLabel: string
  items: CompanyMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const initial = companyName.trim().slice(0, 1).toUpperCase() || 'W'

  return (
    <div className="wfp-sb-foot">
      <div className="wfp-sb-user wfp-sb-user--menu">
        <button
          type="button"
          className="wfp-sb-user-btn"
          onClick={() => setOpen((v) => !v)}
          data-open={open || undefined}
          title="Акаунт компанії"
        >
          <div className="wfp-sb-user-av">{initial}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div className="wfp-sb-user-name">{companyName}</div>
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
