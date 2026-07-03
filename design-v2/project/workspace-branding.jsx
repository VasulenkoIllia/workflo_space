// workspace-branding.jsx — G24 · SaaS white-label config (E1–E5, module 20+SaaS)
// /settings/branding · /domain · /landing (CMS) · /client-portal + per-agency landing demo.
// Fully token-driven: editor mutates --wf-* on a live preview surface. 2 demo brands.

const _b = React.useState;

// two demo brands — default workflo (lime) + contrasting Acme (indigo)
const BRANDS = {
  workflo: { name: 'workflo.space', accent: '#A3D90D', accentDark: '#C5F82A', soft: '#ECFCC4', font: 'Geist', mark: '/\\_/\\', sub: 'platform' },
  acme:    { name: 'Acme Agency',   accent: '#4F46E5', accentDark: '#818CF8', soft: '#E0E7FF', font: 'Geist', mark: 'A',     sub: 'studio' },
};
const ACCENT_SWATCHES = [
  { id: 'lime',   c: '#A3D90D', soft: '#ECFCC4' },
  { id: 'indigo', c: '#4F46E5', soft: '#E0E7FF' },
  { id: 'amber',  c: '#D97706', soft: '#FEF3C7' },
  { id: 'cyan',   c: '#0891B2', soft: '#CFFAFE' },
  { id: 'rose',   c: '#E11D48', soft: '#FFE4E6' },
  { id: 'emerald',c: '#059669', soft: '#D1FAE5' },
];
const BR_TABS = [
  { id: 'branding', label: 'Брендинг', icon: 'star' },
  { id: 'domain',   label: 'Домен',    icon: 'globe' },
  { id: 'landing',  label: 'Лендинг',  icon: 'edit' },
  { id: 'portal',   label: 'Портал клієнта', icon: 'users' },
];

// ── live preview surface (sample components rendered with current tokens) ──
function BrandPreview({ accent, soft, name, mark, font }) {
  const vars = { '--wf-accent': accent, '--wf-accent-bg': accent, '--wf-accent-soft': soft, fontFamily: font + ', system-ui, sans-serif' };
  return (
    <div style={{ ...vars, border: '1px solid var(--wf-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--wf-bg)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--wf-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--wf-surface)' }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>{mark}</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
        <span className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-fg-subtle)', marginLeft: 'auto' }}>live preview</span>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm">Основна дія</button>
          <button className="wfp-btn wfp-btn--sm">Вторинна</button>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Ghost</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="wfg-pill2" data-tone="accent"><span className="wfg-pill2-dot" />partner</span>
          <span className="wfg-pill2" data-tone="ok"><span className="wfg-pill2-dot" />активний</span>
          <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />очікує</span>
        </div>
        <div className="wfp-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Замовлення ORD-2412</div>
          <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>в роботі · дедлайн 08.06</div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--wf-subtle)', overflow: 'hidden', marginTop: 4 }}><div style={{ width: '64%', height: '100%', background: accent }} /></div>
        </div>
        <div className="wfp-field"><label>Поле вводу</label><input defaultValue="Фокус → акцентна рамка" style={{ borderColor: accent }} /></div>
      </div>
    </div>
  );
}

