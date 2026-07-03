// eco-nav.jsx — shared ecosystem top nav. One bar on every surface so the
// landing, portal, workspace, documents and brandbook all read as one product.
//
// Tabs that live on the CURRENT page (passed via `localTabs`) switch in-page
// through `onSelect`; the rest are real links to the other HTML surfaces.
// Exported to window so both app.jsx (landing) and product-app.jsx (product)
// can use the exact same component.

const ECO_TABS = [
  { id: 'landing',   label: 'landing',   href: 'workflo-landing.html',            sub: 'публічний сайт · термінал' },
  { id: 'portal',    label: 'portal',    href: 'workflo-product.html?tab=portal',    sub: 'клієнти · мульти-компанія' },
  { id: 'workspace', label: 'workspace', href: 'workflo-product.html?tab=workspace', sub: 'команда · owner + executors' },
  { id: 'documents', label: 'documents', href: 'workflo-product.html?tab=documents', sub: 'pdf · invoice · акти' },
  { id: 'brandbook', label: 'brandbook', href: 'workflo-product.html?tab=brandbook', sub: 'єдина дизайн-система' },
];

function EcoNav({ active, theme = 'light', accent = 'lime', localTabs = [], onSelect }) {
  const aux = ECO_TABS.find((t) => t.id === active)?.sub || '';
  return (
    <nav className="eco-nav wf-root" data-theme={theme} data-accent={accent}>
      <span className="eco-nav-mark">
        <a className="eco-nav-mark-name" href="workflo-landing.html">
          workflo<span className="eco-dot">.</span>space
        </a>
        <span className="eco-nav-mark-sub">/ ecosystem</span>
      </span>

      <span className="eco-nav-tabs">
        {ECO_TABS.map((t) => {
          const on = active === t.id;
          const isLocal = localTabs.includes(t.id);
          if (isLocal) {
            return (
              <button
                key={t.id}
                className="eco-tab"
                data-on={on || undefined}
                onClick={() => onSelect && onSelect(t.id)}
                type="button"
              >
                {t.label}
              </button>
            );
          }
          return (
            <a key={t.id} className="eco-tab" data-on={on || undefined} href={t.href}>
              {t.label}
            </a>
          );
        })}
      </span>

      <span className="eco-nav-aux">// {aux}</span>
    </nav>
  );
}

Object.assign(window, { EcoNav, ECO_TABS });
