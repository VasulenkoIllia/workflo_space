// email-templates.jsx — 5 transactional emails for workflo.space (G1).
// Each renders inside a minimal email-client preview chrome so the owner sees
// exactly what lands in the client's inbox. Reuses --wf-* tokens + brand voice.
//
// Emails:
//   1. invite          — клієнта запросили в портал (set password)
//   2. order_received  — замовлення прийнято в роботу
//   3. invoice         — виставлено рахунок (pay CTA)
//   4. payment_ok      — оплату отримано (receipt, green)
//   5. deadline        — нагадування: дедлайн / дебіторка (warning)

function MailFoot() {
  return (
    <div className="wfm-foot">
      <div className="wfm-foot-mark">workflo<span className="dot">.</span>space</div>
      <div className="wfm-foot-links">
        <a href="#">Відкрити портал →</a>
        <a href="#">Документи</a>
        <a href="#">Підтримка</a>
        <a href="#">Telegram</a>
      </div>
      <div className="wfm-foot-fine">
        Ви отримали цей лист, бо є клієнтом workflo.space. Налаштувати сповіщення можна в{' '}
        <a href="#">/settings/notifications</a>.<br />
        ФОП Когут І. · Україна · workflo.space
      </div>
    </div>
  );
}

function MailHead({ tag }) {
  return (
    <div className="wfm-head">
      <span className="wfm-wordmark">workflo<span className="dot">.</span>space</span>
      <span className="wfm-head-tag">{tag}</span>
    </div>
  );
}

// ── client chrome wrapper ──
function MailClient({ from, fromEmail, subject, to, children }) {
  const initials = from.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="wfm-client">
      <div className="wfm-bar">
        <div className="wfm-bar-avatar">{initials}</div>
        <div className="wfm-bar-main">
          <div className="wfm-bar-from">
            {from} <span className="wfm-bar-email">&lt;{fromEmail}&gt;</span>
          </div>
          <div className="wfm-bar-subject">{subject}</div>
        </div>
        <div className="wfm-bar-to">→ {to}</div>
        <div className="wfm-bar-actions">
          <span className="wfm-bar-ico"><Icon name="external" size={14} /></span>
          <span className="wfm-bar-ico"><Icon name="download" size={14} /></span>
        </div>
      </div>
      <div className="wfm-scroll">{children}</div>
    </div>
  );
}

