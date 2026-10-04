// avatar-icons.jsx — thematic glyph avatars for workflo.space.
// Family 1: team ROLES (executors). Family 2: CLIENT / industry types.
// Lucide-style 1.6px-stroke glyphs, terminal-mono tiles, curated oklch tints.
//
// <WfAvatar kind="developer" size="lg" shape="tile" fill="soft" status="online" />
// Catalog + usage demos exported for the brandbook.

const WFA_GLYPHS = {
  // ── team roles ──
  designer:   <path d="M12 19l7-7a2.8 2.8 0 0 0-4-4l-7 7-1.5 5.5L12 19zM14 6l4 4M5 21c0-2 1.5-3.5 3.5-3.5" />,
  developer:  <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12" />,
  devops:     (<><path d="M6 8a3 3 0 1 0 0 6c1 2.5 3.2 4 6 4s5-1.5 6-4a3 3 0 1 0 0-6c-1-2.5-3.2-4-6-4" /><path d="M9 11l2 2 4-4" /></>),
  lead:       (<><path d="M4 21V4l9 3 7-2v11l-7 2-9-3z" /><path d="M4 4v17" /></>),
  pm:         (<><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="10" rx="1" /></>),
  qa:         (<><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 4h6M8 13l2.5 2.5L16 10M9 4v3M15 4v3" /></>),
  copywriter: (<><path d="M5 20V5a1 1 0 0 1 1-1h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M14 4v4h4M8 12h8M8 16h5" /></>),
  analyst:    (<><path d="M4 4v16h16" /><path d="M8 14l3-4 3 2 4-6" /></>),
  ai:         (<><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M12 8l1 2.2 2.2 1-2.2 1L12 14.5l-1-2.3-2.2-1 2.2-1L12 8z" /><path d="M2 10v4M22 10v4M10 2h4M10 22h4" /></>),
  mobile:     (<><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>),
  support:    (<><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><path d="M4 13a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2zM20 13a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2zM18 18v1a3 3 0 0 1-3 3h-3" /></>),
  data:       (<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" /></>),

  // ── client / industry types ──
  logistics:   (<><path d="M14 17V6H3v11h11zM14 9h4l3 3.5V17h-7M6.5 20a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17.5 20a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" /></>),
  retail:      (<><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8a3 3 0 0 1 6 0" /></>),
  manufacture: (<><path d="M3 21V10l6 4V10l6 4V7l3-3v17H3z" /><path d="M3 21h18" /></>),
  food:        (<><path d="M7 3v8a2 2 0 0 0 4 0V3M9 3v18M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5zM17 12v9" /></>),
  agency:      (<><path d="M4 10v4h4l6 4V6l-6 4H4z" /><path d="M18 9a3 3 0 0 1 0 6M20.5 7a6 6 0 0 1 0 10" /></>),
  fintech:     (<><circle cx="9" cy="9" r="6" /><path d="M14.5 6.5A6 6 0 1 1 9.5 17M7.5 6.5h2.2a1.8 1.8 0 0 1 0 3.6H7.5v3" /></>),
  saas:        (<><path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 18H7z" /><path d="M10 15l2-2 2 2M12 13v5" /></>),
  construction:(<><path d="M3 18h18v3H3zM4 18v-3a8 8 0 0 1 16 0v3" /><path d="M12 7V4M9 4h6" /></>),
  health:      (<><path d="M4 8a4 4 0 0 1 8 0c0 4-4 7-4 7s-4-3-4-7z" opacity="0" /><path d="M10 4h4v4h4v4h-4v4h-4v-4H6V8h4V4z" /></>),
  education:   (<><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5M21 8v6" /></>),
  startup:     (<><path d="M12 3c3 1.5 5 5 5 9l-2 4H9l-2-4c0-4 2-7.5 5-9z" /><circle cx="12" cy="9" r="1.6" /><path d="M9 19l-1.5 2M15 19l1.5 2" /></>),
  user:        (<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>),
};

// role → default tint + human label
const WFA_ROLE_META = {
  designer:   { tint: 'violet', label: 'Дизайнер',   id: 'designer' },
  developer:  { tint: 'lime',   label: 'Розробник',  id: 'developer' },
  devops:     { tint: 'ocean',  label: 'DevOps',     id: 'devops' },
  lead:       { tint: 'amber',  label: 'Тімлід',     id: 'lead' },
  pm:         { tint: 'ink',    label: 'Проджект',   id: 'pm' },
  qa:         { tint: 'teal',   label: 'QA',         id: 'qa' },
  copywriter: { tint: 'rose',   label: 'Копірайтер', id: 'copywriter' },
  analyst:    { tint: 'ocean',  label: 'Аналітик',   id: 'analyst' },
  ai:         { tint: 'lime',   label: 'AI-інженер', id: 'ai' },
  mobile:     { tint: 'teal',   label: 'Mobile',     id: 'mobile' },
  support:    { tint: 'amber',  label: 'Підтримка',  id: 'support' },
  data:       { tint: 'violet', label: 'Data',       id: 'data' },
};

const WFA_CLIENT_META = {
  logistics:    { tint: 'amber',  label: 'Логістика',    id: 'logistics' },
  retail:       { tint: 'rose',   label: 'Рітейл',       id: 'retail' },
  manufacture:  { tint: 'ink',    label: 'Виробництво',  id: 'manufacture' },
  food:         { tint: 'amber',  label: 'Food & HoReCa', id: 'food' },
  agency:       { tint: 'violet', label: 'Агенція',      id: 'agency' },
  fintech:      { tint: 'teal',   label: 'Fintech',      id: 'fintech' },
  saas:         { tint: 'ocean',  label: 'SaaS / IT',    id: 'saas' },
  construction: { tint: 'sand',   label: 'Будівництво',  id: 'construction' },
  health:       { tint: 'rose',   label: 'Медицина',     id: 'health' },
  education:    { tint: 'ocean',  label: 'Освіта',       id: 'education' },
  startup:      { tint: 'lime',   label: 'Стартап',      id: 'startup' },
};

// ── the avatar itself ──
function WfAvatar({ kind, tint, size = 'md', shape = 'tile', fill = 'soft', bracket = false, status }) {
  const meta = WFA_ROLE_META[kind] || WFA_CLIENT_META[kind] || {};
  const t = tint || meta.tint || 'ink';
  const glyph = WFA_GLYPHS[kind];
  return (
    <span
      className="wfa"
      data-tint={t}
      data-shape={shape === 'circle' ? 'circle' : undefined}
      data-size={size !== 'md' ? size : undefined}
      data-fill={fill === 'solid' ? 'solid' : undefined}
      data-bracket={bracket || undefined}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {glyph}
      </svg>
      {status && <span className="wfa-status" data-on={status} />}
    </span>
  );
}

// ── brandbook catalog ──
function AvatarCatalog() {
  const roles = Object.keys(WFA_ROLE_META);
  const clients = Object.keys(WFA_CLIENT_META);
  return (
    <div className="wfa-cat">
      {/* roles */}
      <div>
        <div className="wfa-cat-group-h"><strong>Команда · ролі</strong> <span>// тематичні аватарки виконавців · tile · soft fill</span></div>
        <div className="wfa-grid">
          {roles.map((k) => (
            <div className="wfa-cell" key={k}>
              <WfAvatar kind={k} size="lg" bracket />
              <div>
                <div className="wfa-cell-label">{WFA_ROLE_META[k].label}</div>
                <div className="wfa-cell-id">avatar:{k}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* clients */}
      <div>
        <div className="wfa-cat-group-h"><strong>Клієнти · галузі</strong> <span>// аватарки компаній за індустрією · circle · soft fill</span></div>
        <div className="wfa-grid">
          {clients.map((k) => (
            <div className="wfa-cell" key={k}>
              <WfAvatar kind={k} size="lg" shape="circle" />
              <div>
                <div className="wfa-cell-label">{WFA_CLIENT_META[k].label}</div>
                <div className="wfa-cell-id">avatar:{k}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* shapes + fills + sizes */}
      <div>
        <div className="wfa-cat-group-h"><strong>Варіанти</strong> <span>// shape · fill · size · status · bracket</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-end' }}>
          <div className="wfa-cell" style={{ flexDirection: 'row', gap: 14, padding: '16px 20px' }}>
            <WfAvatar kind="developer" size="xs" />
            <WfAvatar kind="developer" size="sm" />
            <WfAvatar kind="developer" size="md" />
            <WfAvatar kind="developer" size="lg" />
            <WfAvatar kind="developer" size="xl" />
            <span className="wfa-cell-id">size · xs → xl</span>
          </div>
          <div className="wfa-cell" style={{ flexDirection: 'row', gap: 14, padding: '16px 20px' }}>
            <WfAvatar kind="ai" size="lg" fill="soft" />
            <WfAvatar kind="ai" size="lg" fill="solid" />
            <WfAvatar kind="ai" size="lg" shape="circle" fill="solid" />
            <span className="wfa-cell-id">fill · soft / solid</span>
          </div>
          <div className="wfa-cell" style={{ flexDirection: 'row', gap: 14, padding: '16px 20px' }}>
            <WfAvatar kind="lead" size="lg" status="online" />
            <WfAvatar kind="designer" size="lg" status="busy" />
            <WfAvatar kind="qa" size="lg" status="off" />
            <span className="wfa-cell-id">status · online/busy/off</span>
          </div>
        </div>
      </div>

      {/* usage — as it appears in product */}
      <div>
        <div className="wfa-cat-group-h"><strong>У контексті</strong> <span>// рядок команди й клієнта</span></div>
        <div className="wfa-use">
          <div className="wfa-use-row">
            <WfAvatar kind="developer" size="sm" fill="solid" status="online" />
            <div><div className="wfa-use-name">Ілля Когут</div><div className="wfa-use-role">// fullstack · developer</div></div>
            <span className="wfa-use-tag">owner</span>
          </div>
          <div className="wfa-use-row">
            <WfAvatar kind="designer" size="sm" status="busy" />
            <div><div className="wfa-use-name">Олег Шевчук</div><div className="wfa-use-role">// product · designer</div></div>
            <span className="wfa-use-tag">executor</span>
          </div>
          <div className="wfa-use-row">
            <WfAvatar kind="logistics" size="sm" shape="circle" />
            <div><div className="wfa-use-name">NordStream Logistics</div><div className="wfa-use-role">// логістика · partner tier</div></div>
            <span className="wfa-use-tag">client</span>
          </div>
          <div className="wfa-use-row">
            <WfAvatar kind="food" size="sm" shape="circle" />
            <div><div className="wfa-use-name">Brunky</div><div className="wfa-use-role">// food & horeca · partner tier</div></div>
            <span className="wfa-use-tag">client</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WfAvatar, AvatarCatalog, WFA_GLYPHS, WFA_ROLE_META, WFA_CLIENT_META });

// ── mapping helpers: map product data → avatar kind ──
// per-person specialty override (clearer than dept alone)
const WFA_PERSON_KIND = {
  illia: 'developer', pavlo: 'devops', oleh: 'designer',
  maria: 'designer', anna: 'copywriter', denys: 'developer',
};
const WFA_DEPT_KIND = { dev: 'developer', automation: 'devops', design: 'designer', content: 'copywriter', qa: 'qa', ai: 'ai' };

function wfAvatarKindForMember(m) {
  if (!m) return 'developer';
  if (WFA_PERSON_KIND[m.id]) return WFA_PERSON_KIND[m.id];
  const d = (m.departments && m.departments[0]) || '';
  return WFA_DEPT_KIND[d] || 'developer';
}

// map a free-text industry string → client avatar kind
function wfAvatarKindForIndustry(industry) {
  const s = String(industry || '').toLowerCase();
  if (/логіст|logist|trasa|truck/.test(s)) return 'logistics';
  if (/food|horeca|рестор|їж|brunky/.test(s)) return 'food';
  if (/retail|рітейл|shop|магаз|aqualife/.test(s)) return 'retail';
  if (/saas|b2b|it|software/.test(s)) return 'saas';
  if (/fintech|фінанс|банк|pay/.test(s)) return 'fintech';
  if (/edtech|освіт|educat|навч/.test(s)) return 'education';
  if (/hr|рекрут|tably/.test(s)) return 'saas';
  if (/health|медиц|клін/.test(s)) return 'health';
  if (/build|будів|констр/.test(s)) return 'construction';
  if (/manufact|виробн|завод/.test(s)) return 'manufacture';
  return 'startup';
}

Object.assign(window, { wfAvatarKindForMember, wfAvatarKindForIndustry, WFA_PERSON_KIND });
