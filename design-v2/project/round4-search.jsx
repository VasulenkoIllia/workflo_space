// round4-search.jsx — G15 · Full search results page (/search).
// Two-column: facets (entity / period / status / executor / client / tags) +
// grouped results with highlighted matches, per-group load-more, empty state,
// saved-filter slot. Query + facets reflected in a faux URL bar.

const _sr = React.useState;

const SR_DATA = {
  orders: { icon: 'kanban', label: 'Замовлення', rows: [
    { t: 'ORD-2412 · Інтеграція 1С ↔ Telegram-бот', s: 'ТОВ «Брунки» · в роботі', hl: 'бот' },
    { t: 'ORD-2419 · API синхронізації складу', s: 'EduForge · рев’ю', hl: 'синхрон' },
    { t: 'ORD-2421 · Міграція БД на Postgres', s: 'ТОВ «Брунки» · у черзі', hl: '' },
  ], total: 7 },
  companies: { icon: 'building', label: 'Клієнти', rows: [
    { t: 'ТОВ «Брунки»', s: 'silver · оборот $18 400 · активність 2 дні тому', hl: 'брунки' },
    { t: 'EduForge', s: 'partner · оборот $41 200 · сьогодні', hl: '' },
  ], total: 2 },
  docs: { icon: 'file', label: 'Документи', rows: [
    { t: 'SPC-2025-0418 · Специфікація', s: 'ORD-2412 · підписано', hl: '' },
    { t: 'INV-2025-0418 · Рахунок', s: 'ORD-2412 · надіслано · $4 200', hl: '' },
  ], total: 5 },
  blog: { icon: 'edit', label: 'Блог', rows: [
    { t: 'Як ми автоматизували облік для Брунки', s: 'кейс · 24.04.2026', hl: 'автоматиз' },
  ], total: 1 },
  files: { icon: 'paperclip', label: 'Файли', rows: [
    { t: 'tg-bot-setup.md', s: 'ORD-2412 · 4 КБ · 28.05', hl: 'бот' },
  ], total: 3 },
};

function hl(text, term) {
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  return <React.Fragment>{text.slice(0, i)}<mark style={{ background: 'var(--wf-accent-soft)', color: 'var(--wf-fg)', borderRadius: 3, padding: '0 2px' }}>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</React.Fragment>;
}

function SrFacet({ label, items, sel, onToggle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="r4-subhead" style={{ margin: '0 0 10px' }}><span className="r4-subhead-t">{label}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((it) => (
          <label key={it.id} className="r4-scope" data-on={sel.includes(it.id) || undefined} style={{ padding: '7px 10px' }} onClick={(e) => { e.preventDefault(); onToggle(it.id); }}>
            <span className="r4-checkbox" data-on={sel.includes(it.id) || undefined}><Icon name="check" size={11} /></span>
            <span className="r4-scope-t" style={{ flex: 1 }}>{it.label}</span>
            {it.count != null && <span className="r4-scope-c">{it.count}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

function R4Search() {
  const [q, setQ] = _sr('бот');
  const [entities, setEntities] = _sr(['orders', 'companies', 'docs', 'blog', 'files']);
  const [period, setPeriod] = _sr([]);
  const [status, setStatus] = _sr([]);
  const tog = (set, fn) => (id) => fn(set.includes(id) ? set.filter((x) => x !== id) : [...set, id]);

  const empty = q.trim().toLowerCase() === 'нічого';
  const groups = Object.keys(SR_DATA).filter((k) => entities.includes(k));

  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Пошук</h1><div className="wfp-ph-sub">// глобальний пошук з фасетами · /search?q=…</div></div>
        <div className="wfp-ph-r"><button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Зберегти фільтр · демо', 'ok')}><Icon name="star" size={13} />Зберегти фільтр</button></div>
      </div>

      <div className="r4-copyfield" style={{ marginBottom: 8 }}><Icon name="globe" size={13} /><input readOnly value={`workflo.space/search?q=${encodeURIComponent(q)}&type=${entities.join(',')}${status.length ? '&status=' + status.join(',') : ''}`} /></div>
      <div className="wfp-search" style={{ marginBottom: 20 }}><Icon name="search" size={15} color="var(--wf-fg-muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Шукати скрізь…" /><span className="wfp-search-kbd">↵</span></div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 0 }}>
          <SrFacet label="тип" sel={entities} onToggle={tog(entities, setEntities)} items={[
            { id: 'orders', label: 'Замовлення', count: 7 }, { id: 'companies', label: 'Клієнти', count: 2 },
            { id: 'docs', label: 'Документи', count: 5 }, { id: 'blog', label: 'Блог', count: 1 }, { id: 'files', label: 'Файли', count: 3 },
          ]} />
          <SrFacet label="період" sel={period} onToggle={tog(period, setPeriod)} items={[{ id: '7d', label: '7 днів' }, { id: '30d', label: '30 днів' }, { id: 'q', label: 'квартал' }]} />
          <SrFacet label="статус" sel={status} onToggle={tog(status, setStatus)} items={[{ id: 'active', label: 'активні' }, { id: 'done', label: 'завершені' }, { id: 'overdue', label: 'прострочені' }]} />
        </div>

        <div>
          {empty ? (
            <div className="wfm-empty" style={{ padding: '60px 20px', color: 'var(--wf-fg-muted)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-fg-subtle)' }}>{`[ ∅ ]`}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--wf-fg)' }}>Нічого не знайдено</div>
              <div style={{ fontSize: 13, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>Спробуйте інакше — напр. <button className="wfp-link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setQ('уточнення')}>«уточнення»</button> · <button className="wfp-link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setQ('бот')}>«бот»</button> (часті запити)</div>
            </div>
          ) : groups.map((k) => {
            const g = SR_DATA[k];
            return (
              <div key={k} style={{ marginBottom: 26 }}>
                <div className="r4-subhead" style={{ margin: '0 0 10px' }}>
                  <span className="r4-subhead-t" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--wf-fg)' }}><Icon name={g.icon} size={14} color="var(--wf-fg-muted)" />{g.label}<span className="r4-tab-count">{g.total}</span></span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.rows.map((r, i) => (
                    <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--wf-border)', borderRadius: 10, background: 'var(--wf-surface)' }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{hl(r.t, q)}</div>
                      <div className="r4-note" style={{ marginTop: 3 }}>{r.s}</div>
                    </div>
                  ))}
                </div>
                {g.total > g.rows.length && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ marginTop: 10 }}>Показати ще {g.total - g.rows.length}</button>}
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { R4Search });