// ─────────────────────────── 1. INVITE ───────────────────────────
function EmailInvite() {
  return (
    <MailClient
      from="workflo.space" fromEmail="hello@workflo.space"
      subject="Вас запросили в портал Brunky · workflo.space"
      to="olena@brunky.ua"
    >
      <div className="wfm-email">
        <MailHead tag="// invite" />
        <div className="wfm-hero">
          <div className="wfm-hero-eyebrow"><span className="dot" /> запрошення в портал</div>
          <h1 className="wfm-hero-h1">Олено, ваш кабінет готовий</h1>
          <div className="wfm-hero-sub">Ілля надав вам доступ до простору <strong>Brunky</strong> — там замовлення, документи й чат в одному місці.</div>
        </div>
        <div className="wfm-body">
          <p className="wfm-p">Тепер усі рахунки, акти й статуси замовлень — не в пошті й не в чатах, а в одному кабінеті. Залишилось придумати пароль.</p>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Активувати кабінет <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Покликання діє 7 днів. Не спрацювало? <a href="#">Надіслати ще раз</a></div>
          </div>
          <div className="wfm-panel">
            <div className="wfm-panel-h"><span>// ваш доступ</span><span>brunky.workflo.space</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Логін</span><span className="wfm-row-v wfm-mono">olena@brunky.ua</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Роль</span><span className="wfm-row-v">Власник компанії</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Запросив</span><span className="wfm-row-v">Ілля · workflo.space</span></div>
          </div>
          <div className="wfm-note">Якщо ви не очікували цей лист — просто проігноруйте його, кабінет не активується без вашого пароля.</div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// ─────────────────────── 2. ORDER RECEIVED ───────────────────────
function EmailOrderReceived() {
  return (
    <MailClient
      from="workflo.space" fromEmail="orders@workflo.space"
      subject="ORD-2412 прийнято в роботу · CRM-воронки + 1С"
      to="olena@brunky.ua"
    >
      <div className="wfm-email">
        <MailHead tag="// order" />
        <div className="wfm-hero">
          <div className="wfm-hero-eyebrow"><span className="dot" /> замовлення прийнято</div>
          <h1 className="wfm-hero-h1">Беремо в роботу 🛠</h1>
          <div className="wfm-hero-sub">Ваше замовлення зафіксовано. Наступний крок — специфікація на погодження до 26.05.</div>
        </div>
        <div className="wfm-body">
          <p className="wfm-p">Дякую, Олено! Запит прийнято й призначено команду. Ось деталі — повна картка завжди доступна в кабінеті.</p>
          <div className="wfm-panel">
            <div className="wfm-panel-h"><span>// ORD-2412</span><span>створено 22.05.2026</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Назва</span><span className="wfm-row-v">CRM-воронки + інтеграція 1С</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Виконавці</span><span className="wfm-row-v">Ілля, Олег</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Дедлайн</span><span className="wfm-row-v wfm-mono">08.06.2026</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Модель</span><span className="wfm-row-v">Fixed · оцінка</span></div>
            <div className="wfm-row wfm-row--total"><span className="wfm-row-k">Орієнтовна вартість</span><span className="wfm-row-v">$4 200</span></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Відкрити замовлення <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Питання по скоупу? Напишіть прямо в чат замовлення.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// ─────────────────────────── 3. INVOICE ──────────────────────────
function EmailInvoice() {
  return (
    <MailClient
      from="workflo.space" fromEmail="billing@workflo.space"
      subject="Рахунок INV-2025-0418 · $4 200 · до 05.06"
      to="finance@brunky.ua"
    >
      <div className="wfm-email">
        <MailHead tag="// invoice" />
        <div className="wfm-hero">
          <div className="wfm-hero-eyebrow"><span className="dot" /> новий рахунок</div>
          <h1 className="wfm-hero-h1">Рахунок на $4 200</h1>
          <div className="wfm-hero-sub">За замовленням ORD-2412. PDF + акт додані до листа і збережені в кабінеті.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-panel">
            <div className="wfm-panel-h"><span>// INV-2025-0418</span><span>виставлено 28.05.2026</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Замовлення</span><span className="wfm-row-v wfm-mono">ORD-2412</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Опис</span><span className="wfm-row-v">CRM-воронки + 1С (етап 1/2)</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Термін оплати</span><span className="wfm-row-v wfm-mono">05.06.2026</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Курс НБУ</span><span className="wfm-row-v wfm-mono">≈ ₴173 040</span></div>
            <div className="wfm-row wfm-row--total"><span className="wfm-row-k">До сплати</span><span className="wfm-row-v">$4 200</span></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" data-kind="accent" href="#">Оплатити рахунок <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Або оплатіть за реквізитами у вкладеному PDF. Після оплати акт сформується автоматично.</div>
          </div>
          <div className="wfm-note">📎 Вкладення: <strong>INV-2025-0418.pdf</strong> · <strong>act-2025-0418.pdf</strong>. Оплата частинами — напишіть нам, домовимось.</div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// ───────────────────────── 4. PAYMENT OK ─────────────────────────
function EmailPaymentOk() {
  return (
    <MailClient
      from="workflo.space" fromEmail="billing@workflo.space"
      subject="Оплату отримано · INV-2025-0418 · дякуємо!"
      to="finance@brunky.ua"
    >
      <div className="wfm-email">
        <MailHead tag="// receipt" />
        <div className="wfm-hero" data-kind="ok">
          <div className="wfm-hero-eyebrow"><span className="dot" /> оплату підтверджено</div>
          <h1 className="wfm-hero-h1">Дякуємо, оплату отримано ✓</h1>
          <div className="wfm-hero-sub">Рахунок INV-2025-0418 закрито. Акт виконаних робіт уже в кабінеті й у цьому листі.</div>
        </div>
        <div className="wfm-body">
          <p className="wfm-p">Платіж на <strong>$4 200</strong> зараховано. Робота над ORD-2412 триває за графіком — наступне демо 02.06.</p>
          <div className="wfm-panel">
            <div className="wfm-panel-h"><span>// квитанція</span><span>зараховано 29.05.2026</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Рахунок</span><span className="wfm-row-v wfm-mono">INV-2025-0418</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Спосіб</span><span className="wfm-row-v">Банківський переказ</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Статус</span><span className="wfm-row-v" style={{ color: 'var(--wf-success)' }}>Сплачено повністю</span></div>
            <div className="wfm-row wfm-row--total"><span className="wfm-row-k">Сума</span><span className="wfm-row-v">$4 200</span></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Завантажити акт <Icon name="download" size={14} /></a>
            <div className="wfm-cta-sub">📎 act-2025-0418.pdf · підписаний електронно</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// ───────────────────────── 5. DEADLINE ───────────────────────────
function EmailDeadline() {
  return (
    <MailClient
      from="workflo.space" fromEmail="billing@workflo.space"
      subject="Нагадування: рахунок INV-2025-0414 прострочено на 6 днів"
      to="finance@brunky.ua"
    >
      <div className="wfm-email">
        <MailHead tag="// reminder" />
        <div className="wfm-hero" data-kind="warn">
          <div className="wfm-hero-eyebrow"><span className="dot" /> дружнє нагадування</div>
          <h1 className="wfm-hero-h1">Рахунок очікує оплати</h1>
          <div className="wfm-hero-sub">INV-2025-0414 на $2 200 мав бути сплачений до 23.05. Можливо, просто загубився — нагадуємо.</div>
        </div>
        <div className="wfm-body">
          <p className="wfm-p">Розуміємо, буває по-всякому. Якщо вже оплатили — дякуємо, проігноруйте лист (платіж міг ще не зайти). Якщо ні — ось зручне покликання.</p>
          <div className="wfm-panel">
            <div className="wfm-panel-h"><span>// INV-2025-0414</span><span style={{ color: 'var(--wf-warning)' }}>прострочено 6 дн</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Замовлення</span><span className="wfm-row-v wfm-mono">ORD-2408</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Термін був</span><span className="wfm-row-v wfm-mono">23.05.2026</span></div>
            <div className="wfm-row wfm-row--total"><span className="wfm-row-k">До сплати</span><span className="wfm-row-v">$2 200</span></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" data-kind="accent" href="#">Оплатити зараз <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Потрібна відстрочка чи оплата частинами? <a href="#">Напишіть нам</a> — завжди домовимось.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// ── shared: OTP / code block ──
function CodeBlock({ code }) {
  return (
    <div className="wfm-code">
      {code.split('').map((d, i) => (
        <span className="wfm-code-digit" data-hot={i === 0 ? 'true' : undefined} key={i}>{d}</span>
      ))}
    </div>
  );
}

// ═══════════════════════ AUTH & SECURITY ═══════════════════════

// 6. Email confirmation (verify)
function EmailVerify() {
  return (
    <MailClient from="workflo.space" fromEmail="no-reply@workflo.space" subject="Підтвердьте пошту · код 408 921" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// verify" />
        <div className="wfm-hero" data-kind="info">
          <div className="wfm-hero-eyebrow"><span className="dot" /> підтвердження пошти</div>
          <h1 className="wfm-hero-h1">Підтвердьте свою адресу</h1>
          <div className="wfm-hero-sub">Введіть код у вкладці, де ви реєструвались, або натисніть кнопку нижче.</div>
        </div>
        <div className="wfm-body">
          <CodeBlock code="408921" />
          <div className="wfm-code-expiry">код діє 15 хвилин · одноразовий</div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Підтвердити пошту <Icon name="check" size={14} /></a>
            <div className="wfm-cta-sub">Не реєструвались на workflo.space? Просто проігноруйте лист.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 7. Password reset
function EmailPasswordReset() {
  return (
    <MailClient from="workflo.space" fromEmail="no-reply@workflo.space" subject="Скидання паролю · workflo.space" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// reset" />
        <div className="wfm-hero" data-kind="info">
          <div className="wfm-hero-eyebrow"><span className="dot" /> скидання паролю</div>
          <h1 className="wfm-hero-h1">Створіть новий пароль</h1>
          <div className="wfm-hero-sub">Ми отримали запит на відновлення доступу до вашого кабінету. Якщо це були ви — продовжуйте.</div>
        </div>
        <div className="wfm-body">
          <p className="wfm-p">Натисніть кнопку, щоб задати новий пароль. Покликання діє <strong>1 годину</strong> й працює лише раз.</p>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Задати новий пароль <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Запит зроблено з IP 91.218.x.x · Київ, Україна</div>
          </div>
          <div className="wfm-note">🔒 Якщо ви не просили скидання — нічого не робіть, ваш пароль лишається без змін. За потреби <a href="#">повідомте нам</a>.</div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 8. Password changed (security confirmation)
function EmailPasswordChanged() {
  return (
    <MailClient from="workflo.space" fromEmail="security@workflo.space" subject="Ваш пароль змінено · workflo.space" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// security" />
        <div className="wfm-hero" data-kind="ok">
          <div className="wfm-hero-eyebrow"><span className="dot" /> безпека акаунту</div>
          <h1 className="wfm-hero-h1">Пароль успішно змінено ✓</h1>
          <div className="wfm-hero-sub">Це підтвердження, що пароль вашого кабінету щойно оновлено.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-sec">
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="clock" size={15} /></span><div><div className="wfm-sec-k">коли</div><div className="wfm-sec-v">29.05.2026 о 14:32</div></div></div>
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="globe" size={15} /></span><div><div className="wfm-sec-k">пристрій</div><div className="wfm-sec-v">Chrome · macOS · Київ</div></div></div>
          </div>
          <div className="wfm-note">Це були не ви? <a href="#">Негайно заблокуйте акаунт</a> — ми відкличемо всі активні сесії й допоможемо відновити доступ.</div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 9. New login detected (security alert)
function EmailNewLogin() {
  return (
    <MailClient from="workflo.space" fromEmail="security@workflo.space" subject="Новий вхід у ваш акаунт · перевірте" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// security" />
        <div className="wfm-hero" data-kind="alert">
          <div className="wfm-hero-eyebrow"><span className="dot" /> новий вхід виявлено</div>
          <h1 className="wfm-hero-h1">Вхід з нового пристрою</h1>
          <div className="wfm-hero-sub">Ми помітили вхід у ваш кабінет, якого раніше не бачили. Перевірте, будь ласка.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-sec">
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="mobile" size={15} /></span><div><div className="wfm-sec-k">пристрій</div><div className="wfm-sec-v">iPhone · Safari · iOS 18</div></div></div>
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="globe" size={15} /></span><div><div className="wfm-sec-k">локація · IP</div><div className="wfm-sec-v">Львів, Україна · 188.x.x.x</div></div></div>
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="clock" size={15} /></span><div><div className="wfm-sec-k">час</div><div className="wfm-sec-v">29.05.2026 о 09:11</div></div></div>
          </div>
          <p className="wfm-p">Це були ви? Тоді все гаразд, нічого робити не потрібно.</p>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" data-kind="accent" href="#">Це не я — захистити акаунт <Icon name="shield" size={14} /></a>
            <div className="wfm-cta-sub">Кнопка відкличе сесію й попросить змінити пароль.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 10. One-time login code (2FA)
function EmailOtp() {
  return (
    <MailClient from="workflo.space" fromEmail="no-reply@workflo.space" subject="Код для входу: 73 04 19" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// 2fa" />
        <div className="wfm-hero" data-kind="info">
          <div className="wfm-hero-eyebrow"><span className="dot" /> одноразовий код</div>
          <h1 className="wfm-hero-h1">Ваш код для входу</h1>
          <div className="wfm-hero-sub">Двофакторна автентифікація. Введіть цей код, щоб завершити вхід.</div>
        </div>
        <div className="wfm-body">
          <CodeBlock code="730419" />
          <div className="wfm-code-expiry">код діє 5 хвилин</div>
          <div className="wfm-note">🔒 Нікому не повідомляйте цей код. Співробітники workflo.space ніколи не запитують його в чаті чи телефоном.</div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 11. Email change confirmation
function EmailChange() {
  return (
    <MailClient from="workflo.space" fromEmail="no-reply@workflo.space" subject="Підтвердьте нову пошту · workflo.space" to="olena.new@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// email change" />
        <div className="wfm-hero" data-kind="info">
          <div className="wfm-hero-eyebrow"><span className="dot" /> зміна email</div>
          <h1 className="wfm-hero-h1">Підтвердьте нову адресу</h1>
          <div className="wfm-hero-sub">Ви змінюєте пошту для входу в кабінет. Підтвердьте, що ця адреса ваша.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-sec">
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="mail" size={15} /></span><div><div className="wfm-sec-k">було</div><div className="wfm-sec-v wfm-mono">olena@brunky.ua</div></div></div>
            <div className="wfm-sec-row"><span className="wfm-sec-ico"><Icon name="mail" size={15} color="var(--wf-accent)" /></span><div><div className="wfm-sec-k">стане</div><div className="wfm-sec-v wfm-mono">olena.new@brunky.ua</div></div></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Підтвердити нову пошту <Icon name="check" size={14} /></a>
            <div className="wfm-cta-sub">До підтвердження вхід працює зі старою адресою. Покликання діє 24 години.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// ═══════════════════════ SYSTEM & INFO ═══════════════════════

// 12. Team member invite (workspace, not client)
function EmailTeamInvite() {
  return (
    <MailClient from="Ілля · workflo.space" fromEmail="team@workflo.space" subject="Ілля запрошує вас у команду workflo.space" to="oleh@gmail.com">
      <div className="wfm-email">
        <MailHead tag="// team invite" />
        <div className="wfm-hero">
          <div className="wfm-hero-eyebrow"><span className="dot" /> запрошення в команду</div>
          <h1 className="wfm-hero-h1">Олеже, приєднуйся до команди</h1>
          <div className="wfm-hero-sub">Ілля запрошує вас у робочий простір <strong>workflo.space</strong> як виконавця підрозділу Development.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-panel">
            <div className="wfm-panel-h"><span>// деталі ролі</span><span>work.workflo.space</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Роль</span><span className="wfm-row-v">Виконавець · executor</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Підрозділ</span><span className="wfm-row-v">Development</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Ставка</span><span className="wfm-row-v wfm-mono">$28 / год</span></div>
            <div className="wfm-row"><span className="wfm-row-k">Запросив</span><span className="wfm-row-v">Ілля Когут · owner</span></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Прийняти запрошення <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Покликання діє 7 днів. Після прийняття створите пароль і налаштуєте профіль.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 13. New message / mention
function EmailMention() {
  return (
    <MailClient from="workflo.space" fromEmail="notify@workflo.space" subject="Олег згадав вас у ORD-2412" to="illia@workflo.space">
      <div className="wfm-email">
        <MailHead tag="// mention" />
        <div className="wfm-hero" data-kind="info">
          <div className="wfm-hero-eyebrow"><span className="dot" /> нове повідомлення</div>
          <h1 className="wfm-hero-h1">Вас згадали в обговоренні</h1>
          <div className="wfm-hero-sub">Олег написав у внутрішньому чаті замовлення <strong>ORD-2412</strong>.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-quote">
            <div className="wfm-quote-who">Олег · 29.05 о 13:48 · 🔒 внутрішнє</div>
            <div className="wfm-quote-txt"><span className="mention">@illia</span> глянь, чи їхня версія 1С 8.3 БП підтримує REST через ВЕБ-сервіси? Якщо так — закриємо інтеграцію сьогодні.</div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Відповісти в чаті <Icon name="send" size={13} /></a>
            <div className="wfm-cta-sub">Відповісти можна прямо з кабінету · ORD-2412</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 14. Document ready (act / spec generated)
function EmailDocReady() {
  return (
    <MailClient from="workflo.space" fromEmail="docs@workflo.space" subject="Документ готовий · Специфікація ORD-2412" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// document" />
        <div className="wfm-hero">
          <div className="wfm-hero-eyebrow"><span className="dot" /> документ готовий</div>
          <h1 className="wfm-hero-h1">Специфікація на погодження</h1>
          <div className="wfm-hero-sub">Підготували специфікацію по ORD-2412. Перегляньте й підтвердьте, щоб ми почали роботу.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-list">
            <div className="wfm-list-row">
              <span className="wfm-sec-ico"><Icon name="file" size={15} /></span>
              <div className="wfm-list-main"><div className="wfm-list-t">spec-ord-2412.pdf</div><div className="wfm-list-sub">специфікація · 4 сторінки · 124 КБ</div></div>
              <Icon name="download" size={15} color="var(--wf-fg-muted)" />
            </div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" data-kind="accent" href="#">Переглянути й погодити <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Після погодження сформуємо рахунок і візьмемо в роботу.</div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

// 15. Weekly digest
function EmailDigest() {
  return (
    <MailClient from="workflo.space" fromEmail="digest@workflo.space" subject="Ваш тиждень у workflo · 22–29 травня" to="olena@brunky.ua">
      <div className="wfm-email">
        <MailHead tag="// digest" />
        <div className="wfm-hero" data-kind="info">
          <div className="wfm-hero-eyebrow"><span className="dot" /> тижневий дайджест</div>
          <h1 className="wfm-hero-h1">Ваш тиждень у цифрах</h1>
          <div className="wfm-hero-sub">Короткий звіт по Brunky за 22–29 травня. Повна картина — в кабінеті.</div>
        </div>
        <div className="wfm-body">
          <div className="wfm-digest">
            <div className="wfm-digest-cell"><div className="wfm-digest-v">3</div><div className="wfm-digest-k">активних</div></div>
            <div className="wfm-digest-cell"><div className="wfm-digest-v" data-accent="true">1</div><div className="wfm-digest-k">завершено</div></div>
            <div className="wfm-digest-cell"><div className="wfm-digest-v">$4.2k</div><div className="wfm-digest-k">оплачено</div></div>
          </div>
          <div className="wfm-list">
            <div className="wfm-list-row"><span className="wfm-list-dot" /><div className="wfm-list-main"><div className="wfm-list-t">ORD-2412 · специфікація на погодженні</div><div className="wfm-list-sub">потребує вашої дії</div></div><span className="wfm-list-v" style={{ color: 'var(--wf-warning)' }}>дія</span></div>
            <div className="wfm-list-row"><span className="wfm-list-dot" /><div className="wfm-list-main"><div className="wfm-list-t">INV-2025-0418 · оплачено</div><div className="wfm-list-sub">29.05 · дякуємо!</div></div><span className="wfm-list-v">$4.2k</span></div>
            <div className="wfm-list-row"><span className="wfm-list-dot" /><div className="wfm-list-main"><div className="wfm-list-t">2 нові повідомлення</div><div className="wfm-list-sub">у ORD-2410, ORD-2412</div></div></div>
          </div>
          <div className="wfm-cta-wrap">
            <a className="wfm-cta" href="#">Відкрити кабінет <Icon name="chev_r" size={14} /></a>
            <div className="wfm-cta-sub">Не хочете щотижневі звіти? <a href="#">Налаштувати сповіщення</a></div>
          </div>
        </div>
        <MailFoot />
      </div>
    </MailClient>
  );
}

Object.assign(window, {
  EmailInvite, EmailOrderReceived, EmailInvoice, EmailPaymentOk, EmailDeadline,
  EmailVerify, EmailPasswordReset, EmailPasswordChanged, EmailNewLogin, EmailOtp, EmailChange,
  EmailTeamInvite, EmailMention, EmailDocReady, EmailDigest,
});
