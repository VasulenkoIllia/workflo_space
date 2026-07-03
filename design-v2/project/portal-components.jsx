// portal-components.jsx — shared building blocks for Portal screens
// "Single source of truth" for reusable patterns: header, stats, tabs, file rows,
// empty state, tier badge, upload zone, etc.
//
// Each component is small and renders ONE thing. Compose them in screens.

// ──────────────────────────────────────────────────────────────────────
// Page header — title + subtitle + optional actions
// ──────────────────────────────────────────────────────────────────────
function PageHeader({ title, subtitle, children }) {
  return (
    <div className="wfp-ph">
      <div className="wfp-ph-l">
        <h1 className="wfp-ph-h1">{title}</h1>
        {subtitle && <div className="wfp-ph-sub">{subtitle}</div>}
      </div>
      {children && <div className="wfp-ph-r">{children}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Stats row — N cards with k/v/sub
// ──────────────────────────────────────────────────────────────────────
function StatsRow({ children, cols }) {
  const n = React.Children.count(children);
  return (
    <div className="wfp-stats" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : { gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      {children}
    </div>
  );
}
function Stat({ k, v, sub, kind = 'default' }) {
  const cls = kind === 'accent' ? ' wfp-stat-v--accent'
            : kind === 'warn'   ? ' wfp-stat-v--warn'
            : kind === 'danger' ? ' wfp-stat-v--danger'
            : '';
  return (
    <div className="wfp-stat">
      <div className="wfp-stat-k">{k}</div>
      <div className={`wfp-stat-v${cls}`}>{v}</div>
      {sub && <div className="wfp-stat-sub">{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tabs — controlled or uncontrolled
// items: [{ id, label, badge? }]
// ──────────────────────────────────────────────────────────────────────
function Tabs({ items, value, onChange, right }) {
  const [internal, setInternal] = React.useState(items[0]?.id);
  const v = value !== undefined ? value : internal;
  const set = onChange || setInternal;
  return (
    <div className="wfp-od-tabs">
      {items.map((it) => (
        <div
          key={it.id}
          className="wfp-od-tab"
          data-on={v === it.id || undefined}
          onClick={() => set(it.id)}
        >
          {it.label}
          {it.badge !== undefined && it.badge !== null && <span className="wfp-od-tab-badge">{it.badge}</span>}
        </div>
      ))}
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// File row — for Files tab
// ──────────────────────────────────────────────────────────────────────
function FileRow({ ext, name, size, by, date, isOwn, preview }) {
  const colorByExt = {
    PDF: 'var(--wf-destructive)', DOC: 'var(--wf-accent)', XLS: 'var(--wf-success)',
    PNG: 'var(--wf-warning)',     JPG: 'var(--wf-warning)', ZIP: 'var(--wf-fg-muted)',
    TXT: 'var(--wf-fg-muted)',    CSV: 'var(--wf-success)',
  };
  return (
    <div className="wfp-file-row">
      <div className="wfp-file-icon" style={{ color: colorByExt[ext] || 'var(--wf-fg)' }}>
        {ext}
      </div>
      <div className="wfp-file-meta">
        <div className="wfp-file-name">{name}</div>
        <div className="wfp-file-sub">
          <span>{size}</span>
          <span>·</span>
          <span>{isOwn ? 'ви' : <span style={{ color: 'var(--wf-accent)' }}>{by}</span>}</span>
          <span>·</span>
          <span>{date}</span>
        </div>
      </div>
      <div className="wfp-file-actions">
        {preview && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="external" size={11} />Preview</button>}
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="download" size={11} />Download</button>
        {isOwn && <button className="wfp-iconbtn" style={{ width: 28, height: 28, color: 'var(--wf-fg-muted)' }} title="Видалити" onClick={() => window.wfToast && window.wfToast('Видалити · демо', 'ok')}><Icon name="alert" size={12} /></button>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Upload zone
// ──────────────────────────────────────────────────────────────────────
function UploadZone({ hint }) {
  return (
    <div className="wfp-upload">
      <div className="wfp-upload-glyph"><Icon name="paperclip" size={20} /></div>
      <div>
        <div className="wfp-upload-t">Перетягніть файли сюди або <span style={{ color: 'var(--wf-accent)', textDecoration: 'underline dashed', textUnderlineOffset: 3 }}>оберіть з диску</span></div>
        <div className="wfp-upload-sub">{hint || 'PDF, DOC, XLS, PNG, ZIP · до 25 МБ'}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Document row — for Documents tab (compact)
// ──────────────────────────────────────────────────────────────────────
function PortalDocRow({ type, num, date, amount, status }) {
  const types = window.WFP_DATA.doc_types;
  const t = types[type] || { code: '???', label: type, color: 'var(--wf-fg)' };
  const statusLabel = {
    draft:   'чернетка',
    sent:    'надіслано',
    signed:  'підписано',
    paid:    'оплачено',
    partial: 'частково',
  }[status] || status;
  const statusKind = (status === 'paid' || status === 'signed') ? 'paid'
                  : (status === 'sent' || status === 'partial') ? 'partial'
                  : 'soft';
  return (
    <div className="wfp-portal-doc-row">
      <span className="wfp-doc-type-pill" data-t={type}>{t.code}</span>
      <div className="wfp-portal-doc-meta">
        <div className="wfp-portal-doc-name">{t.label} · <span className="wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{num}</span></div>
        <div className="wfp-portal-doc-sub">
          <span>{date}</span>
          {amount != null && <><span>·</span><span style={{ color: 'var(--wf-fg)', fontWeight: 500 }}>${amount.toLocaleString('uk-UA')}</span></>}
          <span>·</span>
          <span className={`wfp-badge wfp-badge--${statusKind}`}>{statusLabel}</span>
        </div>
      </div>
      <div className="wfp-file-actions">
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Open · демо', 'ok')}><Icon name="external" size={11} />Open</button>
        <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={11} />PDF</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tier badge
// ──────────────────────────────────────────────────────────────────────
function TierBadge({ tier, size = 'sm' }) {
  const tiers = window.WFP_DATA.tiers;
  const t = tiers[tier] || tiers.new;
  return (
    <span className="wfp-tier-badge" data-size={size} style={{ '--tier-color': t.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tier-color)' }} />
      <span>{t.label}</span>
      <span style={{ color: 'var(--wf-fg-muted)' }}>· −{t.discount}</span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Filter bar wrapper
// ──────────────────────────────────────────────────────────────────────
function FilterBar({ search, searchPlaceholder, children }) {
  return (
    <div className="wfp-filters">
      {search && (
        <div className="wfp-search">
          <Icon name="search" size={14} color="var(--wf-fg-muted)" />
          <input placeholder={searchPlaceholder || 'Шукати…'} />
          <span className="wfp-search-kbd">⌘K</span>
        </div>
      )}
      {children}
    </div>
  );
}

Object.assign(window, {
  PageHeader, StatsRow, Stat, Tabs, FileRow, UploadZone, PortalDocRow, TierBadge, FilterBar,
});
