// portal-team.jsx — /team page for Portal (members of active company)
// Also exports PortalSettings* sub-pages: profile, company, members, notifications

// ──────────────────────────────────────────────────────────────────────
// /team — public team view (members of active company)
// ──────────────────────────────────────────────────────────────────────
function PortalTeam() {
  const co = window.WFP_DATA.active_company;
  const members = window.WFP_DATA.company_members;
  const totalComments = members.reduce((s, m) => s + m.comments_count, 0);

  return (
    <React.Fragment>
      <PageHeader
        title="Команда"
        subtitle={`// учасники компанії ${co.name} · ${members.length} людей`}
      >
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Список учасників експортовано (CSV)', 'ok')}>Експорт списку</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfModal && window.wfModal({ title: 'Запросити учасника', subtitle: '// до компанії ' + co.name, fields: [{ key: 'email', label: 'Email', placeholder: 'colleague@company.com' }, { key: 'role', label: 'Роль', type: 'select', options: [['member', 'member — бачить замовлення'], ['owner', 'owner — повний доступ']] }], confirmLabel: 'Надіслати запрошення', note: 'Запрошення дійсне 7 днів. Owner може бачити фінанси й змінювати реквізити.', successToast: 'Запрошення надіслано' })}><Icon name="plus" size={13} />Запросити учасника</button>
      </PageHeader>

      <StatsRow>
        <Stat k="учасників"      v={members.length} sub={`1 owner · ${members.length - 1} member`} />
        <Stat k="активних ордерів" v={members.reduce((s, m) => s + m.active_orders, 0)} sub="спільно" kind="accent" />
        <Stat k="коментарів · місяць" v={totalComments} sub="в чатах задач" />
        <Stat k="з verified-телефоном" v={`${members.filter((m) => m.phone_verified).length} / ${members.length}`} sub="OTP working" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати учасника…">
        <button className="wfp-pill" data-on="true">всі ролі</button>
        <button className="wfp-pill">owner</button>
        <button className="wfp-pill">member</button>
      </FilterBar>

      <div>
        {members.map((m) => (
          <div key={m.id} className="wfp-member-row" data-me={m.is_me || undefined}>
            <span className="wfp-member-row-av" style={{ background: m.is_me ? 'var(--wf-accent-bg)' : 'var(--wf-fg)', color: m.is_me ? 'var(--wf-fg)' : 'var(--wf-bg)' }}>
              {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </span>
            <div>
              <div className="wfp-member-row-name">
                {m.name}
                {m.is_me && <span className="wfp-member-row-me">ви</span>}
              </div>
              <div className="wfp-member-row-sub">{m.email} · з {m.joined}</div>
            </div>
            <div>
              <span className={`wfp-role-pill wfp-role-pill--${m.role === 'owner' ? 'superadmin' : 'executor'}`}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                {m.role}
              </span>
            </div>
            <div style={{ textAlign: 'center' }}>
              {m.phone_verified
                ? <span className="wfp-verified-pill" style={{ padding: '2px 8px' }}><Icon name="check" size={10} />phone</span>
                : <span className="wfp-unverified-pill" style={{ padding: '2px 8px' }}><Icon name="alert" size={10} />no phone</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, textAlign: 'right' }}>
              <span style={{ color: 'var(--wf-fg)', fontWeight: 500 }}>{m.active_orders} активних</span>
              <span style={{ color: 'var(--wf-fg-muted)' }}>{m.comments_count} коментарів</span>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textAlign: 'right' }}>
              {m.last_active}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--wf-fg)' }}>// що бачить member:</strong>
        {' '}усі замовлення компанії, чат, файли, документи. <strong style={{ color: 'var(--wf-fg)' }}>// тільки owner може:</strong> запрошувати інших, бачити фінанси (рахунки/борг), змінювати реквізити компанії.
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/profile
// ──────────────────────────────────────────────────────────────────────
function PortalSettingsProfile() {
  const u = window.WFP_DATA.current_user;
  return (
    <React.Fragment>
      <PageHeader title="Налаштування" subtitle="// профіль · ваш особистий" />
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        <SettingsNav active="profile" />

        <div>
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t">
                <Icon name="users" size={16} />
                Особисті дані
              </div>
              <div className="wfp-set-section-h-aux">// видно тільки команді workflo</div>
            </div>
            <div className="wfp-set-section-body">
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, alignItems: 'start' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--wf-accent-bg)', color: 'var(--wf-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 36, fontWeight: 600, margin: '0 auto 8px' }}>ОІ</div>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Фото оновлено · демо', 'ok')}>Завантажити фото</button>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 6 }}>PNG/JPG · &le; 2 МБ</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="wfp-field"><label>Ім'я</label><input defaultValue="Олена" /></div>
                    <div className="wfp-field"><label>Прізвище</label><input defaultValue="Іваненко" /></div>
                  </div>
                  <div className="wfp-field">
                    <label>Email · логін</label>
                    <input defaultValue={u.email} />
                    <div className="wfp-field-hint">змінити email — через підтвердження старого і нового</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="wfp-field">
                      <label>Посада</label>
                      <input defaultValue="Директор" />
                    </div>
                    <div className="wfp-field">
                      <label>Telegram (опційно)</label>
                      <input defaultValue="@olena_ivanenko" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="settings" size={16} />Інтерфейс</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">мова</div>
                <div>
                  <div className="wfp-chip-group">
                    <button className="wfp-chip" data-on="true">🇺🇦 Українська</button>
                    <button className="wfp-chip">🇬🇧 English</button>
                  </div>
                  <div className="wfp-set-row-sub" style={{ marginTop: 6 }}>впливає на інтерфейс, не на мову документів (це у /settings/company)</div>
                </div>
                <div></div>
              </div>
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">тема</div>
                <div>
                  <div className="wfp-chip-group">
                    <button className="wfp-chip" data-on="true">☀ Light</button>
                    <button className="wfp-chip">☾ Dark</button>
                    <button className="wfp-chip">⚙ System</button>
                  </div>
                </div>
                <div></div>
              </div>
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">щільність</div>
                <div>
                  <div className="wfp-chip-group">
                    <button className="wfp-chip" data-on="true">Comfortable</button>
                    <button className="wfp-chip">Compact</button>
                  </div>
                  <div className="wfp-set-row-sub" style={{ marginTop: 6 }}>compact — більше інфо на екрані, менше повітря</div>
                </div>
                <div></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасовано', 'info')}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зміни збережено', 'ok')}>Зберегти</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/company — only for owner
// ──────────────────────────────────────────────────────────────────────
function PortalSettingsCompany() {
  const c = window.WFP_DATA.active_company;
  return (
    <React.Fragment>
      <PageHeader title="Налаштування" subtitle={`// компанія · ${c.name} · тільки owner`} />
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        <SettingsNav active="company" />

        <div>
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="building" size={16} />Основне</div>
              <div className="wfp-set-section-h-aux">// видно у документах</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-field" style={{ marginBottom: 12 }}>
                <label>Юридична назва</label>
                <input defaultValue={c.legal_name} />
                <div className="wfp-field-hint">точно як у реєстрі — використовується в рахунках і актах</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: 12, marginBottom: 12 }}>
                <div className="wfp-field"><label>Коротка назва</label><input defaultValue={c.name} /></div>
                <div className="wfp-field">
                  <label>Тип</label>
                  <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue={c.type}>
                    <option value="fop">ФОП</option>
                    <option value="tov">ТОВ</option>
                    <option value="other">Інше</option>
                  </select>
                </div>
                <div className="wfp-field"><label>ЄДРПОУ / ІПН</label><input defaultValue={c.tin} /></div>
              </div>
              <div className="wfp-field" style={{ marginBottom: 12 }}>
                <label>Юридична адреса</label>
                <input defaultValue={c.addr} />
              </div>
              <div className="wfp-field">
                <label>Директор / відповідальна особа</label>
                <input defaultValue={c.director} />
              </div>
            </div>
          </div>

          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="receipt" size={16} />Реквізити та документи</div>
              <div className="wfp-set-section-h-aux">// підставляються в інвойси</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-field" style={{ marginBottom: 12 }}>
                <label>IBAN</label>
                <input defaultValue={c.iban} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
              <div className="wfp-field" style={{ marginBottom: 12 }}>
                <label>Банк</label>
                <input defaultValue={c.bank} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="wfp-field">
                  <label>Валюта рахунків</label>
                  <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue={c.currency}>
                    <option value="usd">USD ($)</option>
                    <option value="uah">UAH (₴)</option>
                    <option value="eur">EUR (€)</option>
                  </select>
                </div>
                <div className="wfp-field">
                  <label>Мова документів</label>
                  <select style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }} defaultValue={c.doc_lang}>
                    <option value="ua">Українська</option>
                    <option value="en">English</option>
                    <option value="bilingual">Bilingual (UA + EN)</option>
                  </select>
                </div>
              </div>
              <div className="wfp-field">
                <label>Email для рахунків</label>
                <input defaultValue={c.invoice_email} />
                <div className="wfp-field-hint">всі invoice + act автоматично туди надсилаються (копія + до user'a)</div>
              </div>
            </div>
          </div>

          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="external" size={16} />Slug + посилання</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">slug</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--wf-fg-muted)' }}>portal.workflo.space/c/</span>
                    <input defaultValue={c.slug} style={{ flex: 1, border: 0, background: 'transparent', outline: 0, font: 'inherit', color: 'var(--wf-fg)', padding: 0 }} />
                    <span className="wfp-verified-pill" style={{ padding: '2px 8px' }}><Icon name="check" size={10} />зайнятий вами</span>
                  </div>
                  <div className="wfp-set-row-sub" style={{ marginTop: 6 }}>зміна slug = переключення посилання; старі URL працюють 30 днів через redirect</div>
                </div>
                <div></div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 18px', border: '1px solid color-mix(in oklab, var(--wf-destructive) 24%, var(--wf-border))', background: 'color-mix(in oklab, var(--wf-destructive) 4%, transparent)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wf-destructive)' }}>Видалити компанію</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)', marginTop: 4 }}>
                // незворотньо. Усі задачі, документи, історія платежів — будуть видалені через 30 днів. Експорт CSV перед видаленням рекомендується.
              </div>
            </div>
            <button className="wfp-btn wfp-btn--danger" onClick={() => window.wfConfirm && window.wfConfirm({ title: 'Видалити компанію?', message: 'Це незворотна дія. Усі дані компанії буде втрачено.', confirmLabel: 'Видалити', danger: true, successToast: 'Запит на видалення створено' })}>Видалити…</button>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасовано', 'info')}>Скасувати</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зміни збережено', 'ok')}>Зберегти зміни</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/members — admin view (owner only)
