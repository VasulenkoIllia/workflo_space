// portal-settings.jsx — Portal settings pages
// For now focused on /settings/security with phone OTP verification.
// Full settings/* (profile, company, members, notifications) — comes in Block 7.

// ──────────────────────────────────────────────────────────────────────
// Settings nav (sub-sidebar inside content area)
// ──────────────────────────────────────────────────────────────────────
function SettingsNav({ active = 'profile' }) {
  const items = [
    { id: 'profile',       label: 'Профіль',       icon: 'users'    },
    { id: 'security',      label: 'Безпека',       icon: 'settings' },
    { id: 'notifications', label: 'Нотифікації',   icon: 'bell'     },
  ];
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 4 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 10px 6px' }}>
        // налаштування
      </div>
      {items.map((it) => (
        <a
          key={it.id}
          className="wfp-sb-item"
          data-on={it.id === active || undefined}
          style={{ borderRadius: 6, cursor: 'pointer' }}
          onClick={() => window.__portalSetNav && window.__portalSetNav(it.id)}
        >
          <span className="wfp-sb-item-icon"><Icon name={it.icon} size={15} /></span>
          <span>{it.label}</span>
        </a>
      ))}
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /settings/security — focused on phone verification flow
// step: 'overview' | 'change' (entering new phone) | 'otp' (entering code)
// ──────────────────────────────────────────────────────────────────────
function PortalSettingsSecurity({ step = 'overview' }) {
  const u = window.WFP_DATA.current_user;
  const sessions = window.WFP_DATA.auth_sessions;

  return (
    <React.Fragment>
      <PageHeader
        title="Налаштування"
        subtitle="// безпека · OTP, паролі, сесії"
      />

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        <SettingsNav active="security" />

        <div>
          {/* ─── Phone verification (focus of this iteration) ─── */}
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t">
                <Icon name="external" size={16} color="var(--wf-accent)" />
                Телефон для входу та OTP
              </div>
              <div className="wfp-set-section-h-aux">// SMS · primary 2FA channel</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">мобільний</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 500, letterSpacing: 0.4, color: 'var(--wf-fg)', fontFeatureSettings: '"tnum"', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                      {u.phone}
                    </span>
                    {u.phone_verified
                      ? <span className="wfp-verified-pill"><Icon name="check" size={11} />verified</span>
                      : <span className="wfp-unverified-pill"><Icon name="alert" size={11} />unverified</span>}
                  </div>
                  <div className="wfp-set-row-sub" style={{ marginTop: 6 }}>підтверджено {u.phone_verified_at} · використовується для SMS-OTP при вході та критичних діях</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Видалити · демо', 'ok')}>Видалити</button>
                  <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Змінити номер · демо', 'ok')}>Змінити номер</button>
                </div>
              </div>

              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">двофакторна</div>
                <div>
                  <div className="wfp-set-row-v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>SMS-код</strong>
                    <span className="wfp-verified-pill" style={{ background: 'color-mix(in oklab, var(--wf-accent) 12%, transparent)', color: 'var(--wf-accent)' }}>ON</span>
                  </div>
                  <div className="wfp-set-row-sub">після пароля попросимо OTP-код. Це також спрацьовує при платежах і змінах реквізитів.</div>
                </div>
                <div>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Backup-коди</button>
                </div>
              </div>
            </div>

            {/* Inline form — appears when step === 'change' or 'otp' */}
            {step === 'change' && (
              <div className="wfp-verify-form">
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  // зміна номеру · крок 1 з 2
                </div>
                <div className="wfp-field">
                  <label>Новий мобільний</label>
                  <div className="wfp-phone-input">
                    <div className="wfp-phone-input-cc">🇺🇦 +380</div>
                    <input className="wfp-phone-input-num" defaultValue="63 555 17 02" />
                  </div>
                  <div className="wfp-field-hint">Старий номер залишиться активним до підтвердження нового</div>
                </div>
                <FormMsg kind="info" k="що далі">
                  Надішлемо 6-значний код на новий номер. Після підтвердження він стане основним для входу та OTP.
                </FormMsg>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button>
                  <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Надіслати код · демо', 'ok')}>
                    <Icon name="send" size={13} />Надіслати код
                  </button>
                </div>
              </div>
            )}

            {step === 'otp' && (
              <div className="wfp-verify-form">
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  // зміна номеру · крок 2 з 2
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="wfp-otp-phone">
                    <Icon name="check" size={11} color="var(--wf-success)" />
                    +380 63 ••• 17 02
                  </span>
                  <a style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', cursor: 'pointer', textDecoration: 'underline dashed', textUnderlineOffset: 3 }}>
                    змінити номер
                  </a>
                </div>
                <OtpInput value="3812" />
                <div className="wfp-otp-resend">
                  <span>Не отримали? <a aria-disabled="true">ще раз · 0:42</a></span>
                  <a>надіслати голосовим викликом</a>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button>
                  <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Підтвердити номер · демо', 'ok')}>
                    <Icon name="check" size={13} />Підтвердити номер
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Password ─── */}
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t">
                <Icon name="settings" size={16} />
                Пароль
              </div>
              <div className="wfp-set-section-h-aux">// last change · {u.last_password_change}</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row" style={{ gridTemplateColumns: '200px 1fr auto' }}>
                <div className="wfp-set-row-k">пароль</div>
                <div>
                  <div className="wfp-set-row-v">••••••••••••</div>
                  <div className="wfp-set-row-sub">змінено 80 днів тому · радимо оновлювати раз на 90 днів</div>
                </div>
                <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Змінити пароль · демо', 'ok')}>Змінити пароль</button>
              </div>
            </div>
          </div>

          {/* ─── Telegram bind ─── */}
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t">
                <Icon name="external" size={16} color="#0891B2" />
                Telegram-бот
              </div>
              <div className="wfp-set-section-h-aux">// нотифікації + швидкий доступ</div>
            </div>
            <div className="wfp-set-section-body">
              <div className="wfp-set-section-row">
                <div className="wfp-set-row-k">прив'язаний</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 500, color: 'var(--wf-fg)', lineHeight: 1.2 }}>
                      {u.telegram_username}
                    </span>
                    <span className="wfp-verified-pill"><Icon name="check" size={11} />active</span>
                  </div>
                  <div className="wfp-set-row-sub" style={{ marginTop: 6 }}>бот @workflospace_bot · отримуєте сповіщення про статуси та нові документи</div>
                </div>
                <button className="wfp-btn">Від'єднати</button>
              </div>
            </div>
          </div>

          {/* ─── Active sessions ─── */}
          <div className="wfp-set-section">
            <div className="wfp-set-section-h">
              <div className="wfp-set-section-h-t">
                <Icon name="users" size={16} />
                Активні сесії
              </div>
              <div className="wfp-set-section-h-aux">// {sessions.length} пристроїв</div>
            </div>
            <div className="wfp-set-section-body" style={{ padding: 0 }}>
              {sessions.map((s) => (
                <div key={s.id} className="wfp-set-section-row" style={{ padding: '14px 20px', borderTop: s.id === 's1' ? 0 : '1px solid var(--wf-border)' }}>
                  <div className="wfp-set-row-k">
                    {s.current ? <span className="wfp-verified-pill">поточна</span> : <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>{s.last_seen}</span>}
                  </div>
                  <div>
                    <div className="wfp-set-row-v">{s.device}</div>
                    <div className="wfp-set-row-sub">{s.city} · IP {s.ip}</div>
                  </div>
                  {!s.current && <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Завершити · демо', 'ok')}>Завершити</button>}
                </div>
              ))}
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--wf-border)', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  // підозрюєте несанкціонований доступ? Вийдіть звідусіль і змініть пароль.
                </span>
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Завершити всі інші сесії · демо', 'ok')}>
                  Завершити всі інші сесії
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, {
  PortalSettingsSecurity,
  SettingsNav,
});