// ── E1 · branding ───────────────────────────────────────────────────
function BrandingTab({ brandKey, setBrandKey, custom, setCustom }) {
  const b = BRANDS[brandKey];
  const accent = custom.accent || b.accent;
  const soft = custom.soft || b.soft;
  const [saved, setSaved] = _b(false);
  return (
    <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 28, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="wfl-panel">
          <div className="wfl-panel-h">// логотип і назва</div>
          <div className="wfl-panel-b">
            <div className="wfp-field"><label>Назва бренду</label><input defaultValue={b.name} key={b.name} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="wfp-field"><label>Лого (світле)</label><div style={{ height: 64, border: '1px dashed var(--wf-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--wf-fg-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}><Icon name="download" size={14} />logo-light.svg</div></div>
              <div className="wfp-field"><label>Лого (темне)</label><div style={{ height: 64, border: '1px dashed var(--wf-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--wf-fg-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, background: 'var(--wf-fg)' }}><Icon name="download" size={14} color="var(--wf-bg)" /><span style={{ color: 'var(--wf-bg)' }}>logo-dark.svg</span></div></div>
            </div>
          </div>
        </div>

        <div className="wfl-panel">
          <div className="wfl-panel-h">// акцентний колір</div>
          <div className="wfl-panel-b">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ACCENT_SWATCHES.map((s) => (
                <button key={s.id} onClick={() => setCustom({ accent: s.c, soft: s.soft })} style={{ width: 40, height: 40, borderRadius: 10, background: s.c, border: accent === s.c ? '3px solid var(--wf-fg)' : '3px solid transparent', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} title={s.id} />
              ))}
              <label style={{ width: 40, height: 40, borderRadius: 10, border: '2px dashed var(--wf-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', color: 'var(--wf-fg-muted)' }}>
                <Icon name="plus" size={16} />
                <input type="color" value={accent} onChange={(e) => setCustom({ accent: e.target.value, soft: e.target.value + '22' })} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </label>
            </div>
            <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}>--wf-accent: <span style={{ color: 'var(--wf-fg)' }}>{accent}</span></div>
          </div>
        </div>

        <div className="wfl-panel">
          <div className="wfl-panel-h">// тема й шрифт</div>
          <div className="wfl-panel-b">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="wfp-field"><label>Тема за замовч.</label><select className="wfl-select"><option>Світла</option><option>Темна</option><option>Системна</option></select></div>
              <div className="wfp-field"><label>Шрифт-пресет</label><select className="wfl-select"><option>Geist</option><option>Inter</option><option>Roboto</option></select></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 8, background: 'var(--wf-accent-soft)', border: '1px solid var(--wf-accent)' }}>
              <Icon name="check" size={14} color="var(--wf-accent)" />
              <span style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>Бренд застосується до 3 поверхонь: <strong>лендинг · портал · workspace</strong></span>
            </div>
          </div>
        </div>

        <button className="wfp-btn wfp-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
          <Icon name={saved ? 'check' : 'star'} size={14} />{saved ? 'Збережено · застосовано' : 'Зберегти бренд'}
        </button>
      </div>

      <div style={{ position: 'sticky', top: 0 }}>
        <div className="wfp-card-h" style={{ marginBottom: 12 }}>
          <div className="wfp-card-h-aux">// демо-бренд</div>
          <div className="r4-seg" style={{ display: 'inline-flex', border: '1px solid var(--wf-border)', borderRadius: 9, padding: 3, gap: 3 }}>
            <div onClick={() => { setBrandKey('workflo'); setCustom({}); }} style={{ padding: '6px 11px', borderRadius: 6, cursor: 'pointer', fontSize: 12, background: brandKey === 'workflo' ? 'var(--wf-fg)' : 'transparent', color: brandKey === 'workflo' ? 'var(--wf-bg)' : 'var(--wf-fg-secondary)' }}>workflo</div>
            <div onClick={() => { setBrandKey('acme'); setCustom({}); }} style={{ padding: '6px 11px', borderRadius: 6, cursor: 'pointer', fontSize: 12, background: brandKey === 'acme' ? 'var(--wf-fg)' : 'transparent', color: brandKey === 'acme' ? 'var(--wf-bg)' : 'var(--wf-fg-secondary)' }}>Acme</div>
          </div>
        </div>
        <BrandPreview accent={accent} soft={soft} name={b.name} mark={b.mark} font={b.font} />
      </div>
    </div>
  );
}

// ── E2 · domain ─────────────────────────────────────────────────────
function DomainTab({ brandKey }) {
  const sub = brandKey === 'acme' ? 'acme' : 'workflo';
  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// субдомен</div>
        <div className="wfl-panel-b">
          <div className="wfp-field"><label>Адреса</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input defaultValue={sub} key={sub} style={{ flex: 1 }} />
              <span className="wf-mono" style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>.workflo.space</span>
            </div>
            <span className="wfp-field-hint wfp-field-hint--ok" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-success)' }}>✓ {sub}.workflo.space вільний · regex [a-z][a-z0-9-]*</span>
          </div>
        </div>
      </div>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// власний домен<span className="wfg-pill2" data-tone={brandKey === 'acme' ? 'ok' : 'warn'} style={{ fontSize: 9 }}><span className="wfg-pill2-dot" />{brandKey === 'acme' ? 'verified' : 'pending'}</span></div>
        <div className="wfl-panel-b">
          <div className="wfp-field"><label>Домен</label><input defaultValue={brandKey === 'acme' ? 'agency.acme.com' : 'studio.example.com'} /></div>
          <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--wf-subtle)', border: '1px solid var(--wf-border)' }}>
            <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 8 }}>// додайте CNAME-запис у вашого DNS-провайдера</div>
            <div className="r4-copyfield" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--wf-border)', borderRadius: 8, background: 'var(--wf-bg)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              <span style={{ flex: 1 }}>CNAME  @  →  cname.workflo.space</span>
              <button style={{ border: 0, background: 'none', color: 'var(--wf-fg-muted)', cursor: 'pointer', display: 'flex' }}><Icon name="copy" size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span className="wfg-pill2" data-tone={brandKey === 'acme' ? 'ok' : 'warn'}><span className="wfg-pill2-dot" />DNS: {brandKey === 'acme' ? 'verified' : 'очікує (~10 хв)'}</span>
            <span className="wfg-pill2" data-tone={brandKey === 'acme' ? 'ok' : 'muted'}><span className="wfg-pill2-dot" />SSL: {brandKey === 'acme' ? 'активний' : 'видасться авто'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── E3 · landing CMS ────────────────────────────────────────────────
const LANDING_SECTIONS = [
  { id: 'hero', label: 'Hero', on: true },
  { id: 'services', label: 'Послуги', on: true },
  { id: 'about', label: 'Про нас', on: true },
  { id: 'cases', label: 'Кейси / Відгуки', on: true },
  { id: 'contacts', label: 'Контакти', on: true },
  { id: 'footer', label: 'Footer', on: true },
  { id: 'seo', label: 'SEO', on: false },
];
function LandingTab() {
  const [secs, setSecs] = _b(LANDING_SECTIONS);
  const [sel, setSel] = _b('hero');
  const tog = (id) => setSecs((xs) => xs.map((s) => (s.id === id ? { ...s, on: !s.on } : s)));
  return (
    <React.Fragment>
      <div className="wfp-card-h" style={{ marginBottom: 16 }}>
        <div className="wfp-card-h-t">Landing CMS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="wfg-pill2" data-tone="warn"><span className="wfg-pill2-dot" />draft</span>
          <button className="wfp-btn wfp-btn--sm"><Icon name="external" size={12} />Прев'ю</button>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm"><Icon name="check" size={12} />Опублікувати</button>
        </div>
      </div>
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 8 }}>// секції · drag для порядку</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {secs.map((s) => (
              <div key={s.id} className="wfl-pipe-item" data-on={sel === s.id || undefined} onClick={() => setSel(s.id)} style={{ opacity: s.on ? 1 : 0.5 }}>
                <span className="wfl-stage-grip"><Icon name="list" size={13} /></span>
                <span className="wfl-pipe-item-n">{s.label}</span>
                <button className="wfp-iconbtn" onClick={(e) => { e.stopPropagation(); tog(s.id); }} title={s.on ? 'вимкнути' : 'увімкнути'} style={{ color: s.on ? 'var(--wf-accent)' : 'var(--wf-fg-subtle)' }}><Icon name={s.on ? 'eye' : 'eye_off'} size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="wfl-panel">
          <div className="wfl-panel-h">// редактор секції «{(secs.find((s) => s.id === sel) || {}).label}»</div>
          <div className="wfl-panel-b" style={{ gap: 16 }}>
            {sel === 'seo' ? (
              <React.Fragment>
                <div className="wfp-field"><label>SEO title</label><input defaultValue="Acme Agency — діджитал-рішення для бізнесу" /></div>
                <div className="wfp-field"><label>Meta description</label><textarea className="wfl-select" style={{ height: 64, padding: '8px 10px' }} defaultValue="Розробка, інтеграції та автоматизація під ключ." /></div>
                <div className="wfp-field"><label>OG-image</label><div style={{ height: 90, border: '1px dashed var(--wf-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--wf-fg-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}><Icon name="download" size={14} />og-image.png · 1200×630</div></div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="wfp-field"><label>Заголовок</label><input defaultValue="Будуємо діджитал, що працює" /></div>
                <div className="wfp-field"><label>Підзаголовок (markdown)</label><textarea className="wfl-select" style={{ height: 70, padding: '8px 10px' }} defaultValue="Інтеграції, автоматизація та продукти **під ключ** — від ідеї до релізу." /></div>
                <div className="wfp-field"><label>CTA-кнопка</label><input defaultValue="Обговорити проєкт" /></div>
                <button className="wfp-btn wfp-btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={() => window.wfToast && window.wfToast('Додати поле · демо', 'ok')}><Icon name="plus" size={13} />Додати поле</button>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ── E4 · client portal config ───────────────────────────────────────
const PORTAL_FEATURES = [
  { id: 'leads', label: 'Воронка / заявки', on: false, tier: 'Pro' },
  { id: 'calendar', label: 'Календар подій', on: true, tier: null },
  { id: 'wallet', label: 'Гаманець / баланс', on: true, tier: null },
  { id: 'support', label: 'Підтримка / тікети', on: true, tier: null },
  { id: 'referrals', label: 'Реферальна програма', on: false, tier: 'Team' },
];
function PortalTab() {
  const [feats, setFeats] = _b(PORTAL_FEATURES);
  const tog = (id) => setFeats((xs) => xs.map((f) => (f.id === id ? { ...f, on: !f.on } : f)));
  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// welcome-копія</div>
        <div className="wfl-panel-b">
          <div className="wfp-field"><label>Текст привітання (markdown)</label><textarea className="wfl-select" style={{ height: 84, padding: '9px 11px', resize: 'vertical' }} defaultValue="Вітаємо у кабінеті **Acme Agency**! Тут ви бачите свої замовлення, рахунки й документи. Питання — у розділі «Підтримка»." /></div>
        </div>
      </div>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// видимі фічі</div>
        <div className="wfl-panel-b" style={{ gap: 0 }}>
          {feats.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--wf-border)' }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{f.label}</span>
              {f.tier && <span className="wfg-pill2" data-tone="muted"><span className="wfg-pill2-dot" />з {f.tier}</span>}
              <button onClick={() => tog(f.id)} disabled={!!f.tier} style={{ width: 40, height: 23, borderRadius: 999, border: 0, cursor: f.tier ? 'not-allowed' : 'pointer', background: f.on ? 'var(--wf-accent)' : 'var(--wf-border-strong)', position: 'relative', opacity: f.tier ? 0.5 : 1, transition: 'background .15s' }}>
                <span style={{ position: 'absolute', top: 2, left: f.on ? 19 : 2, width: 19, height: 19, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="wfl-panel">
        <div className="wfl-panel-h">// контакти підтримки</div>
        <div className="wfl-panel-b">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="wfp-field"><label>Email</label><input defaultValue="support@acme.com" /></div>
            <div className="wfp-field"><label>Telegram</label><input defaultValue="@acme_support" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── E5 · per-agency landing demo (2 brands side-by-side) ────────────
function LandingDemo({ brand }) {
  const b = BRANDS[brand];
  return (
    <div style={{ '--wf-accent': b.accent, '--wf-accent-soft': b.soft, border: '1px solid var(--wf-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--wf-bg)', fontFamily: b.font + ', sans-serif' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--wf-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--wf-surface)' }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: b.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 10 }}>{b.mark}</span>
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{b.name}</span>
        <span className="wf-mono" style={{ fontSize: 9.5, color: 'var(--wf-fg-subtle)', marginLeft: 'auto' }}>{brand === 'acme' ? 'agency.acme.com' : 'workflo.space'}</span>
      </div>
      <div style={{ padding: '26px 20px', textAlign: 'center', background: 'var(--wf-accent-soft)' }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>Будуємо діджитал, що працює</div>
        <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)', marginBottom: 14 }}>Інтеграції та продукти під ключ</div>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" style={{ display: 'inline-flex' }}>Обговорити проєкт</button>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {['Розробка', 'Інтеграції', 'Підтримка'].map((s) => (
          <div key={s} className="wfp-card" style={{ padding: 10, textAlign: 'center' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: b.accent, margin: '0 auto 6px' }} />
            <div style={{ fontSize: 11, fontWeight: 500 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── shell ───────────────────────────────────────────────────────────
function WorkspaceBranding() {
  const [tab, setTab] = _b('branding');
  const [brandKey, setBrandKey] = _b('workflo');
  const [custom, setCustom] = _b({});
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">White-label</h1>
          <div className="wfp-ph-sub">// бренд агенції · токени застосовуються в рантаймі до 3 поверхонь</div>
        </div>
      </div>
      <div className="wfg-tabs">
        {BR_TABS.map((t) => <div key={t.id} className="wfg-tab" data-on={tab === t.id || undefined} onClick={() => setTab(t.id)}><Icon name={t.icon} size={14} />{t.label}</div>)}
      </div>
      {tab === 'branding' && <BrandingTab brandKey={brandKey} setBrandKey={setBrandKey} custom={custom} setCustom={setCustom} />}
      {tab === 'domain' && <DomainTab brandKey={brandKey} />}
      {tab === 'landing' && <LandingTab />}
      {tab === 'portal' && <PortalTab />}

      <div style={{ marginTop: 34 }}>
        <div className="wfp-card-h" style={{ marginBottom: 14 }}>
          <div className="wfp-card-h-t">E5 · як рендериться брендований лендинг</div>
          <div className="wfp-card-h-aux">// той самий компонент · різні токени + контент</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <LandingDemo brand="workflo" />
          <LandingDemo brand="acme" />
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WorkspaceBranding });
