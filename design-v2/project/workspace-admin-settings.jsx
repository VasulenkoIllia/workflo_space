// workspace-admin-settings.jsx — G5 · Admin Settings (owner-only, per-agency):
//   AdminTemplates · AdminSmtp · AdminBranding · AdminNomenclature · AdminCrons
// Reuses PageHeader/StatsRow/Stat/Icon + the wfp-rep-tabs sub-nav pattern.

const ADMIN_SETTINGS_NAV = [
  { id: 'templates',    label: 'Шаблони листів', icon: 'mail' },
  { id: 'smtp',         label: 'SMTP',           icon: 'globe' },
  { id: 'branding',     label: 'Брендинг PDF',   icon: 'file' },
  { id: 'nomenclature', label: 'Номенклатура',   icon: 'kanban' },
  { id: 'crons',        label: 'Крони',          icon: 'clock' },
];

function AdminSettingsTabs({ active }) {
  return (
    <div className="wfp-rep-tabs">
      {ADMIN_SETTINGS_NAV.map((t) => (
        <span key={t.id} className="wfp-rep-tab" data-on={t.id === active || undefined} style={{ cursor: 'pointer' }} onClick={() => window.__adminSetNav && window.__adminSetNav(t.id)}>
          <Icon name={t.icon} size={13} />{t.label}
        </span>
      ))}
    </div>
  );
}

// highlight {{variables}} in a string
function withVars(str) {
  const parts = String(str).split(/(\{\{[^}]+\}\})/g);
  return parts.map((p, i) => /^\{\{.+\}\}$/.test(p) ? <span className="wfas-var" key={i}>{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>);
}

// ───────────── /admin/templates ─────────────
function AdminTemplates() {
  const d = window.WFP_ADMIN_TEMPLATES;
  const e = d.editor;
  return (
    <React.Fragment>
      <PageHeader title="Адмін · Шаблони листів" subtitle="// per-agency · event × channel × locale · {{variables}}">
        <button className="wfp-btn"><Icon name="globe" size={13} />UA / EN</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий шаблон · демо', 'ok')}><Icon name="plus" size={13} />Новий шаблон</button>
      </PageHeader>
      <AdminSettingsTabs active="templates" />

      <StatsRow>
        <Stat k="усього шаблонів" v={d.stats.total} sub="event × channel" />
        <Stat k="кастомізовано" v={d.stats.customised} kind="accent" sub="решта — дефолти" />
        <Stat k="локалі" v="UA · EN" sub="дві мови" />
        <Stat k="канали" v="email · tg" sub="+ push (скоро)" />
      </StatsRow>

      <table className="wfp-table" style={{ marginTop: 14 }}>
        <thead><tr><th style={{ width: '34%' }}>Подія</th><th>Канал</th><th>Locale</th><th>Тема</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.id}>
              <td className="wfp-mono">{r.event}</td>
              <td>{r.channel}</td>
              <td className="wfp-mono">{r.locale}</td>
              <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{withVars(r.subject)}</td>
              <td><span className="wfas-status-pill" data-s={r.status === 'custom' ? 'ok' : 'untested'}><span className="wfas-dot" data-s={r.status} />{r.status === 'custom' ? 'кастом' : 'дефолт'}</span></td>
              <td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Редагувати · демо', 'ok')}><Icon name="edit" size={12} />Редагувати</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* editor */}
      <div style={{ marginTop: 22, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>// редактор · {e.name}</div>
      <div className="wfas-tpl-editor">
        <div className="wfas-tpl-pane">
          <div className="wfas-tpl-pane-h"><Icon name="edit" size={13} /><span>шаблон</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Send test · демо', 'ok')}>Send test</button>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Restore default · демо', 'ok')}>Restore default</button>
            </div>
          </div>
          <div className="wfas-tpl-subject"><span style={{ color: 'var(--wf-fg-muted)' }}>Subject: </span>{withVars(e.subject)}</div>
          <pre className="wfas-tpl-src">{e.body.split('\n').map((ln, i) => <div key={i}>{withVars(ln) }{'\n'}</div>)}</pre>
          <div className="wfas-tpl-vars">
            {e.variables.map((v) => <span className="wfas-tpl-var-chip" key={v}>{`{{${v}}}`}</span>)}
          </div>
        </div>
        <div className="wfas-tpl-pane">
          <div className="wfas-tpl-pane-h"><Icon name="eye" size={13} /><span>прев'ю (реальні дані)</span></div>
          <div className="wfas-tpl-preview">
            <div className="wfm-email" style={{ maxWidth: 'none' }}>
              <div className="wfm-head"><span className="wfm-wordmark">workflo<span className="dot">.</span>space</span><span className="wfm-head-tag">// invoice</span></div>
              <div className="wfm-hero"><div className="wfm-hero-eyebrow"><span className="dot" /> новий рахунок</div><h1 className="wfm-hero-h1">Рахунок на $4 200</h1><div className="wfm-hero-sub">За замовленням ORD-2412 · до 05.06.2026</div></div>
              <div className="wfm-body">
                <div className="wfm-cta-wrap"><a className="wfm-cta" data-kind="accent" href="#">Оплатити рахунок →</a></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ───────────── /admin/smtp ─────────────
function AdminSmtp() {
  const d = window.WFP_ADMIN_SMTP;
  return (
    <React.Fragment>
      <PageHeader title="Адмін · SMTP-відправники" subtitle="// сервери розсилки · статус · тест зʼєднання · мапінг подій">
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Додати відправника · демо', 'ok')}><Icon name="plus" size={13} />Додати відправника</button>
      </PageHeader>
      <AdminSettingsTabs active="smtp" />

      <StatsRow>
        <Stat k="відправників" v={d.senders.length} sub="налаштовано" />
        <Stat k="OK" v={d.senders.filter((s) => s.status === 'ok').length} kind="accent" sub="протестовано" />
        <Stat k="помилки" v={d.senders.filter((s) => s.status === 'fail').length} kind="warn" sub="потребують уваги" />
        <Stat k="не тестовано" v={d.senders.filter((s) => s.status === 'untested').length} sub="запустіть тест" />
      </StatsRow>

      <div style={{ marginTop: 14 }}>
        {d.senders.map((s) => (
          <div className="wfas-card wfas-smtp-card" key={s.id}>
            <div>
              <div className="wfas-smtp-name"><span className="wfas-dot" data-s={s.status} />{s.name} <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, fontWeight: 400, color: 'var(--wf-fg-muted)' }}>{s.from}</span></div>
              <div className="wfas-smtp-meta"><span>{s.host}:{s.port}</span><span>· {s.enc}</span><span>· {s.events} подій</span><span>· тест: {s.lastTest}</span></div>
              {s.error && <div className="wfas-smtp-err">⚠ {s.error}</div>}
            </div>
            <div className="wfas-smtp-right">
              <span className="wfas-status-pill" data-s={s.status}>{s.status === 'ok' ? '✓ OK' : s.status === 'fail' ? '✗ FAIL' : 'UNTESTED'}</span>
              <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Test · демо', 'ok')}>Test</button>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="edit" size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>// мапінг: подія → відправник</div>
      <table className="wfp-table" style={{ marginTop: 10 }}>
        <thead><tr><th>Тип події</th><th>Відправник</th><th></th></tr></thead>
        <tbody>
          {d.mapping.map((m, i) => (
            <tr key={i}><td className="wfp-mono">{m.event}</td><td>{m.sender}</td><td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Змінити · демо', 'ok')}>Змінити</button></td></tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── /admin/branding ─────────────
function AdminBranding() {
  const b = window.WFP_ADMIN_BRANDING;
  return (
    <React.Fragment>
      <PageHeader title="Адмін · Брендинг документів" subtitle="// лого · акцент · шрифт для PDF (рахунки, акти, специфікації)">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Завантажити приклад · демо', 'ok')}><Icon name="download" size={13} />Завантажити приклад</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}><Icon name="check" size={13} />Зберегти</button>
      </PageHeader>
      <AdminSettingsTabs active="branding" />

      <div className="wfas-brand" style={{ marginTop: 16 }}>
        <div className="wfas-brand-form">
          <div className="wfas-brand-field">
            <span className="wfas-brand-label">// лого</span>
            <div className="wfas-logo-drop">
              <span className="wfas-logo-drop-mark">workflo<span className="dot">.</span>space</span>
              <span className="wfas-logo-drop-hint">перетягніть SVG/PNG · або клік</span>
            </div>
          </div>
          <div className="wfas-brand-field">
            <span className="wfas-brand-label">// акцент</span>
            <div className="wfas-swatches">
              {b.accentOptions.map((c) => <span key={c} className="wfas-swatch" data-on={c === b.accent || undefined} style={{ background: c }} />)}
            </div>
          </div>
          <div className="wfas-brand-field">
            <span className="wfas-brand-label">// шрифт</span>
            <div className="wfas-seg">
              {b.fontOptions.map((f) => <span key={f} className="wfas-seg-opt" data-on={f === b.font || undefined}>{f}</span>)}
            </div>
          </div>
          <div className="wfas-brand-field">
            <span className="wfas-brand-label">// стиль wordmark</span>
            <div className="wfas-seg">
              {b.wordmarkOptions.map((w) => <span key={w} className="wfas-seg-opt" data-on={w === b.wordmark || undefined}>{w}</span>)}
            </div>
          </div>
          <div className="wfas-brand-field">
            <span className="wfas-brand-label">// QR на оплату</span>
            <div className="wfas-seg"><span className="wfas-seg-opt" data-on={b.showQr || undefined}>увімк</span><span className="wfas-seg-opt" data-on={!b.showQr || undefined}>вимк</span></div>
          </div>
        </div>

        {/* live PDF preview */}
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)', marginBottom: 10 }}>// live прев'ю · invoice.pdf</div>
          <div className="wfas-pdf" style={{ '--wfas-pdf-accent': b.accent }}>
            <div className="wfas-pdf-head">
              <span className="wfas-pdf-mark">workflo<span className="dot">.</span>space</span>
              <span className="wfas-pdf-meta">РАХУНОК INV-2025-0418<br />28.05.2026<br />ФОП Когут І.</span>
            </div>
            <div className="wfas-pdf-body">
              <div className="wfas-pdf-h1">Рахунок на оплату</div>
              <div className="wfas-pdf-sub">Замовник: ТОВ «Брунки» · ORD-2412</div>
              <table className="wfas-pdf-table">
                <thead><tr><th>Опис</th><th style={{ textAlign: 'right' }}>К-сть</th><th style={{ textAlign: 'right' }}>Сума</th></tr></thead>
                <tbody>
                  <tr><td>CRM-воронки + інтеграція 1С (етап 1)</td><td style={{ textAlign: 'right' }}>1</td><td style={{ textAlign: 'right' }}>$3 200</td></tr>
                  <tr><td>Telegram-бот для водіїв</td><td style={{ textAlign: 'right' }}>1</td><td style={{ textAlign: 'right' }}>$1 000</td></tr>
                </tbody>
              </table>
              <div className="wfas-pdf-total"><span style={{ color: '#78716C' }}>Разом:</span><span className="wfas-pdf-total-v">$4 200</span></div>
            </div>
            <div className="wfas-pdf-foot"><span>{b.footer}</span>{b.showQr && <span className="wfas-pdf-qr" />}</div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ───────────── /admin/nomenclature ─────────────
const NOM_CAT = { dev: 'Розробка', ai: 'AI', support: 'Підтримка', auto: 'Автоматизація', infra: 'Інфра' };
function AdminNomenclature() {
  const d = window.WFP_ADMIN_NOMENCLATURE;
  return (
    <React.Fragment>
      <PageHeader title="Адмін · Номенклатура послуг" subtitle="// внутрішній каталог для документів (не плутати з публічним /services)">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Import CSV · демо', 'ok')}><Icon name="download" size={13} />Import CSV</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий рядок · демо', 'ok')}><Icon name="plus" size={13} />Новий рядок</button>
      </PageHeader>
      <AdminSettingsTabs active="nomenclature" />

      <StatsRow>
        <Stat k="позицій" v={d.stats.total} sub="у каталозі" />
        <Stat k="активних" v={d.stats.active} kind="accent" sub="доступні в документах" />
        <Stat k="категорій" v={d.stats.categories} sub="груп" />
        <Stat k="валюта" v="USD" sub="+ ₴ за НБУ" />
      </StatsRow>

      <table className="wfp-table" style={{ marginTop: 14 }}>
        <thead><tr><th>Код</th><th style={{ width: '34%' }}>Назва</th><th>Категорія</th><th>Од.</th><th className="wfp-num">Ціна</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.code}>
              <td className="wfp-mono">{r.code}</td>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td>{NOM_CAT[r.category] || r.category}</td>
              <td className="wfp-mono">{r.unit}</td>
              <td className="wfp-num">${r.price}</td>
              <td><span className="wfas-status-pill" data-s={r.active ? 'ok' : 'untested'}><span className="wfas-dot" data-s={r.active ? 'active' : 'inactive'} />{r.active ? 'активна' : 'вимк'}</span></td>
              <td style={{ textAlign: 'right' }}><button className="wfp-iconbtn"><Icon name="edit" size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── /admin/crons ─────────────
function AdminCrons() {
  const d = window.WFP_ADMIN_CRONS;
  const label = { success: 'success', failed: 'failed', running: 'running', skipped: 'skipped' };
  return (
    <React.Fragment>
      <PageHeader title="Адмін · Крон-задачі" subtitle="// планувальник · розклад · статус останнього запуску · ручний run">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Оновити · демо', 'ok')}><Icon name="clock" size={13} />Оновити</button>
      </PageHeader>
      <AdminSettingsTabs active="crons" />

      <StatsRow>
        <Stat k="усього задач" v={d.stats.total} sub="у планувальнику" />
        <Stat k="успішні" v={d.stats.ok} kind="accent" sub="останній запуск" />
        <Stat k="впали" v={d.stats.failed} kind="warn" sub="потребують уваги" />
        <Stat k="зараз біжить" v={d.stats.running} sub="in progress" />
      </StatsRow>

      <div style={{ marginTop: 14 }}>
        {d.rows.map((c) => (
          <div className="wfas-card wfas-cron-card" data-stuck={c.status === 'failed' || undefined} key={c.id}>
            <div>
              <div className="wfas-cron-name"><span className="wfas-dot" data-s={c.status} />{c.name}</div>
              <div className="wfas-cron-meta">
                <span className="wfas-cron-sched">{c.schedule}</span>
                <span>· last: {c.last}</span>
                <span>· {c.duration}</span>
                <span>· next: {c.next}</span>
              </div>
              {c.error && <div className="wfas-cron-err">⚠ {c.error}</div>}
            </div>
            <div className="wfas-cron-right">
              <span className="wfas-status-pill" data-s={c.status === 'success' ? 'ok' : c.status === 'failed' ? 'fail' : 'untested'}>{label[c.status]}</span>
              <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('run now · демо', 'ok')}>run now</button>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">history</button>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { AdminTemplates, AdminSmtp, AdminBranding, AdminNomenclature, AdminCrons, AdminSettingsTabs });
