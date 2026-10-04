// portal-mobile.jsx — workflo.space client portal, native-mobile screens.
// Rendered inside the IOSDevice bezel (bezel only — no iOS nav/list chrome),
// so the workflo brand (Geist + JetBrains Mono numerals + lime accent) stays
// intact. Relies on window.WFP_DATA, window.Icon, window.IOSDevice.
//
// Exports: PortalMobile (the screen switcher) + individual screens to window.

const D = () => window.WFP_DATA;

// status dot color for client-facing statuses
function statusInfo(status) {
  return (window.WFP_DATA.client_statuses[status]) || { label: status, dot: 'var(--wf-fg-muted)' };
}
function deadlineClass(iso) {
  // demo: 28.05.2026 is "today"
  const today = new Date('2026-05-28');
  const d = new Date(iso);
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return 'over';
  if (days <= 3) return 'soon';
  return '';
}
function fmtDeadline(iso) {
  const [y, m, dd] = iso.split('-');
  return `${dd}.${m}`;
}

// ─────────────── Top app bar ───────────────
function MTop({ mark = false, back = false, title, sub, company = true, bell = true, onBack }) {
  const co = D().companies_owned.find((c) => c.active) || D().companies_owned[0];
  return (
    <div className="wfm-top">
      {back && (
        <button className="wfm-top-back" onClick={onBack || (() => window.__PMA && window.__PMA.back())}><Icon name="chevron" size={18} style={{ transform: 'rotate(90deg)' }} /></button>
      )}
      <div className="wfm-top-title">
        {mark && <div className="wfm-top-mark">workflo<span className="wfm-dot">.</span>space</div>}
        {title && <div className="wfm-top-h">{title}</div>}
        {sub && <div className="wfm-top-sub">{sub}</div>}
      </div>
      <div className="wfm-top-actions">
        {bell && (
          <button className="wfm-iconbtn"><Icon name="bell" size={17} /><span className="wfm-iconbtn-dot" /></button>
        )}
        {company && (
          <button className="wfm-co-pill" onClick={() => window.__PMA && window.__PMA.nav('more')}>
            <span className="wfm-co-av">Ф</span>
            <Icon name="chevron" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────── Bottom tab bar ───────────────
const MOBILE_TABS = [
  { id: 'orders',    label: 'Замовлення', icon: 'list',   badge: '2' },
  { id: 'inbox',     label: 'Інбокс',     icon: 'inbox',  badge: '5' },
  { id: 'billing',   label: 'Фінанси',    icon: 'receipt' },
  { id: 'documents', label: 'Документи',  icon: 'file' },
  { id: 'more',      label: 'Ще',         icon: 'list' },
];
function MTabbar({ active = 'orders' }) {
  return (
    <div className="wfm-tabbar">
      {MOBILE_TABS.map((t) => (
        <div key={t.id} className="wfm-tab" data-on={active === t.id || undefined} style={{ cursor: 'pointer' }} onClick={() => window.__PMA && window.__PMA.nav(t.id)}>
          {t.badge && active !== t.id && <span className="wfm-tab-badge">{t.badge}</span>}
          <span className="wfm-tab-icon"><Icon name={t.id === 'more' ? 'settings' : t.icon} size={21} /></span>
          <span className="wfm-tab-label">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────── Orders list ───────────────
function MobileOrders() {
  const orders = D().orders;
  const chips = [
    { id: 'all', label: 'усі', count: orders.length, on: true },
    { id: 'active', label: 'активні', count: 3 },
    { id: 'approve', label: 'на підтвердження', count: 1 },
    { id: 'done', label: 'готові', count: 2 },
  ];
  return (
    <div className="wfm">
      <MTop mark title="Замовлення" />
      <div className="wfm-body">
        <div className="wfm-chips">
          {chips.map((c) => (
            <div key={c.id} className="wfm-chip" data-on={c.on || undefined}>
              {c.label}<span className="wfm-chip-count">{c.count}</span>
            </div>
          ))}
        </div>
        <div className="wfm-cards">
          {orders.map((o) => {
            const s = statusInfo(o.status);
            const dl = deadlineClass(o.deadline);
            const approve = o.status === 'pending_approval';
            return (
              <div key={o.num} className="wfm-ocard" data-flag={approve ? 'approve' : undefined} style={{ cursor: 'pointer' }} onClick={() => window.__PMA && window.__PMA.open(o.num)}>
                {approve && <span className="wfm-ocard-flag"><Icon name="alert" size={11} />потрібне підтвердження</span>}
                <div className="wfm-ocard-top">
                  <span className="wfm-ocard-num">{o.num}</span>
                  <span className="wfm-status"><span className="wfm-status-dot" style={{ background: s.dot }} />{s.label}</span>
                </div>
                <div className="wfm-ocard-title">{o.title}</div>
                <div className="wfm-ocard-foot">
                  <div className="wfm-ocard-money">
                    {o.currency}{o.total.toLocaleString('uk')}
                    {o.paid > 0 && o.paid < o.total && <small> · сплачено {o.currency}{o.paid.toLocaleString('uk')}</small>}
                  </div>
                  <div className="wfm-ocard-meta">
                    {o.comments_unread > 0 && <span className="wfm-ocard-meta-i"><Icon name="inbox" size={13} />{o.comments_unread}</span>}
                    <span className="wfm-ocard-meta-i"><Icon name="paperclip" size={13} />{o.files}</span>
                    <span className={`wfm-deadline${dl ? ' wfm-deadline--' + dl : ''}`}>{fmtDeadline(o.deadline)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MTabbar active="orders" />
    </div>
  );
}

// ─────────────── Order detail · chat ───────────────
function MobileOrderChat() {
  const o = D().orders[0]; // ORD-2412 (pending_approval)
  const chat = D().chat;
  return (
    <div className="wfm">
      <MTop back title={o.num} sub="Інтеграція 1С ↔ Telegram-бот" company={false} bell={false} />
      <div className="wfm-approve">
        <div>
          <div className="wfm-approve-k">// потрібне ваше підтвердження</div>
          <div className="wfm-approve-t">Оцінка: {o.currency}{o.total.toLocaleString('uk')} · 6 тижнів</div>
        </div>
        <div className="wfm-approve-sub">Ілля надіслав специфікацію та оцінку. Підтвердіть, щоб ми почали роботу.</div>
        <div className="wfm-approve-row">
          <button className="wfm-btn wfm-btn--primary wfm-btn--sm" style={{ flex: 1 }} onClick={() => window.wfToast && window.wfToast('Підтвердити · демо', 'ok')}><Icon name="check" size={15} />Підтвердити</button>
          <button className="wfm-btn wfm-btn--sm"><Icon name="file" size={15} />Спека</button>
        </div>
      </div>
      <div className="wfm-body wfm-body--flush" style={{ paddingBottom: 8 }}>
        <div className="wfm-chat">
          {chat.map((m, i) => {
            if (m.who === 'system') return <div key={i} className="wfm-sysline">{m.text}</div>;
            const me = m.who === 'client';
            return (
              <div key={i} className={`wfm-msg wfm-msg--${me ? 'me' : 'them'}`}>
                <div className={`wfm-msg-who${m.who === 'illia' ? ' wfm-msg-who--illia' : ''}`}>{m.name}</div>
                <div className="wfm-bubble">
                  {m.text}
                  {m.attach && (
                    <div className="wfm-msg-attach"><Icon name="paperclip" size={12} />{m.attach.name} · {m.attach.size}</div>
                  )}
                </div>
                <div className="wfm-msg-ts">{m.ts}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="wfm-dock">
        <button className="wfm-iconbtn" style={{ borderRadius: '50%' }}><Icon name="paperclip" size={18} /></button>
        <div className="wfm-dock-field">Напишіть повідомлення…</div>
        <button className="wfm-dock-send"><Icon name="send" size={17} /></button>
      </div>
    </div>
  );
}

// ─────────────── Inbox ───────────────
const INBOX_ICON = { mention: 'users', doc: 'file', status: 'alert', chat: 'inbox', payment: 'receipt', marketing: 'star', system: 'settings' };
function MobileInbox() {
  const items = D().portal_inbox;
  const chips = [
    { id: 'all', label: 'усі', on: true },
    { id: 'unread', label: 'непрочитані', count: 5 },
    { id: 'mentions', label: '@згадки', count: 1 },
    { id: 'system', label: 'system' },
  ];
  return (
    <div className="wfm">
      <MTop mark title="Інбокс" />
      <div className="wfm-body">
        <div className="wfm-chips">
          {chips.map((c) => (
            <div key={c.id} className="wfm-chip" data-on={c.on || undefined}>{c.label}{c.count != null && <span className="wfm-chip-count">{c.count}</span>}</div>
          ))}
        </div>
        <div className="wfm-inbox">
          {items.map((it) => {
            const dueKind = it.kind === 'payment' ? 'payment-due' : it.kind;
            return (
              <div key={it.id} className="wfm-inrow">
                <span className="wfm-in-icon" data-kind={it.mentioned ? 'mention' : dueKind}>
                  <Icon name={INBOX_ICON[it.kind] || 'inbox'} size={17} />
                </span>
                <div className="wfm-in-main">
                  <div className="wfm-in-titlerow">
                    <span className="wfm-in-title">{it.actor_name || (it.actor === 'workflo' ? 'workflo.space' : 'Система')}</span>
                    <span className="wfm-in-src">{it.source}</span>
                  </div>
                  <div className="wfm-in-preview">{it.preview}</div>
                </div>
                <div className="wfm-in-right">
                  <span className="wfm-in-ts">{it.ts}</span>
                  {it.unread && <span className="wfm-in-unread" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MTabbar active="inbox" />
    </div>
  );
}

// ─────────────── Billing ───────────────
function MobileBilling() {
  const inv = D().invoices;
  const totalDebt = inv.reduce((s, i) => s + (i.amount - i.paid), 0);
  return (
    <div className="wfm">
      <MTop mark title="Фінанси" />
      <div className="wfm-body">
        <div className="wfm-seg" style={{ marginTop: 0 }}>
          <div className="wfm-seg-opt" data-on="true">Рахунки</div>
          <div className="wfm-seg-opt">Платежі</div>
          <div className="wfm-seg-opt">Recurring</div>
        </div>
        <div className="wfm-stats">
          <div className="wfm-stat">
            <span className="wfm-stat-k">до сплати</span>
            <span className="wfm-stat-v wfm-stat-v--warn">${totalDebt.toLocaleString('uk')}</span>
            <span className="wfm-stat-sub">2 рахунки</span>
          </div>
          <div className="wfm-stat">
            <span className="wfm-stat-k">сплачено / рік</span>
            <span className="wfm-stat-v">$5 800</span>
            <span className="wfm-stat-sub">4 платежі</span>
          </div>
        </div>

        <div className="wfm-section-h"><span className="wfm-section-h-t">// рахунки</span></div>
        {inv.map((i) => {
          const tag = D().doc_types.invoice;
          return (
            <div key={i.num} className="wfm-doc">
              <span className="wfm-doc-tag" style={{ background: tag.color }}>INV</span>
              <div className="wfm-doc-main">
                <span className="wfm-doc-name">{i.num}</span>
                <span className="wfm-doc-sub">{i.order} · {i.date}</span>
              </div>
              <div className="wfm-doc-right">
                <span className="wfm-doc-amt">${i.amount.toLocaleString('uk')}</span>
                <span className={`wfm-badge wfm-badge--${i.status}`}>{i.status}</span>
              </div>
            </div>
          );
        })}

        <div className="wfm-section-h"><span className="wfm-section-h-t">// реквізити для оплати</span></div>
        <div className="wfm-pay">
          <div className="wfm-pay-h"><span className="wfm-accent-dot" />Оплата у ₴ (IBAN)</div>
          <div className="wfm-pay-row">
            <span className="wfm-pay-k">Отримувач</span>
            <span className="wfm-pay-v">ФОП Васюленко Ілля С.</span>
          </div>
          <div className="wfm-pay-row">
            <span className="wfm-pay-k">IBAN</span>
            <span className="wfm-pay-v">UA21 3052 …0123 45678<span className="wfm-pay-copy"><Icon name="copy" size={13} /></span></span>
          </div>
          <div className="wfm-pay-row">
            <span className="wfm-pay-k">Призначення</span>
            <span className="wfm-pay-v">Оплата по INV-2025-0414</span>
          </div>
        </div>
      </div>
      <MTabbar active="billing" />
    </div>
  );
}

// ─────────────── Documents ───────────────
function MobileDocuments() {
  const docs = D().documents_list;
  const types = D().doc_types;
  const chips = [
    { id: 'all', label: 'усі', on: true },
    { id: 'invoice', label: 'рахунки' },
    { id: 'act', label: 'акти' },
    { id: 'spec', label: 'специфікації' },
    { id: 'contract', label: 'договори' },
  ];
  return (
    <div className="wfm">
      <MTop mark title="Документи" />
      <div className="wfm-body">
        <div className="wfm-chips">
          {chips.map((c) => <div key={c.id} className="wfm-chip" data-on={c.on || undefined}>{c.label}</div>)}
        </div>
        {docs.map((d) => {
          const t = types[d.type];
          return (
            <div key={d.num} className="wfm-doc">
              <span className="wfm-doc-tag" style={{ background: t.color, color: t.code === 'SPC' ? '#0C0A09' : '#fff' }}>{t.code}</span>
              <div className="wfm-doc-main">
                <span className="wfm-doc-name">{d.num}</span>
                <span className="wfm-doc-sub">{t.label} · {d.date} · {d.size}</span>
              </div>
              <div className="wfm-doc-right">
                {d.amount && <span className="wfm-doc-amt">${d.amount.toLocaleString('uk')}</span>}
                <span className={`wfm-badge wfm-badge--${d.status}`}>{d.status}</span>
              </div>
            </div>
          );
        })}
      </div>
      <MTabbar active="documents" />
    </div>
  );
}

// ─────────────── Loyalty ───────────────
function MobileLoyalty() {
  const ladder = [
    { id: 'new', name: 'new', req: '0 замовлень', disc: '0%', done: true },
    { id: 'regular', name: 'regular', req: '$1 000 обороту', disc: '3%', done: true },
    { id: 'silver', name: 'silver', req: '$5 000 обороту', disc: '5%', done: true, cur: true },
    { id: 'partner', name: 'partner', req: '$15 000 обороту', disc: '8%' },
    { id: 'vip', name: 'vip', req: '$40 000 обороту', disc: '12%' },
  ];
  const bonuses = [
    { date: '12.04', label: 'Бонус лояльності silver', amount: '+$180' },
    { date: '03.04', label: 'Реферал — EduForge', amount: '+$200' },
    { date: '20.02', label: 'Бонус лояльності regular', amount: '+$90' },
  ];
  return (
    <div className="wfm">
      <MTop mark title="Лояльність" />
      <div className="wfm-body">
        <div className="wfm-loy-hero">
          <div className="wfm-loy-tier">
            <span className="wfm-loy-tier-name">silver</span>
            <span className="wfm-loy-tier-disc">знижка 5%</span>
          </div>
          <div>
            <div className="wfm-loy-bar"><div className="wfm-loy-bar-fill" style={{ width: '46%' }} /></div>
            <div className="wfm-loy-progress-meta" style={{ marginTop: 8 }}>
              <span>$6 900 / $15 000</span>
              <span>до partner — $8 100</span>
            </div>
          </div>
        </div>

        <div className="wfm-section-h"><span className="wfm-section-h-t">// рівні</span></div>
        <div className="wfm-loy-ladder">
          {ladder.map((s) => (
            <div key={s.id} className="wfm-loy-step" data-on={s.done || undefined} data-cur={s.cur || undefined}>
              <span className="wfm-loy-step-dot" />
              <div>
                <div className="wfm-loy-step-name">{s.name}{s.cur && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-accent)', marginLeft: 8 }}>// ви тут</span>}</div>
                <div className="wfm-loy-step-req">{s.req}</div>
              </div>
              <span className="wfm-loy-step-disc">{s.disc}</span>
            </div>
          ))}
        </div>

        <div className="wfm-section-h"><span className="wfm-section-h-t">// історія бонусів</span></div>
        {bonuses.map((b, i) => (
          <div key={i} className="wfm-doc" style={{ gridTemplateColumns: '1fr auto' }}>
            <div className="wfm-doc-main">
              <span className="wfm-doc-name" style={{ fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>{b.label}</span>
              <span className="wfm-doc-sub">{b.date}.2026</span>
            </div>
            <span className="wfm-doc-amt" style={{ color: 'var(--wf-success)' }}>{b.amount}</span>
          </div>
        ))}
      </div>
      <MTabbar active="more" />
    </div>
  );
}

// ─────────────── Login (phone + OTP) ───────────────
const ASCII_MARK = " /\\_/\\\n( o.o )\n > ^ <";
function MobileLogin({ step = 1 }) {
  return (
    <div className="wfm">
      <div className="wfm-auth">
        <span className="wfm-auth-mark"><span className="a">{ASCII_MARK}</span></span>
        {step === 1 ? (
          <React.Fragment>
            <div className="wfm-auth-h">З поверненням</div>
            <div className="wfm-auth-sub">Увійдіть до кабінету workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</div>
            <div className="wfm-seg">
              <div className="wfm-seg-opt">Email</div>
              <div className="wfm-seg-opt" data-on="true">Телефон</div>
            </div>
            <div className="wfm-field">
              <span className="wfm-label">Номер телефону</span>
              <div className="wfm-input">+380 50 123 84 12</div>
            </div>
            <button className="wfm-btn wfm-btn--primary wfm-btn--block" style={{ marginTop: 8 }} onClick={() => window.__PMA && window.__PMA.loginNext && window.__PMA.loginNext()}>Отримати код у SMS</button>
            <div className="wfm-auth-hint">Немає акаунту? <span className="wfm-link">Зареєструватися</span></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="wfm-auth-h">Введіть код</div>
            <div className="wfm-auth-sub">Надіслали SMS на +380 50 ••• 84 12</div>
            <div className="wfm-otp">
              {['4', '8', '1', '', '', ''].map((d, i) => (
                <div key={i} className="wfm-otp-cell" data-filled={d ? 'true' : undefined} data-active={i === 3 ? 'true' : undefined}>{d}</div>
              ))}
            </div>
            <button className="wfm-btn wfm-btn--primary wfm-btn--block" style={{ marginTop: 18 }} onClick={() => window.__PMA && window.__PMA.loginAuth && window.__PMA.loginAuth()}>Підтвердити</button>
            <div className="wfm-auth-hint">Не отримали код? <span className="wfm-link">Надіслати знову (0:42)</span></div>
          </React.Fragment>
        )}
        <div className="wfm-auth-foot">$ workflo.space — захищено · 2FA</div>
      </div>
    </div>
  );
}

// ─────────────── More / company-switcher bottom sheet ───────────────
function MobileMoreSheet() {
  const co = D().companies_owned;
  const more = [
    { id: 'loyalty', label: 'Лояльність', icon: 'star' },
    { id: 'referrals', label: 'Реферали', icon: 'gift' },
    { id: 'team', label: 'Учасники', icon: 'users', badge: '4' },
    { id: 'settings', label: 'Налаштування', icon: 'settings' },
  ];
  return (
    <div className="wfm">
      <MTop mark title="Замовлення" />
      <div className="wfm-body" style={{ filter: 'blur(1px)', opacity: 0.5 }}>
        <div className="wfm-cards">
          {D().orders.slice(0, 2).map((o) => (
            <div key={o.num} className="wfm-ocard"><div className="wfm-ocard-title">{o.title}</div></div>
          ))}
        </div>
      </div>
      <div className="wfm-sheet-scrim">
        <div className="wfm-sheet">
          <div className="wfm-sheet-grip" />
          <div className="wfm-sheet-h">Компанія</div>
          <div className="wfm-sheet-sub">// переключити активну компанію</div>
          <div className="wfm-sheet-list">
            {co.map((c) => (
              <div key={c.id} className="wfm-sheet-row">
                <span className="wfm-sheet-av">{c.name.replace(/[^А-Яа-яA-Za-z]/g, '').slice(0, 2).toUpperCase()}</span>
                <div>
                  <div className="wfm-sheet-row-name">{c.name}</div>
                  <div className="wfm-sheet-row-meta">{c.role} · <span className="wfm-sheet-tier">{c.tier}</span></div>
                </div>
                {c.active ? <span className="wfm-sheet-check"><Icon name="check" size={18} /></span> : <span />}
              </div>
            ))}
          </div>
          <div className="wfm-sheet-h" style={{ marginTop: 18 }}>Ще</div>
          <div className="wfm-menu" style={{ marginTop: 6 }}>
            {more.map((m) => (
              <div key={m.id} className="wfm-menu-row">
                <span className="wfm-menu-icon"><Icon name={m.icon} size={18} /></span>
                <span className="wfm-menu-label">{m.label}</span>
                {m.badge ? <span className="wfm-menu-badge">{m.badge}</span> : <span className="wfm-menu-chev"><Icon name="chev_r" size={15} /></span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Device wrapper ───────────────
function MPhone({ theme = 'light', accent = 'lime', children }) {
  const accentPreset = (window.ACCENT_PRESETS && window.ACCENT_PRESETS[accent]) || null;
  const vars = accentPreset ? {
    '--wf-accent': theme === 'dark' ? accentPreset.dark : accentPreset.light,
    '--wf-accent-bg': accentPreset.dark,
    '--wf-accent-soft': theme === 'dark' ? accentPreset.softDark : accentPreset.soft,
  } : {};
  return (
    <IOSDevice width={390} height={844} dark={theme === 'dark'}>
      <div className="wf-root wfp-root" data-theme={theme} data-accent={accent} style={{ height: '100%', ...vars }}>
        {children}
      </div>
    </IOSDevice>
  );
}

Object.assign(window, {
  MPhone,
  MobileOrders, MobileOrderChat, MobileInbox, MobileBilling,
  MobileDocuments, MobileLoyalty, MobileLogin, MobileMoreSheet,
});
