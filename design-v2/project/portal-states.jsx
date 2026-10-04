// portal-states.jsx — Error states + global overlays
// 404 · 500 · no-permission · maintenance · cmd+K search · bell dropdown · company switcher · new company

// ──────────────────────────────────────────────────────────────────────
// Error pages
// ──────────────────────────────────────────────────────────────────────
function ErrorState({ code, codeKind, ascii, h, p, primary, secondary, meta }) {
  return (
    <div className="wfp-root wf-root" data-theme="light" style={{ height: '100%' }}>
      <div className="wfp-err-wrap">
        <div className="wfp-err">
          <div className={`wfp-err-code${codeKind ? ' wfp-err-code--' + codeKind : ''}`}>{code}</div>
          {ascii && <div className="wfp-err-ascii">{ascii}</div>}
          <div className="wfp-err-h">{h}</div>
          <div className="wfp-err-p">{p}</div>
          <div className="wfp-err-actions">
            {primary && <button className="wfp-btn wfp-btn--primary">{primary}</button>}
            {secondary && <button className="wfp-btn">{secondary}</button>}
          </div>
          {meta && (
            <div className="wfp-err-meta">
              {meta.map((m, i) => (
                <React.Fragment key={i}>
                  <span>{m.k}: <strong style={{ color: 'var(--wf-fg)' }}>{m.v}</strong></span>
                  {i < meta.length - 1 && <span>·</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Portal404 = () => (
  <ErrorState
    code="404"
    ascii={`/\\_/\\\n( ?.? )\n > ^ <`}
    h="Сторінку не знайдено"
    p="Можливо вона переїхала, або у вас немає доступу до неї. Перевірте посилання або повертайтеся на головну."
    primary="← На головну"
    secondary="Зв'язатися"
    meta={[
      { k: 'url', v: '/orders/ORD-9999' },
      { k: 'time', v: '14:32:18' },
      { k: 'session', v: 'sx9p7m...' },
    ]}
  />
);

const Portal500 = () => (
  <ErrorState
    code="500"
    codeKind="err"
    ascii={`/\\_/\\\n( x.x )\n > ^ <`}
    h="Щось пішло не так на нашій стороні"
    p="Команда вже отримала повідомлення і дивиться. Спробуйте через хвилину. Якщо проблема повторюється — напишіть нам у @workflospace."
    primary="Спробувати ще раз"
    secondary="Зв'язатися"
    meta={[
      { k: 'error_id', v: 'err_kx9p7m2v' },
      { k: 'time', v: '14:32:18 UTC' },
      { k: 'status', v: 'Investigating' },
    ]}
  />
);

const Portal403 = () => (
  <ErrorState
    code="403"
    codeKind="warn"
    ascii={`/\\_/\\\n( =_= )\n > ^ <`}
    h="У вас немає доступу"
    p="Ця сторінка доступна тільки owner'у компанії. Якщо вам потрібен доступ — попросіть owner'а змінити вашу роль у /settings/members."
    primary="← Назад"
    secondary="Зв'язатися з owner"
    meta={[
      { k: 'role', v: 'member' },
      { k: 'required', v: 'owner' },
      { k: 'company', v: 'Brunky' },
    ]}
  />
);

const PortalMaintenance = () => (
  <ErrorState
    code="🛠"
    ascii={`/\\_/\\\n( zzz )\n > ^ <`}
    h="Технічне обслуговування"
    p="Зараз робимо короткочасне оновлення системи. Повернемося через ~10 хвилин. Дякуємо за терпіння — підпишіться на статус-телеграм, щоб знати щойно все запрацює."
    primary="status.workflo.space →"
    secondary="@workflospace"
    meta={[
      { k: 'estimated', v: '14:42 UTC · ~10 хв' },
      { k: 'incident', v: 'maintenance' },
      { k: 'started', v: '14:32 UTC' },
    ]}
  />
);

// ──────────────────────────────────────────────────────────────────────
// Cmd+K search overlay
// ──────────────────────────────────────────────────────────────────────
function CmdKOverlay() {
  return (
    <div className="wfp-cmdk-overlay">
      <div className="wfp-cmdk">
        <div className="wfp-cmdk-input">
          <Icon name="search" size={18} color="var(--wf-fg-muted)" />
          <input defaultValue="інтегра" />
          <span className="wfp-cmdk-row-kbd">esc</span>
        </div>
        <div className="wfp-cmdk-body">
          <div className="wfp-cmdk-group">// замовлення · 2</div>
          <div className="wfp-cmdk-row" data-active="true">
            <span className="wfp-cmdk-row-icon"><Icon name="inbox" size={14} /></span>
            <span>
              <span className="wfp-cmdk-row-t"><strong style={{ color: 'var(--wf-accent)' }}>Інтегра</strong>ція 1С ↔ Telegram-бот для водіїв</span>
              <span className="wfp-cmdk-row-sub">ORD-2412 · pending_approval</span>
            </span>
            <span className="wfp-cmdk-row-kbd">↵</span>
          </div>
          <div className="wfp-cmdk-row">
            <span className="wfp-cmdk-row-icon"><Icon name="inbox" size={14} /></span>
            <span>
              <span className="wfp-cmdk-row-t">AI-агент саппорту з <strong style={{ color: 'var(--wf-accent)' }}>інтегра</strong>цією</span>
              <span className="wfp-cmdk-row-sub">ORD-2408 · done</span>
            </span>
          </div>

          <div className="wfp-cmdk-group">// документи · 1</div>
          <div className="wfp-cmdk-row">
            <span className="wfp-cmdk-row-icon"><Icon name="file" size={14} /></span>
            <span>
              <span className="wfp-cmdk-row-t">Specification · <strong style={{ color: 'var(--wf-accent)' }}>Інтегра</strong>ція 1С</span>
              <span className="wfp-cmdk-row-sub">SPC-2025-0418 · підписано</span>
            </span>
          </div>

          <div className="wfp-cmdk-group">// швидкі дії</div>
          <div className="wfp-cmdk-row">
            <span className="wfp-cmdk-row-icon"><Icon name="plus" size={14} color="var(--wf-accent)" /></span>
            <span><span className="wfp-cmdk-row-t">Створити нове замовлення</span></span>
            <span className="wfp-cmdk-row-kbd">⌘N</span>
          </div>
          <div className="wfp-cmdk-row">
            <span className="wfp-cmdk-row-icon"><Icon name="receipt" size={14} /></span>
            <span><span className="wfp-cmdk-row-t">Завантажити всі рахунки · ZIP</span></span>
          </div>
          <div className="wfp-cmdk-row">
            <span className="wfp-cmdk-row-icon"><Icon name="settings" size={14} /></span>
            <span>
              <span className="wfp-cmdk-row-t">Перейти в /settings/notifications</span>
              <span className="wfp-cmdk-row-sub">канали + події</span>
            </span>
          </div>
        </div>
        <div className="wfp-cmdk-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> навігація · <kbd>↵</kbd> відкрити · <kbd>esc</kbd> закрити</span>
          <span>11 з 142 результатів</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Bell dropdown (notification preview)
// ──────────────────────────────────────────────────────────────────────
function BellDropdown() {
  const recent = window.WFP_DATA.portal_inbox.slice(0, 4);
  return (
    <div className="wfp-bell-pop">
      <div className="wfp-bell-pop-h">
        <div className="wfp-bell-pop-h-t">Останні · {recent.filter((m) => m.unread).length} нових</div>
        <div className="wfp-bell-pop-h-aux">позначити прочитаним</div>
      </div>
      <div className="wfp-bell-pop-list">
        {recent.map((m) => (
          <InboxRow key={m.id} m={m} mode="portal" />
        ))}
      </div>
      <div className="wfp-bell-pop-foot">Усі повідомлення → /inbox</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Company switcher popover (from sidebar footer)
// ──────────────────────────────────────────────────────────────────────
function CompanySwitcherPop() {
  const companies = window.WFP_DATA.companies_owned;
  return (
    <div className="wfp-co-pop">
      <div style={{ padding: '8px 12px 4px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        // ваші компанії · {companies.length}
      </div>
      {companies.map((c, i) => (
        <div key={c.id} className="wfp-co-pop-row" data-active={c.active || undefined}>
          <span className="wfp-co-pop-row-av" style={{ background: c.active ? 'var(--wf-accent-bg)' : 'var(--wf-fg)', color: c.active ? 'var(--wf-fg)' : 'var(--wf-bg)' }}>
            {c.name.split(' ')[0][0]}
          </span>
          <div className="wfp-co-pop-row-meta">
            <span className="wfp-co-pop-row-name">{c.name}</span>
            <span className="wfp-co-pop-row-sub">{c.role} · {c.tier}</span>
          </div>
          {c.active && <Icon name="check" size={14} color="var(--wf-accent)" />}
        </div>
      ))}
      <div className="wfp-co-pop-add">
        <Icon name="plus" size={13} />
        <span>Створити нову компанію</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// New company wizard — when user adds 2nd+ company
// ──────────────────────────────────────────────────────────────────────
function NewCompanyWizard() {
  return (
    <div className="wfp-modal-overlay">
      <div className="wfp-modal wfp-modal--lg">
        <div className="wfp-modal-h">
          <Icon name="plus" size={18} color="var(--wf-accent)" />
          <div className="wfp-modal-h-t">Нова компанія</div>
          <div className="wfp-modal-h-aux">// додасться у ваш switcher</div>
          <span className="wfp-modal-h-close"><Icon name="alert" size={14} /></span>
        </div>
        <div className="wfp-modal-body">
          <FormMsg kind="info" k="що це">
            Якщо ви обслуговуєте кілька юр.осіб (наприклад ФОП + ТОВ) — створіть окремі workspace для кожної. Документи, рахунки, реквізити — окремо. Команда — окремо.
          </FormMsg>
          <div className="wfp-field">
            <label>Назва</label>
            <input defaultValue="ФОП Сидоренко О.І." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="wfp-field">
              <label>Тип</label>
              <select defaultValue="fop" style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }}>
                <option value="fop">ФОП</option>
                <option value="tov">ТОВ</option>
              </select>
            </div>
            <div className="wfp-field"><label>ЄДРПОУ / ІПН</label><input defaultValue="3987654321" /></div>
          </div>
          <div className="wfp-field">
            <label>Slug · посилання</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>
              <span style={{ color: 'var(--wf-fg-muted)' }}>portal.workflo.space/c/</span>
              <input defaultValue="sydorenko-fop" style={{ flex: 1, border: 0, background: 'transparent', outline: 0, font: 'inherit', color: 'var(--wf-fg)', padding: 0 }} />
              <span style={{ color: 'var(--wf-success)', fontSize: 11 }}>✓ доступний</span>
            </div>
          </div>
          <FormMsg kind="info" k="реквізити пізніше">
            Адресу, IBAN, банк можна додати у <strong>/settings/company</strong> вже всередині нової компанії. Без них рахунки на цю компанію не виставляться.
          </FormMsg>
        </div>
        <div className="wfp-modal-foot">
          <div className="wfp-modal-foot-left">// безкоштовно · необмежена кількість компаній</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Створити і перейти · демо', 'ok')}><Icon name="check" size={13} />Створити і перейти</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Portal404,
  Portal500,
  Portal403,
  PortalMaintenance,
  CmdKOverlay,
  BellDropdown,
  CompanySwitcherPop,
  NewCompanyWizard,
});