// ──────────────────────────────────────────────────────────────────────
function PortalSettingsMembers() {
  const members = window.WFP_DATA.company_members;
  const pending = window.WFP_DATA.company_pending_invites;

  return (
    <React.Fragment>
      <PageHeader title="Налаштування" subtitle="// учасники · керування · тільки owner" />
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        <SettingsNav active="members" />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Учасники · {members.length}</h2>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}>
                // 1 owner · {members.length - 1} member · {pending.length} запрошення pending
              </div>
            </div>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Запросити учасника · демо', 'ok')}><Icon name="plus" size={13} />Запросити учасника</button>
          </div>

          {members.map((m) => (
            <div key={m.id} className="wfp-member-row" data-me={m.is_me || undefined}>
              <span className="wfp-member-row-av" style={{ background: m.is_me ? 'var(--wf-accent-bg)' : 'var(--wf-fg)', color: m.is_me ? 'var(--wf-fg)' : 'var(--wf-bg)' }}>
                {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <div>
                <div className="wfp-member-row-name">{m.name}{m.is_me && <span className="wfp-member-row-me">ви</span>}</div>
                <div className="wfp-member-row-sub">{m.email}</div>
              </div>
              <div>
                <span className={`wfp-role-pill wfp-role-pill--${m.role === 'owner' ? 'superadmin' : 'executor'}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  {m.role}
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                {m.phone_verified
                  ? <span className="wfp-verified-pill" style={{ padding: '2px 8px' }}><Icon name="check" size={10} />phone</span>
                  : <span className="wfp-unverified-pill" style={{ padding: '2px 8px' }}><Icon name="alert" size={10} />pending</span>}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textAlign: 'right' }}>
                з {m.joined}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" disabled={m.is_me || m.role === 'owner'}>
                  {m.role === 'owner' ? 'owner' : 'Змінити роль'}
                </button>
                <button className="wfp-iconbtn" style={{ width: 28, height: 28, color: 'var(--wf-fg-muted)' }} disabled={m.is_me || m.role === 'owner'}>
                  <Icon name="alert" size={12} />
                </button>
              </div>
            </div>
          ))}

          {pending.length > 0 && (
            <React.Fragment>
              <h2 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 24, marginBottom: 10 }}>
                // запрошення pending · {pending.length}
              </h2>
              {pending.map((inv, i) => (
                <div key={i} className="wfp-member-row" style={{ borderStyle: 'dashed', opacity: 0.7 }}>
                  <span className="wfp-member-row-av" style={{ background: 'color-mix(in oklab, var(--wf-fg) 10%, var(--wf-bg))', color: 'var(--wf-fg-muted)' }}>
                    <Icon name="bell" size={18} />
                  </span>
                  <div>
                    <div className="wfp-member-row-name">{inv.email}</div>
                    <div className="wfp-member-row-sub">надіслано {inv.sent} · діє до {inv.expires} · від {inv.by}</div>
                  </div>
                  <div><span className="wfp-role-pill wfp-role-pill--executor">{inv.role}</span></div>
                  <div style={{ textAlign: 'center' }}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-warning)' }}>pending</span></div>
                  <div></div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Запрошення повторно надіслано', 'ok')}>Resend</button>
                    <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Запрошення скасовано', 'warn')}>Cancel</button>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )}

          <div style={{ marginTop: 18, padding: '12px 16px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--wf-fg)' }}>// як працюють ролі:</strong>
            {' '}<strong>owner</strong> бачить фінанси, реквізити, керує учасниками. <strong>member</strong> бачить замовлення, чат, файли, документи — але без фінансів. Не можна мати 2 owner; передача = окрема дія.
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/notifications — event × channel matrix
// ──────────────────────────────────────────────────────────────────────
function PortalSettingsNotifications() {
  const events = window.WFP_DATA.notification_events;
  const grouped = {};
  events.forEach((e) => {
    grouped[e.area] = grouped[e.area] || [];
    grouped[e.area].push(e);
  });

  return (
    <React.Fragment>
      <PageHeader title="Налаштування" subtitle="// нотифікації · email · telegram · in-app" />
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        <SettingsNav active="notifications" />

        <div>
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="bell" size={16} />Канали</div>
              <div className="wfp-set-section-h-aux">// глобальний on/off · якщо вимкнути канал — всі toggle нижче ігноруються</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                <Icon name="bell" size={18} color="var(--wf-fg)" />
                <div>
                  <div className="wfp-set-row-v" style={{ fontWeight: 500 }}>Email</div>
                  <div className="wfp-set-row-sub">olena@brunky.ua · invoice копії автоматично</div>
                </div>
                <NotifToggle on />
              </div>
              <div className="wfp-set-section-row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                <Icon name="external" size={18} color="#0891B2" />
                <div>
                  <div className="wfp-set-row-v" style={{ fontWeight: 500 }}>Telegram</div>
                  <div className="wfp-set-row-sub">@olena_ivanenko · через @workflospace_bot</div>
                </div>
                <NotifToggle on />
              </div>
              <div className="wfp-set-section-row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                <Icon name="inbox" size={18} color="var(--wf-accent)" />
                <div>
                  <div className="wfp-set-row-v" style={{ fontWeight: 500 }}>In-app</div>
                  <div className="wfp-set-row-sub">завжди — у вашому /inbox + bell-іконка</div>
                </div>
                <NotifToggle on disabled />
              </div>
            </div>
          </div>

          <div className="wfp-set-section" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="settings" size={16} />Події × канали</div>
              <div className="wfp-set-section-h-aux">// 14 типів подій</div>
            </div>
            <table className="wfp-notif-matrix">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Подія</th>
                  <th>Email</th>
                  <th>Telegram</th>
                  <th>In-app</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([area, items]) => (
                  <React.Fragment key={area}>
                    <tr><td className="wfp-notif-area" colSpan={4}>// {area}</td></tr>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td style={{ paddingLeft: 18 }}>{it.label}</td>
                        <td><NotifToggle on={it.defaults.email} /></td>
                        <td><NotifToggle on={it.defaults.telegram} /></td>
                        <td><NotifToggle on={it.defaults.inapp} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t"><Icon name="alert" size={16} />Не турбувати</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">тихі години</div>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input defaultValue="22:00" style={{ width: 80, height: 36, padding: '0 10px', border: '1px solid var(--wf-border)', borderRadius: 6, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} />
                    <span style={{ color: 'var(--wf-fg-muted)' }}>—</span>
                    <input defaultValue="08:00" style={{ width: 80, height: 36, padding: '0 10px', border: '1px solid var(--wf-border)', borderRadius: 6, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} />
                    <span className="wfp-set-row-sub" style={{ marginLeft: 8 }}>в цей час — лише urgent (mention + payment)</span>
                  </div>
                </div>
                <NotifToggle on />
              </div>
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">вихідні</div>
                <div>
                  <div className="wfp-set-row-v">Сб + Нд — без нотифікацій крім urgent</div>
                </div>
                <NotifToggle />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скинуто до дефолтних', 'info')}>Скинути до дефолтних</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зміни збережено', 'ok')}>Зберегти</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

function NotifToggle({ on, disabled }) {
  return (
    <label className="wfp-notif-toggle" data-on={on || undefined} style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" defaultChecked={on} disabled={disabled} />
      <span className="wfp-notif-toggle-track" />
    </label>
  );
}

Object.assign(window, {
  PortalTeam,
  PortalSettingsProfile,
  PortalSettingsCompany,
  PortalSettingsMembers,
  PortalSettingsNotifications,
});
