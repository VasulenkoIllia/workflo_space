// portal-auth.jsx — Auth screens for Portal
// /login (default + error) · /register (2 steps) · /forgot-password (default + sent)
// /reset-password · /invite/:token

// ──────────────────────────────────────────────────────────────────────
// Shared scaffold
// ──────────────────────────────────────────────────────────────────────
function AuthShell({ children, wide, theme, accent }) {
  return (
    <div className="wfp-root wf-root" data-theme={theme} data-accent={accent} style={{ height: '100%' }}>
      <div className="wfp-auth">
        <div className={`wfp-auth-card${wide ? ' wfp-auth-card--wide' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AuthHeader({ title, sub }) {
  return (
    <React.Fragment>
      <div className="wfp-auth-mark">workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</div>
      <div>
        <div className="wfp-auth-h1">{title}</div>
        <div className="wfp-auth-sub">{sub}</div>
      </div>
    </React.Fragment>
  );
}

function AuthStatus({ left, right }) {
  return (
    <div className="wfp-auth-status">
      <span><span className="wfp-status-dot" />{left || 'all systems operational'}</span>
      <span>{right || '$ v0.6.2 · 2026.05.27'}</span>
    </div>
  );
}

function FormMsg({ kind = 'info', k, children }) {
  const iconByKind = { error: 'alert', success: 'check', info: 'alert' };
  return (
    <div className={`wfp-form-msg wfp-form-msg--${kind}`}>
      <span className="wfp-form-msg-icon"><Icon name={iconByKind[kind]} size={14} /></span>
      <div>
        {k && <span className="wfp-form-msg-k">// {k}</span>}
        {children}
      </div>
    </div>
  );
}

function WizardSteps({ steps, current }) {
  // steps: [{ id, label }]
  // current: index (0-based)
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <div className="wfp-wizard">
      <div className="wfp-wizard-row">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="wfp-wizard-step" data-on={i === current || undefined} data-done={i < current || undefined}>
              <span className="wfp-wizard-step-dot">{i < current ? <Icon name="check" size={10} /> : i + 1}</span>
              <span className="wfp-wizard-step-label">{s.label}</span>
            </div>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 1, background: 'var(--wf-border)' }} />}
          </React.Fragment>
        ))}
      </div>
      <div className="wfp-wizard-bar">
        <div className="wfp-wizard-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="wfp-auth-sub" style={{ marginTop: 4 }}>
        // крок {current + 1} з {steps.length} · {steps[current].label}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// OTP input — 6 single-digit boxes
// ──────────────────────────────────────────────────────────────────────
function OtpInput({ value = '427910', length = 6, error, autoFocusAt }) {
  // Render `length` boxes. Boxes filled up to `value.length` show the digit.
  // The first empty box gets the "current" focus ring.
  const filled = value.length;
  const focusAt = autoFocusAt !== undefined ? autoFocusAt : Math.min(filled, length - 1);
  return (
    <div className="wfp-otp-grid" data-error={error || undefined}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          className="wfp-otp-box"
          maxLength={1}
          defaultValue={i < filled ? value[i] : ''}
          data-filled={i < filled || undefined}
          data-current={i === focusAt && !error || undefined}
          inputMode="numeric"
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Method switcher — Email / Phone
// ──────────────────────────────────────────────────────────────────────
function MethodSwitch({ value, onChange }) {
  return (
    <div className="wfp-method-switch">
      <button className="wfp-method-switch-btn" data-on={value === 'email' || undefined} onClick={() => onChange?.('email')}>
        <Icon name="bell" size={12} />Email
      </button>
      <button className="wfp-method-switch-btn" data-on={value === 'phone' || undefined} onClick={() => onChange?.('phone')}>
        <Icon name="external" size={12} />Телефон · OTP
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /login — supports method (email/phone) + step + state
// ──────────────────────────────────────────────────────────────────────
function PortalLogin({ state = 'default', method = 'email', step = 1, theme, accent }) {
  const isError = state === 'error';

  // Email + password flow
  if (method === 'email') {
    return (
      <AuthShell theme={theme} accent={accent}>
        <AuthHeader title="Вхід у кабінет" sub="// portal.workflo.space" />

        <MethodSwitch value="email" />

        {isError && (
          <FormMsg kind="error" k="auth_failed">
            Невірний email або пароль. Залишилось 3 спроби.
          </FormMsg>
        )}

        <div className={`wfp-field${isError ? ' wfp-field--error' : ''}`}>
          <label>Email</label>
          <input type="email" defaultValue="olena@brunky.ua" />
        </div>
        <div className={`wfp-field${isError ? ' wfp-field--error' : ''}`}>
          <label>Пароль</label>
          <input type="password" defaultValue={isError ? 'wrongpass123' : '••••••••••••'} />
          <div className="wfp-field-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Caps Lock {isError ? 'увімкнено' : 'вимкнено'}</span>
            <a style={{ color: 'var(--wf-accent)', cursor: 'pointer' }}>забули пароль?</a>
          </div>
        </div>

        <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }}>Увійти</button>

        <div className="wfp-auth-foot" style={{ borderTop: '1px dashed var(--wf-border)', paddingTop: 14 }}>
          <span>немає акаунту?</span>
          <a>зареєструватися →</a>
        </div>

        <AuthStatus />
      </AuthShell>
    );
  }

  // Phone — step 1: enter phone number
  if (method === 'phone' && step === 1) {
    return (
      <AuthShell theme={theme} accent={accent}>
        <AuthHeader title="Вхід через SMS" sub="// надішлемо OTP-код на телефон" />

        <MethodSwitch value="phone" />

        <div className="wfp-field">
          <label>Мобільний телефон</label>
          <div className="wfp-phone-input">
            <div className="wfp-phone-input-cc">🇺🇦 +380</div>
            <input className="wfp-phone-input-num" defaultValue="50 123 84 12" />
          </div>
          <div className="wfp-field-hint">Введіть номер у міжнародному форматі</div>
        </div>

        <FormMsg kind="info" k="як це працює">
          Ми надішлемо 6-значний код у SMS. Код діє <strong>5 хвилин</strong>, працює один раз. Без паролю — лише код.
        </FormMsg>

        <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Надіслати код · демо', 'ok')}>
          <Icon name="send" size={13} />Надіслати код
        </button>

        <div className="wfp-auth-foot" style={{ borderTop: '1px dashed var(--wf-border)', paddingTop: 14 }}>
          <span>немає акаунту?</span>
          <a>зареєструватися →</a>
        </div>

        <AuthStatus />
      </AuthShell>
    );
  }

  // Phone — step 2: enter OTP from SMS
  if (method === 'phone' && step === 2) {
    return (
      <AuthShell theme={theme} accent={accent}>
        <AuthHeader title="Введіть код з SMS" sub="// 6 цифр · діє 4:32" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="wfp-otp-phone">
            <Icon name="check" size={11} color="var(--wf-success)" />
            +380 50 ••• 84 12
          </span>
          <a style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', cursor: 'pointer', textDecoration: 'underline dashed', textUnderlineOffset: 3 }}>
            змінити номер
          </a>
        </div>

        {isError ? (
          <React.Fragment>
            <OtpInput value="427915" error />
            <FormMsg kind="error" k="invalid_code">
              Невірний код. Залишилось <strong style={{ color: 'var(--wf-fg)' }}>2 спроби</strong>. Перевірте останнє SMS — старі коди не працюють.
            </FormMsg>
          </React.Fragment>
        ) : (
          <OtpInput value="4279" />
        )}

        <div className="wfp-otp-resend">
          <span>Не отримали? <a aria-disabled="true">надіслати ще раз · 0:47</a></span>
          <a>надіслати на email</a>
        </div>

        <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Підтвердити · демо', 'ok')}>
          <Icon name="check" size={13} />Підтвердити
        </button>

        <div className="wfp-auth-foot" style={{ borderTop: '1px dashed var(--wf-border)', paddingTop: 14 }}>
          <a>← використати email + пароль</a>
        </div>

        <AuthStatus left="OTP delivered · awaiting verification" right={`$ sid: ${isError ? 'kx9p' : 'mZ7h'}...`} />
      </AuthShell>
    );
  }

  // 2FA — after correct email+password, ask for OTP as second factor
  if (method === '2fa') {
    return (
      <AuthShell theme={theme} accent={accent}>
        <AuthHeader title="Двофакторне підтвердження" sub="// olena@brunky.ua · крок 2 з 2" />

        <FormMsg kind="success" k="password_ok">
          Пароль перевірено. Введіть код з SMS, щоб завершити вхід.
        </FormMsg>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="wfp-otp-phone">
            <Icon name="check" size={11} color="var(--wf-success)" />
            +380 50 ••• 84 12
          </span>
          <a style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', cursor: 'pointer' }}>
            використати backup-код
          </a>
        </div>

        <OtpInput value="42791" />

        <div className="wfp-otp-resend">
          <span>Не отримали? <a aria-disabled="true">ще раз · 0:38</a></span>
          <a>надіслати через Telegram</a>
        </div>

        <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Завершити вхід · демо', 'ok')}>
          <Icon name="check" size={13} />Завершити вхід
        </button>

        <div className="wfp-field" style={{ marginTop: 4 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
            <input type="checkbox" style={{ accentColor: 'var(--wf-accent-bg)' }} />
            <span>Запам'ятати цей пристрій на 30 днів</span>
          </label>
        </div>

        <AuthStatus left="2FA · sms challenge" right="$ device: macOS · Chrome" />
      </AuthShell>
    );
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────
// /register — 2-step wizard
// ──────────────────────────────────────────────────────────────────────
function PortalRegister({ step = 0, theme, accent }) {
  const steps = [
    { id: 'account', label: 'профіль' },
    { id: 'company', label: 'компанія' },
  ];

  return (
    <AuthShell theme={theme} accent={accent} wide>
      <AuthHeader
        title={step === 0 ? 'Створіть акаунт' : 'Розкажіть про компанію'}
        sub={step === 0
          ? '// 60 секунд · 0 ₴'
          : '// для рахунків і документів'}
      />

      <WizardSteps steps={steps} current={step} />

      {step === 0 && <RegisterStep1 />}
      {step === 1 && <RegisterStep2 />}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {step > 0 && <button className="wfp-btn" style={{ flex: '0 0 auto' }}>← Назад</button>}
        <button className="wfp-btn wfp-btn--primary" style={{ flex: 1, justifyContent: 'center' }}>
          {step === 0 ? 'Далі · крок 2 →' : 'Створити акаунт'}
        </button>
      </div>

      <div className="wfp-auth-foot">
        <span>вже маєте акаунт?</span>
        <a>увійти →</a>
      </div>

      <AuthStatus left="реєстрація відкрита" right="$ v0.6.2 · invite-free" />
    </AuthShell>
  );
}

function RegisterStep1() {
  return (
    <React.Fragment>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="wfp-field">
          <label>Ім'я</label>
          <input defaultValue="Олена" />
        </div>
        <div className="wfp-field">
          <label>Прізвище</label>
          <input defaultValue="Іваненко" />
        </div>
      </div>
      <div className="wfp-field">
        <label>Email</label>
        <input type="email" defaultValue="olena@brunky.ua" />
        <div className="wfp-field-hint">Цей email буде логіном · туди ж прийдуть рахунки</div>
      </div>
      <div className="wfp-field">
        <label>Пароль</label>
        <input type="password" defaultValue="••••••••••••" />
        <div className="wfp-field-hint wfp-field-hint--ok">
          ✓ 12+ символів · ✓ є цифра · ✓ є спецсимвол · strong
        </div>
      </div>
      <div className="wfp-field">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
          <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wf-accent-bg)' }} />
          <span>Я погоджуюсь з <a style={{ color: 'var(--wf-accent)', textDecoration: 'underline dashed', textUnderlineOffset: 3 }}>умовами використання</a> і <a style={{ color: 'var(--wf-accent)', textDecoration: 'underline dashed', textUnderlineOffset: 3 }}>privacy policy</a></span>
        </label>
      </div>
    </React.Fragment>
  );
}

function RegisterStep2() {
  return (
    <React.Fragment>
      <div className="wfp-field">
        <label>Назва компанії</label>
        <input defaultValue="ТОВ «Брунки»" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="wfp-field">
          <label>Тип</label>
          <select defaultValue="tov" style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }}>
            <option value="fop">ФОП</option>
            <option value="tov">ТОВ</option>
            <option value="other">Інше</option>
          </select>
        </div>
        <div className="wfp-field">
          <label>ЄДРПОУ / ІПН</label>
          <input defaultValue="42345678" />
        </div>
      </div>
      <div className="wfp-field">
        <label>Slug · посилання</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>
          <span style={{ color: 'var(--wf-fg-muted)' }}>portal.workflo.space/c/</span>
          <input defaultValue="brunky" style={{ flex: 1, border: 0, background: 'transparent', outline: 0, font: 'inherit', color: 'var(--wf-fg)', padding: 0 }} />
          <span style={{ color: 'var(--wf-success)', fontSize: 11 }}>✓ доступний</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="wfp-field">
          <label>Валюта рахунків</label>
          <select defaultValue="usd" style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }}>
            <option value="usd">USD ($)</option>
            <option value="uah">UAH (₴)</option>
            <option value="eur">EUR (€)</option>
          </select>
        </div>
        <div className="wfp-field">
          <label>Мова документів</label>
          <select defaultValue="ua" style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }}>
            <option value="ua">Українська</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <FormMsg kind="info" k="що далі">
        Адреса і IBAN можна додати пізніше у <strong>/settings/company</strong>. Без них не зможете отримати інвойс на ваше ім'я.
      </FormMsg>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /forgot-password — default + sent state
// ──────────────────────────────────────────────────────────────────────
function PortalForgotPassword({ state = 'default', theme, accent }) {
  if (state === 'sent') {
    return (
      <AuthShell theme={theme} accent={accent}>
        <AuthHeader
          title="Перевірте пошту"
          sub="// надіслали лист на olena@brunky.ua"
        />
        <FormMsg kind="success" k="email sent">
          Якщо такий акаунт існує, ви отримаєте лист з посиланням для скидання пароля. Посилання дійсне <strong>60 хвилин</strong>.
        </FormMsg>
        <div style={{ padding: '14px 16px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', border: '1px solid var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
          <div style={{ color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 6 }}>// не отримали лист?</div>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
            <li>Перевірте папку «Спам»</li>
            <li>Зачекайте 2-3 хвилини — пошта Gmail / iCloud буває повільною</li>
            <li>Спробуйте надіслати ще раз через <strong style={{ color: 'var(--wf-fg)' }}>47 секунд</strong></li>
          </ul>
        </div>
        <button className="wfp-btn" style={{ justifyContent: 'center' }} disabled onClick={() => window.wfToast && window.wfToast('Надіслати ще раз · 47 с · демо', 'ok')}>
          Надіслати ще раз · 47 с
        </button>
        <div className="wfp-auth-foot">
          <a>← повернутися на вхід</a>
          <a>змінити email</a>
        </div>
        <AuthStatus />
      </AuthShell>
    );
  }
  return (
    <AuthShell theme={theme} accent={accent}>
      <AuthHeader
        title="Забули пароль?"
        sub="// введіть email — надішлемо посилання"
      />
      <FormMsg kind="info" k="how it works">
        Ми надішлемо лист з одноразовим посиланням. Посилання діє 60 хвилин і працює один раз. Якщо у вас немає доступу до email — напишіть нам у <a style={{ color: 'var(--wf-accent)', textDecoration: 'underline dashed', textUnderlineOffset: 3 }}>@workflospace</a>.
      </FormMsg>
      <div className="wfp-field">
        <label>Email акаунту</label>
        <input type="email" defaultValue="olena@brunky.ua" />
      </div>
      <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Надіслати посилання · демо', 'ok')}>Надіслати посилання</button>
      <div className="wfp-auth-foot">
        <a>← повернутися на вхід</a>
        <a>немає акаунту? →</a>
      </div>
      <AuthStatus />
    </AuthShell>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /reset-password — after clicking link from email
// ──────────────────────────────────────────────────────────────────────
function PortalResetPassword({ theme, accent }) {
  return (
    <AuthShell theme={theme} accent={accent}>
      <AuthHeader
        title="Новий пароль"
        sub="// olena@brunky.ua · посилання дійсне ще 47:14"
      />
      <FormMsg kind="info" k="вимоги">
        12+ символів · хоча б одна цифра · хоча б один спецсимвол. Уникайте словникових слів та повторюваних послідовностей.
      </FormMsg>
      <div className="wfp-field">
        <label>Новий пароль</label>
        <input type="password" defaultValue="••••••••••••••" />
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <span style={{ height: 4, flex: 1, background: 'var(--wf-destructive)', borderRadius: 2 }} />
          <span style={{ height: 4, flex: 1, background: 'var(--wf-warning)', borderRadius: 2 }} />
          <span style={{ height: 4, flex: 1, background: 'var(--wf-accent-bg)', borderRadius: 2 }} />
          <span style={{ height: 4, flex: 1, background: 'var(--wf-success)', borderRadius: 2 }} />
          <span style={{ height: 4, flex: 1, background: 'var(--wf-success)', borderRadius: 2 }} />
        </div>
        <div className="wfp-field-hint wfp-field-hint--ok">strong · 14 символів</div>
      </div>
      <div className="wfp-field">
        <label>Підтвердження пароля</label>
        <input type="password" defaultValue="••••••••••••••" />
        <div className="wfp-field-hint wfp-field-hint--ok">✓ співпадає</div>
      </div>
      <div className="wfp-field">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
          <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wf-accent-bg)' }} />
          <span>Завершити всі інші сесії після зміни пароля</span>
        </label>
      </div>
      <button className="wfp-btn wfp-btn--primary" style={{ justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Зберегти пароль · демо', 'ok')}>Зберегти пароль</button>
      <AuthStatus left="посилання залишок: 47:14" />
    </AuthShell>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /invite/:token — join company as member
// ──────────────────────────────────────────────────────────────────────
function PortalInvite({ theme, accent }) {
  return (
    <AuthShell theme={theme} accent={accent} wide>
      <AuthHeader
        title="Запрошення в команду"
        sub="// portal.workflo.space/invite/k4h9xQ7p..."
      />
      <div className="wfp-invite-from">
        <div className="wfp-invite-from-av">ОІ</div>
        <div>
          <div className="wfp-invite-from-name">Олена Іваненко</div>
          <div className="wfp-invite-from-sub">owner · ТОВ «Брунки» · olena@brunky.ua</div>
        </div>
      </div>
      <div style={{ fontSize: 14, color: 'var(--wf-fg)', lineHeight: 1.55 }}>
        запрошує вас приєднатися до компанії <strong>ТОВ «Брунки»</strong> як <strong style={{ color: 'var(--wf-accent)' }}>member</strong>.
      </div>
      <div style={{ padding: '12px 14px', border: '1px solid var(--wf-border)', borderRadius: 6, background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>// ваші права як member</div>
        <div className="wfp-invite-perm">
          <span className="wfp-invite-perm-icon"><Icon name="check" size={13} /></span>
          <span>Бачити всі замовлення компанії та брати участь у чаті</span>
        </div>
        <div className="wfp-invite-perm">
          <span className="wfp-invite-perm-icon"><Icon name="check" size={13} /></span>
          <span>Завантажувати файли та читати документи</span>
        </div>
        <div className="wfp-invite-perm">
          <span className="wfp-invite-perm-icon"><Icon name="check" size={13} /></span>
          <span>Створювати нові замовлення від імені компанії</span>
        </div>
        <div className="wfp-invite-perm" style={{ opacity: 0.5 }}>
          <span className="wfp-invite-perm-icon" style={{ color: 'var(--wf-fg-muted)' }}>—</span>
          <span style={{ color: 'var(--wf-fg-muted)' }}>Дивитись фінанси і оплачувати рахунки (тільки owner)</span>
        </div>
        <div className="wfp-invite-perm" style={{ opacity: 0.5 }}>
          <span className="wfp-invite-perm-icon" style={{ color: 'var(--wf-fg-muted)' }}>—</span>
          <span style={{ color: 'var(--wf-fg-muted)' }}>Запрошувати інших членів і змінювати налаштування (тільки owner)</span>
        </div>
      </div>

      {/* Account section */}
      <div style={{ padding: '12px 14px', border: '1px dashed var(--wf-border-strong)', borderRadius: 6 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>// для прийняття</div>
        <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', marginBottom: 8 }}>
          Запрошення на email <strong style={{ color: 'var(--wf-fg)' }}>petro@brunky.ua</strong>. У вас вже є акаунт workflo з таким email?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn wfp-btn--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Прийняти і увійти · демо', 'ok')}>
            <Icon name="check" size={13} />Прийняти і увійти
          </button>
          <button className="wfp-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.wfToast && window.wfToast('Створити акаунт · демо', 'ok')}>
            Створити акаунт
          </button>
        </div>
      </div>

      <div className="wfp-auth-foot">
        <a>відхилити запрошення</a>
        <span>дійсне до <strong style={{ color: 'var(--wf-fg)' }}>03.06.2026</strong></span>
      </div>

      <AuthStatus left="invite valid · expires in 7 days" right="$ token: k4h9xQ7p..." />
    </AuthShell>
  );
}

Object.assign(window, {
  PortalLogin,
  PortalRegister,
  PortalForgotPassword,
  PortalResetPassword,
  PortalInvite,
  OtpInput,
  MethodSwitch,
});
