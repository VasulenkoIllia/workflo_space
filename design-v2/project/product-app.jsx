// product-app.jsx — root for workflo-product.html
// Tabs: [ portal ] [ workspace ] [ documents ]
// Each tab is its own DesignCanvas with artboards. Tweaks panel shared.

const PRODUCT_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "lang": "ua",
  "theme": "light",
  "accent": "lime",
  "density": "comfortable",
  "tab": "portal",
  "kanbanMode": "board",
  "dataState": "filled"
}/*EDITMODE-END*/;

const PRODUCT_TABS = [
  { id: 'portal',    label: 'portal',    sub: 'клієнти · мульти-компанія' },
  { id: 'workspace', label: 'workspace', sub: 'команда · owner + executors' },
  { id: 'documents', label: 'documents', sub: 'pdf · invoice · акти' },
  { id: 'brandbook', label: 'brandbook', sub: 'компонентна бібліотека' },
];

// ─── Tweaks panel for the product file ───
function ProductTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Surface" />
      <TweakRadio
        label="Theme"
        value={tweaks.theme}
        options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        onChange={(v) => setTweak('theme', v)}
      />
      <TweakSelect
        label="Accent"
        value={tweaks.accent}
        options={[
          { value: 'lime',    label: '● Lime · default' },
          { value: 'amber',   label: '● Amber CRT' },
          { value: 'green',   label: '● Phosphor green' },
          { value: 'cyan',    label: '● Cyan' },
          { value: 'magenta', label: '● Magenta' },
          { value: 'orange',  label: '● Orange' },
        ]}
        onChange={(v) => setTweak('accent', v)}
      />
      <TweakRadio
        label="Density"
        value={tweaks.density}
        options={[{ value: 'comfortable', label: 'Comfort' }, { value: 'compact', label: 'Compact' }]}
        onChange={(v) => setTweak('density', v)}
      />
      <TweakSection label="Content" />
      <TweakRadio
        label="Мова"
        value={tweaks.lang}
        options={['ua', 'en']}
        onChange={(v) => setTweak('lang', v)}
      />
      <TweakSelect
        label="Data state"
        value={tweaks.dataState}
        options={[
          { value: 'filled',  label: 'Filled · з даними' },
          { value: 'empty',   label: 'Empty · без даних' },
          { value: 'loading', label: 'Loading · skeletons' },
        ]}
        onChange={(v) => setTweak('dataState', v)}
      />
      <TweakSection label="Workspace" />
      <TweakRadio
        label="Kanban mode"
        value={tweaks.kanbanMode}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'list',  label: 'List' },
          { value: 'time',  label: 'Time' },
        ]}
        onChange={(v) => setTweak('kanbanMode', v)}
      />
      <TweakSection label="Navigation" />
      <TweakSelect
        label="Tab"
        value={tweaks.tab}
        options={PRODUCT_TABS.map((t) => ({ value: t.id, label: t.label }))}
        onChange={(v) => setTweak('tab', v)}
      />
    </TweaksPanel>
  );
}

// Wrap a screen in an artboard-friendly container. Always uses the AppShell.
// Pass `kind` (portal/workspace), `active` (active nav item id), `crumbs`,
// `aesthetic` (A=terminal-window chrome, B=clean shell).
function Frame({ kind, active, crumbs, aesthetic, theme, accent, density, windowTitle, children }) {
  return (
    <AppShell
      kind={kind}
      active={active}
      crumbs={crumbs}
      aesthetic={aesthetic}
      theme={theme}
      accent={accent}
      density={density}
      windowTitle={windowTitle}
    >
      {children}
    </AppShell>
  );
}

// Empty-state wrapper for "Empty" preview
function EmptyStatePreview({ kind, title, sub }) {
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">{title}</h1>
          <div className="wfp-ph-sub">// порожньо · empty state preview</div>
        </div>
      </div>
      <div className="wfp-empty">
        <div className="wfp-empty-glyph">{kind === 'portal' ? '/\\_/\\\n( o.o )\n > ^ <' : '$ ls\n# empty'}</div>
        <div className="wfp-empty-t">{title} ще порожнє</div>
        <div className="wfp-empty-sub">{sub}</div>
        <div style={{ marginTop: 14 }}>
          <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Створити перше · демо', 'ok')}><Icon name="plus" size={14} />Створити перше</button>
        </div>
      </div>
    </React.Fragment>
  );
}

// Loading-state preview — skeletons
function LoadingStatePreview({ rows = 5 }) {
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <span className="wfp-sk" style={{ width: 180, height: 22 }} />
          <span className="wfp-sk" style={{ width: 260, height: 12, marginTop: 8 }} />
        </div>
      </div>
      <div className="wfp-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="wfp-stat" key={i}>
            <span className="wfp-sk" style={{ width: 90, height: 11 }} />
            <span className="wfp-sk" style={{ width: 70, height: 26, marginTop: 6 }} />
            <span className="wfp-sk" style={{ width: 120, height: 10, marginTop: 6 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div className="wfp-order-row" key={i} style={{ pointerEvents: 'none' }}>
            <span className="wfp-sk" style={{ width: 80, height: 12 }} />
            <div>
              <span className="wfp-sk" style={{ width: '70%', height: 14 }} />
              <span className="wfp-sk" style={{ width: 140, height: 10, marginTop: 6 }} />
            </div>
            <span className="wfp-sk" style={{ width: 100, height: 12 }} />
            <span className="wfp-sk" style={{ width: 70, height: 12 }} />
            <span className="wfp-sk" style={{ width: 60, height: 12 }} />
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function pickContent(screen, tweaks) {
  if (tweaks.dataState === 'empty') {
    return <EmptyStatePreview kind={screen.kind} title={screen.title} sub={screen.emptySub} />;
  }
  if (tweaks.dataState === 'loading') {
    return <LoadingStatePreview />;
  }
  return screen.render(tweaks);
}

// ─── Sections per tab ───
function PortalSection({ tweaks }) {
  const common = { theme: tweaks.theme, accent: tweaks.accent, density: tweaks.density };
  const bg = tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9';

  return (
    <React.Fragment>
      <DCSection
        id="portal-auth"
        title="01 · Auth · Вхід / Реєстрація / Forgot / Reset / Invite"
        subtitle="Login підтримує 2 методи: Email+пароль і Телефон+SMS-OTP (passwordless). При увімкненому 2FA після пароля додається OTP-крок. Register · Forgot/Reset · Invite."
      >
        <DCArtboard id="p-login" label="/login · email + password" width={1200} height={820} style={{ background: bg }}>
          <PortalLogin theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-login-error" label="/login · помилка пароля" width={1200} height={860} style={{ background: bg }}>
          <PortalLogin state="error" theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-login-phone-1" label="/login · phone + OTP — крок 1: номер" width={1200} height={860} style={{ background: bg }}>
          <PortalLogin method="phone" step={1} theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-login-phone-2" label="/login · phone + OTP — крок 2: код з SMS" width={1200} height={860} style={{ background: bg }}>
          <PortalLogin method="phone" step={2} theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-login-phone-2-err" label="/login · phone + OTP — невірний код" width={1200} height={900} style={{ background: bg }}>
          <PortalLogin method="phone" step={2} state="error" theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-login-2fa" label="/login · 2FA після пароля (OTP-крок)" width={1200} height={900} style={{ background: bg }}>
          <PortalLogin method="2fa" theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-register-1" label="/register · крок 1 — профіль" width={1200} height={900} style={{ background: bg }}>
          <PortalRegister step={0} theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-register-2" label="/register · крок 2 — компанія" width={1200} height={960} style={{ background: bg }}>
          <PortalRegister step={1} theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-forgot" label="/forgot-password · default" width={1200} height={820} style={{ background: bg }}>
          <PortalForgotPassword theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-forgot-sent" label="/forgot-password · лист надіслано" width={1200} height={840} style={{ background: bg }}>
          <PortalForgotPassword state="sent" theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-reset" label="/reset-password · новий пароль" width={1200} height={900} style={{ background: bg }}>
          <PortalResetPassword theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>

        <DCArtboard id="p-invite" label="/invite/:token · приєднання до команди" width={1200} height={960} style={{ background: bg }}>
          <PortalInvite theme={tweaks.theme} accent={tweaks.accent} />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-settings-security"
        title="01 · Auth · Settings → Security (phone-verify + 2FA + sessions)"
        subtitle="Сторінка налаштувань безпеки з акцентом на телефонній верифікації. Inline-форма зміни номера: крок 1 (новий номер) → крок 2 (OTP-код). Решта settings/* — у наступних блоках."
      >
        <DCArtboard id="p-settings-security" label="/settings/security · загальний вигляд (номер verified)" width={1440} height={1080} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'security']} {...common}>
            <PortalSettingsSecurity step="overview" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-settings-security-change" label="/settings/security · зміна номеру — крок 1" width={1440} height={1280} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'security']} {...common}>
            <PortalSettingsSecurity step="change" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-settings-security-otp" label="/settings/security · зміна номеру — крок 2 (OTP)" width={1440} height={1320} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'security']} {...common}>
            <PortalSettingsSecurity step="otp" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-inbox"
        title="02 · Інбокс · Глобальний інбокс"
        subtitle="Зведений потік повідомлень з усіх замовлень + системні. Master-detail: фільтри (усі / непрочитані / @згадки / system), список з kind-міткою (chat/mention/status/doc/payment/marketing), детальний контекст справа з quick reply і кнопкою «Відкрити замовлення →»."
      >
        <DCArtboard id="p-inbox-all" label="/inbox · усі повідомлення (відкрито chat-thread)" width={1600} height={1200} style={{ background: bg }}>
          <Frame kind="portal" active="inbox" crumbs={['portal', 'інбокс']} {...common}>
            <PortalInbox filter="all" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-inbox-mentions" label="/inbox · @згадки" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="portal" active="inbox" crumbs={['portal', 'інбокс', '@згадки']} {...common}>
            <PortalInbox filter="mentions" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-inbox-system" label="/inbox · system + marketing" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="portal" active="inbox" crumbs={['portal', 'інбокс', 'system']} {...common}>
            <PortalInbox filter="system" selectedId="pi6" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-orders"
        title="03 · Замовлення · Список"
        subtitle="Список і деталі. Один екран — 3 контексти через таби: Чат (history + IRC-input + банер pending_approval), Файли (drag&drop upload + список), Документи (PDF-и пов'язані з замовленням + auto-generated пояснення)."
      >
        <DCArtboard id="p-orders" label="/orders — список замовлень · фінал" width={1440} height={1000} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal.workflo.space', 'orders']} {...common}>
            <PortalOrders />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-order-chat" label="/orders/:id · Чат + банер pending_approval" width={1440} height={1320} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'ORD-2412']} {...common}>
            <PortalOrderDetail initialTab="chat" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-order-files" label="/orders/:id · Файли" width={1440} height={1280} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'ORD-2412']} {...common}>
            <PortalOrderDetail initialTab="files" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-order-docs" label="/orders/:id · Документи" width={1440} height={1280} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'ORD-2412']} {...common}>
            <PortalOrderDetail initialTab="docs" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-order-new"
        title="03 · Замовлення · Створення (форма + chat-bot)"
        subtitle="Два підходи. Final — form-based з side-preview, що оновлюється live. Alternative — chat-style intake з ботом workflo (бот ставить питання — клієнт відповідає). Чат-формат корисний для тих хто не любить форми + для Telegram-бота на майбутнє."
      >
        <DCArtboard id="p-order-new" label="/orders/new · form-based (final)" width={1600} height={1900} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'new']} {...common}>
            <PortalOrderNew />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-order-new-chat" label="/orders/new · chat-bot intake (alt)" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'new']} {...common}>
            <PortalOrderNewChat />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-order-detail-alt"
        title="03 · Замовлення · Деталі (focused layout)"
        subtitle="Compact stats-strip зверху замість sticky aside. Чат на повну ширину. Деталі/Activity як окремі таби (а не sidecards). Краще для глибокої роботи з чатом — менше відволікання."
      >
        <DCArtboard id="p-order-alt-chat" label="alt · /orders/:id · вкладка Чат" width={1440} height={1400} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'ORD-2412']} {...common}>
            <PortalOrderDetailAlt initialTab="chat" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-order-alt-details" label="alt · /orders/:id · вкладка Деталі (інлайн)" width={1440} height={1200} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders', 'ORD-2412']} {...common}>
            <PortalOrderDetailAlt initialTab="details" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-billing"
        title="04 · Фінанси · Рахунки / Платежі / Recurring"
        subtitle="Три вкладки: Рахунки (invoices список з PDF), Платежі (всі incoming — від клієнта + loyalty/referral bonus з кольоровим маркуванням типу), Recurring (підписки з run-rate і наступним charge). Sticky-картка реквізитів справа."
      >
        <DCArtboard id="p-bill-invoices" label="/billing · Рахунки" width={1440} height={1000} style={{ background: bg }}>
          <Frame kind="portal" active="billing" crumbs={['portal', 'фінанси']} {...common}>
            <PortalBilling initialTab="invoices" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-bill-payments" label="/billing · Платежі" width={1440} height={1000} style={{ background: bg }}>
          <Frame kind="portal" active="billing" crumbs={['portal', 'фінанси']} {...common}>
            <PortalBilling initialTab="payments" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-bill-recurring" label="/billing · Recurring" width={1440} height={1100} style={{ background: bg }}>
          <Frame kind="portal" active="billing" crumbs={['portal', 'фінанси']} {...common}>
            <PortalBilling initialTab="recurring" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-wallet"
        title="04 · Фінанси · Гаманець клієнта (G8)"
        subtitle="Подвійний баланс: бонусний (з рефералів/вручну) + грошовий (AR — рахунки vs оплати). Вкладки: транзакції (ledger з running-балансом + алокаціями), виписка (єдиний timeline charges/payments/bonuses), правила."
      >
        <DCArtboard id="p-wallet-tx" label="/wallet — баланс + транзакції" width={1280} height={920} style={{ background: bg }}>
          <Frame kind="portal" active="wallet" crumbs={['portal', 'гаманець']} {...common}>
            <WalletPortal tab="transactions" />
          </Frame>
        </DCArtboard>
        <DCArtboard id="p-wallet-statement" label="/wallet — виписка (timeline)" width={1280} height={760} style={{ background: bg }}>
          <Frame kind="portal" active="wallet" crumbs={['portal', 'гаманець', 'виписка']} {...common}>
            <WalletPortal tab="statement" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-loyalty-ref"
        title="05 · Лояльність · Тіри + Реферали"
        subtitle="/loyalty — 5-tier ladder з visual progress, історія бонусів, spending chart, правила нарахування. /referrals — посилання з кодом, 3-step explainer, список запрошених (masked), правила: тільки той хто привів отримує бонус; реферал — знижку на 1-ше замовлення."
      >
        <DCArtboard id="p-loyalty" label="/loyalty · tier ladder + progress + bonus history" width={1600} height={1500} style={{ background: bg }}>
          <Frame kind="portal" active="loyalty" crumbs={['portal', 'лояльність']} {...common}>
            <PortalLoyalty />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-referrals" label="/referrals · link + stats + list + rules" width={1600} height={1400} style={{ background: bg }}>
          <Frame kind="portal" active="referrals" crumbs={['portal', 'реферали']} {...common}>
            <PortalReferrals />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-team-settings"
        title="06 · Команда · Команда + Налаштування"
        subtitle="/team — учасники активної компанії з ролями і активністю. /settings/profile — особисті дані + інтерфейс. /settings/company — реквізити (тільки owner). /settings/members — управління учасниками з invite. /settings/notifications — 14 подій × 3 канали матриця + тихі години."
      >
        <DCArtboard id="p-team" label="/team · учасники компанії · 4 особи + activity" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="portal" active="team" crumbs={['portal', 'команда']} {...common}>
            <PortalTeam />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-set-profile" label="/settings/profile · особисті дані + інтерфейс" width={1600} height={1180} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'profile']} {...common}>
            <PortalSettingsProfile />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-set-company" label="/settings/company · реквізити · owner only" width={1600} height={1400} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'company']} {...common}>
            <PortalSettingsCompany />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-set-members" label="/settings/members · керування · invite + role" width={1600} height={1000} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'members']} {...common}>
            <PortalSettingsMembers />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-set-notif" label="/settings/notifications · 14×3 матриця + тихі години" width={1600} height={1500} style={{ background: bg }}>
          <Frame kind="portal" active="settings" crumbs={['portal', 'settings', 'notifications']} {...common}>
            <PortalSettingsNotifications />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-states"
        title="07 · Стани · Empty / Error / Overlays"
        subtitle="Error states (404/500/403/maintenance) — окремий centered layout без AppShell. Overlays поверх будь-якої сторінки: ⌘K cmd-палітра, bell-dropdown нотифікацій, company switcher popover, new company wizard."
      >
        <DCArtboard id="p-state-404" label="404 · сторінку не знайдено" width={1200} height={760} style={{ background: bg }}>
          <Portal404 />
        </DCArtboard>

        <DCArtboard id="p-state-500" label="500 · server error" width={1200} height={760} style={{ background: bg }}>
          <Portal500 />
        </DCArtboard>

        <DCArtboard id="p-state-403" label="403 · no permission (member тільки)" width={1200} height={760} style={{ background: bg }}>
          <Portal403 />
        </DCArtboard>

        <DCArtboard id="p-state-maint" label="Технічне обслуговування" width={1200} height={760} style={{ background: bg }}>
          <PortalMaintenance />
        </DCArtboard>

        <DCArtboard id="p-cmdk" label="⌘K · global search palette" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders']} {...common}>
            <PortalOrders />
            <CmdKOverlay />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-bell" label="🔔 bell dropdown · 4 останніх нотифікації" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders']} {...common}>
            <PortalOrders />
            <BellDropdown />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-co-switch" label="Company switcher · 3 компанії + create new" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders']} {...common}>
            <PortalOrders />
            <CompanySwitcherPop />
          </Frame>
        </DCArtboard>

        <DCArtboard id="p-co-new" label="Модал · нова компанія (2-га, 3-тя...)" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="portal" active="orders" crumbs={['portal', 'orders']} {...common}>
            <PortalOrders />
            <NewCompanyWizard />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="portal-mobile"
        title="08 · Mobile · Нативні екрани (iOS)"
        subtitle="Адаптив для клієнтів, що заходять з телефона — у фірмовому стилі (Geist + JetBrains Mono, lime), не «стиснутий desktop». Нижня таб-навігація (Замовлення / Інбокс / Фінанси / Документи / Ще), мобільний чат у бульбашках з input-доком замість таб-бару, bottom-sheet для перемикача компаній. Рендериться у корпусі iPhone (390×844)."
      >
        <DCArtboard id="m-login" label="/login · телефон + SMS-OTP — крок 1" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileLogin step={1} /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-login-otp" label="/login · введення коду" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileLogin step={2} /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-orders" label="/orders · список + tab-bar" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileOrders /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-order-chat" label="/orders/:id · чат + банер підтвердження + input-док" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileOrderChat /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-inbox" label="/inbox · зведений потік" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileInbox /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-calendar" label="/calendar · місяць (mobile)" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileCalendar /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-billing" label="/billing · рахунки + реквізити" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileBilling /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-documents" label="/documents · усі документи" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileDocuments /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-loyalty" label="/loyalty · рівні + прогрес + бонуси" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileLoyalty /></MPhone>
        </DCArtboard>

        <DCArtboard id="m-more-sheet" label="Bottom-sheet · перемикач компаній + Ще" width={470} height={920}>
          <MPhone theme={tweaks.theme} accent={tweaks.accent}><MobileMoreSheet /></MPhone>
        </DCArtboard>
      </DCSection>
    </React.Fragment>
  );
}

function WorkspaceSection({ tweaks }) {
  const common = { theme: tweaks.theme, accent: tweaks.accent, density: tweaks.density };
  const bg = tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9';
  const screens = {
    dash: {
      kind: 'workspace', title: 'Dashboard',
      emptySub: 'Усе чисто — нових замовлень немає.',
      render: () => <WorkspaceDashboard kanbanMode={tweaks.kanbanMode} />,
    },
    detail: {
      kind: 'workspace', title: 'Замовлення',
      emptySub: 'Замовлення не знайдено.',
      render: () => <WorkspaceOrderDetail />,
    },
    debtors: {
      kind: 'workspace', title: 'Дебітори',
      emptySub: 'Усі рахунки оплачені 🎉',
      render: () => <WorkspaceDebtors />,
    },
    company: {
      kind: 'workspace', title: 'Brunky',
      emptySub: 'Компанія не знайдена.',
      render: () => <WorkspaceCompany />,
    },
  };

  return (
    <React.Fragment>
      <DCSection
        id="ws-dashboard"
        title="01 · Робота · Dashboard (Kanban: board / list / timeline)"
        subtitle="Три варіанти Kanban: Board (картки) / List (terminal git-log) / Timeline (Gantt). Tweaks → Workspace → Kanban mode перемикає в обох артбордах. Перший — Studio, другий — Terminal-window для контрасту."
      >
        <DCArtboard id="ws-dash-board-B" label={`B · Studio · Dashboard · Kanban=${tweaks.kanbanMode}`} width={1600} height={1200} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <Frame kind="workspace" active="dashboard" crumbs={['work.workflo.space', 'dashboard']} aesthetic="B" {...common}>
            {pickContent(screens.dash, tweaks)}
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-dash-board-A" label={`A · Terminal · Dashboard · Kanban=${tweaks.kanbanMode}`} width={1600} height={1280} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <Frame kind="workspace" active="dashboard" crumbs={['work', 'dashboard']} aesthetic="A" {...common}>
            {pickContent(screens.dash, tweaks)}
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-order"
        title="01 · Робота · Замовлення — internal view (3 колонки)"
        subtitle="3 колонки: ліва — деталі + дії + тайм-лог + активність; центр — чат з internal-notes (жовта стрічка з 🔒); права — файли + документи. Контраст внутрішнього перегляду з клієнтським."
      >
        <DCArtboard id="ws-order-detail" label="/orders/:id — 3-колонковий internal view" width={1600} height={1400} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} aesthetic="B" {...common}>
            {pickContent(screens.detail, tweaks)}
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-intake"
        title="01 · Робота · Вхідні замовлення (intake queue)"
        subtitle="Нові задачі бачать ВСІ (executors + leads + superadmin). AI пропонує підрозділ з confidence%. Кнопка 'Прийняти в [dept]' — швидкий routing. 'Інший підрозділ ▾' — для override. Це місце де новостворені задачі чекають assignment."
      >
        <DCArtboard id="ws-intake-queue" label="/orders/intake — 4 нових задачі чекають assignment" width={1600} height={1000} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'intake']} {...common}>
            <WithTimer><WorkspaceOrderIntake /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-task-v2"
        title="01 · Робота · Картка задачі v2 (department + estimate + time)"
        subtitle="Розширена картка задачі. Department badge поряд з номером, estimate-bar вгорі (logged vs estimate з alert на 80%), нові таби: Огляд / Час (time entries з коментарями) / Специфікація (final spec для клієнта). Floating timer-bar внизу справа з активною задачею."
      >
        <DCArtboard id="ws-task-overview" label="/orders/:id v2 · Огляд (Фінанси · Команда · Activity)" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} {...common}>
            <WithTimer><WorkspaceOrderDetailV2 initialTab="overview" /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-task-time" label="/orders/:id v2 · Час · time entries з коментарями" width={1600} height={1200} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} {...common}>
            <WithTimer><WorkspaceOrderDetailV2 initialTab="time" /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-task-spec" label="/orders/:id v2 · Специфікація · draft preview" width={1600} height={1200} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} {...common}>
            <WithTimer><WorkspaceOrderDetailV2 initialTab="spec" /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-task-modals"
        title="01 · Робота · Модали задачі — Stop-timer + Close-task"
        subtitle="Stop-timer: попап після [stop] таймера з опційним коментарем 'що робили' (внутрішній — йде у time-log, не у спеку). Close-task: генерація фінальної специфікації з усіх коментарів time-entries; AI-переписує внутрішній тон у клієнт-friendly. Альтернативний артборд показує AI-polished версію."
      >
        <DCArtboard id="ws-stop-timer-modal" label="Модал · Stop timer (47:12, optional comment)" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} {...common}>
            <WorkspaceOrderDetailV2 initialTab="time" />
            <StopTimerModalOverlay />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-close-task-modal" label="Модал · Close task · спека draft (internal tone)" width={1600} height={1280} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} {...common}>
            <WorkspaceOrderDetailV2 initialTab="spec" />
            <CloseTaskModalOverlay />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-close-task-modal-ai" label="Модал · Close task · AI-polished версія" width={1600} height={1280} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'ORD-2412']} {...common}>
            <WorkspaceOrderDetailV2 initialTab="spec" />
            <CloseTaskModalOverlay ai />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-inbox"
        title="02 · Інбокс · Глобальний інбокс команди"
        subtitle="Те ж саме, але крос-клієнтський: @згадки команди, нові замовлення-заявки, платежі (з зеленою картою), прострочки (з червоною), статуси, marketing. Internal-notes мають жовту стрічку і 🔒-маркер у списку."
      >
        <DCArtboard id="ws-inbox-all" label="/inbox · усі (open: @mention)" width={1600} height={1200} style={{ background: bg }}>
          <Frame kind="workspace" active="inbox" crumbs={['work', 'інбокс']} {...common}>
            <WorkspaceInbox filter="all" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-inbox-payment" label="/inbox · open: новий платіж $900" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="inbox" crumbs={['work', 'інбокс']} {...common}>
            <WorkspaceInbox filter="all" selectedId="wi4" />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-inbox-order" label="/inbox · open: нове замовлення Trasa" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="inbox" crumbs={['work', 'інбокс']} {...common}>
            <WorkspaceInbox filter="all" selectedId="wi2" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-billing"
        title="03 · Білінг · Огляд + Клієнти"
        subtitle="Дебітори з age-кольоровою стрічкою (свіжий/нагадування/прострочено) і dialog'ом нагадування. Картка клієнта з вкладками."
      >
        <DCArtboard id="ws-debtors" label="/billing/debtors — дашборд дебіторів" width={1440} height={900} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <Frame kind="workspace" active="debtors" crumbs={['work', 'billing', 'debtors']} aesthetic="B" {...common}>
            {pickContent(screens.debtors, tweaks)}
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-company" label="/companies/brunky — картка клієнта" width={1440} height={1100} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <Frame kind="workspace" active="companies" crumbs={['work', 'companies', 'brunky']} aesthetic="B" {...common}>
            {pickContent(screens.company, tweaks)}
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-missing"
        title="03 · Білінг · Дебітори / Виплати + empty-стани"
        subtitle="Закриваємо gaps: /companies як список з activity-heatmap (28 днів), /billing з subtabs (рахунки/платежі/дебітори/виплати), /billing/payouts з payroll-таблицею (rate × hours + bonuses). Плюс empty states для /intake, /companies, /reports."
      >
        <DCArtboard id="ws-companies-list" label="/companies · список з activity heatmap" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="companies" crumbs={['work', 'клієнти']} {...common}>
            <WithTimer><WorkspaceCompaniesList /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-billing-overview" label="/billing · overview + subtabs" width={1600} height={1000} style={{ background: bg }}>
          <Frame kind="workspace" active="billing" crumbs={['work', 'білінг']} {...common}>
            <WithTimer><WorkspaceBilling /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-payouts" label="/billing/payouts · payroll · 6 executors" width={1600} height={1000} style={{ background: bg }}>
          <Frame kind="workspace" active="payouts" crumbs={['work', 'білінг', 'виплати']} {...common}>
            <WithTimer><WorkspacePayouts /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-empty-intake" label="Empty · /orders/intake (нічого не чекає)" width={1600} height={700} style={{ background: bg }}>
          <Frame kind="workspace" active="orders" crumbs={['work', 'orders', 'intake']} {...common}>
            <IntakeEmpty />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-empty-clients" label="Empty · /companies (немає клієнтів)" width={1600} height={700} style={{ background: bg }}>
          <Frame kind="workspace" active="companies" crumbs={['work', 'клієнти']} {...common}>
            <ClientsEmpty />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-empty-reports" label="Empty · /reports (no data)" width={1600} height={700} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'звіти']} {...common}>
            <ReportsEmpty />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-services-billing"
        title="03 · Білінг · Recurring-сервіси + Послуги (services-admin)"
        subtitle="/services-admin — owner-керування каталогом послуг для лендінгу (порядок, статуси, ліди з форм). /billing/services — recurring-підписки на обслуговування: MRR, призначення виконавців, статуси active/paused. Закриває білінг-вкладку «Сервіси»."
      >
        <DCArtboard id="ws-services-admin" label="/services-admin — каталог послуг лендінгу" width={1600} height={840} style={{ background: bg }}>
          <Frame kind="workspace" active="svc-admin" crumbs={['work', 'контент', 'послуги']} {...common}>
            <WithTimer><WorkspaceServicesAdmin /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-billing-services" label="/billing/services — recurring сервіси + assigns" width={1600} height={860} style={{ background: bg }}>
          <Frame kind="workspace" active="billing" crumbs={['work', 'білінг', 'сервіси']} {...common}>
            <WithTimer><WorkspaceBillingServices /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-wallet-admin"
        title="03 · Білінг · Гаманці клієнтів + Реферальні тіри (G8)"
        subtitle="Owner-сторона: список усіх гаманців (AR + бонусні зобовʼязання по компаніях), повний ledger компанії з ручними коригуваннями (audit), і налаштування реферальних тірів з live-формулою бонусу."
      >
        <DCArtboard id="ws-wallet-companies" label="/admin/wallet/companies — гаманці всіх клієнтів" width={1600} height={780} style={{ background: bg }}>
          <Frame kind="workspace" active="billing" crumbs={['work', 'білінг', 'гаманці']} {...common}>
            <WithTimer><WalletAdminCompanies /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-wallet-ledger" label="/admin/wallet/companies/:id — ledger + коригування" width={1600} height={840} style={{ background: bg }}>
          <Frame kind="workspace" active="billing" crumbs={['work', 'білінг', 'гаманці', 'brunky']} {...common}>
            <WithTimer><WalletAdminLedger /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-wallet-adjust" label="Модал · ручне коригування (audit)" width={560} height={560} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <WalletAdjustModal />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-referral-tiers" label="/admin/referral/settings — тіри + формула" width={1280} height={720} style={{ background: bg }}>
          <Frame kind="workspace" active="billing" crumbs={['work', 'білінг', 'реферали']} {...common}>
            <WithTimer><ReferralTiers /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-finance"
        title="03 · Білінг · Фінанси та P&L (G9)"
        subtitle="Owner-фінанси: огляд (дохід / витрати-donut за категоріями / чистий прибуток + маржа), ledger витрат (recurring + разові, звʼязок із компанією/виконавцем), P&L-графік (3 серії: дохід/витрати/прибуток за 6 міс), модал створення витрати з умовними полями, табличний звіт /reports/pnl з експортом."
      >
        <DCArtboard id="ws-fin-overview" label="/admin/finance — огляд (donut + P&L chart)" width={1600} height={920} style={{ background: bg }}>
          <Frame kind="workspace" active="finance" crumbs={['work', 'фінанси']} {...common}>
            <WithTimer><FinanceOverview /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-fin-expenses" label="/admin/finance — витрати (ledger)" width={1600} height={760} style={{ background: bg }}>
          <Frame kind="workspace" active="finance" crumbs={['work', 'фінанси', 'витрати']} {...common}>
            <WithTimer><ExpensesTab /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-fin-pnl" label="/reports/pnl — звіт P&L по місяцях" width={1600} height={620} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'звіти', 'p&l']} {...common}>
            <WithTimer><PnlReport /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-fin-expense-modal" label="Модал · нова витрата (умовні поля)" width={840} height={720} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <ExpenseModal />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-content"
        title="04 · Контент · Блог + Кейси (CMS-редактор)"
        subtitle="Owner-редактор публічного сайту прямо в workspace. Блог: таблиця статей зі статусами (опубліковано/чернетка/заплановано) + split-редактор markdown ↔ прев'ю наживо. Кейси: картки історій клієнтів з результатами. Те, що публікується тут, зʼявляється на лендінгу."
      >
        <DCArtboard id="ws-blog-list" label="/blog — список статей + метрики" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="workspace" active="blog" crumbs={['work', 'контент', 'блог']} {...common}>
            <WithTimer><WorkspaceBlogCMS view="list" /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-blog-editor" label="/blog/:slug — split-редактор · markdown ↔ прев'ю" width={1600} height={1080} style={{ background: bg }}>
          <Frame kind="workspace" active="blog" crumbs={['work', 'контент', 'блог', 'excel-to-crm']} {...common}>
            <WithTimer><WorkspaceBlogCMS view="editor" /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-cases" label="/cases — кейси для лендінгу" width={1600} height={820} style={{ background: bg }}>
          <Frame kind="workspace" active="cases" crumbs={['work', 'контент', 'кейси']} {...common}>
            <WithTimer><WorkspaceCases /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-vault"
        title="05 · Адмін · Сейф доступів"
        subtitle="Зашифроване сховище доступів клієнтів: логіни, SSH-ключі, токени, API. Згруповано по компаніях. Маски за замовчуванням + reveal-по-кліку, індикатор надійності, шаринг через RBAC, журнал кожного доступу праворуч. AES-256 · zero-knowledge."
      >
        <DCArtboard id="ws-vault-main" label="/vault — сейф доступів · 38 секретів · 6 клієнтів" width={1600} height={1280} style={{ background: bg }}>
          <Frame kind="workspace" active="vault" crumbs={['work', 'сейф']} {...common}>
            <WithTimer><WorkspaceVault /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-admin"
        title="05 · Адмін · Команда (superadmin)"
        subtitle="Управління підрозділами, ролями і доступами. 3 розділи: Підрозділи (CRUD з members), Команда (table + pending invites), Permissions (matrix superadmin/lead/executor). 2 модалі: Invite member · Edit member."
      >
        <DCArtboard id="ws-admin-departments" label="/settings/departments · 4 підрозділи + create card" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="settings" crumbs={['work', 'settings', 'departments']} {...common}>
            <WithTimer><AdminDepartments /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-admin-team" label="/settings/team · members + pending invites" width={1600} height={1180} style={{ background: bg }}>
          <Frame kind="workspace" active="settings" crumbs={['work', 'settings', 'team']} {...common}>
            <WithTimer><AdminTeam /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-admin-perms" label="/settings/permissions · role × permission matrix" width={1600} height={1280} style={{ background: bg }}>
          <Frame kind="workspace" active="settings" crumbs={['work', 'settings', 'permissions']} {...common}>
            <WithTimer><AdminPermissions /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-admin-invite" label="Modal · Запросити члена команди" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="workspace" active="settings" crumbs={['work', 'settings', 'team']} {...common}>
            <AdminTeam />
            <InviteMemberModal />
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-admin-edit" label="Modal · Редагувати члена (Олег · role/rate/depts)" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="settings" crumbs={['work', 'settings', 'team']} {...common}>
            <AdminTeam />
            <EditMemberModal />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-reports"
        title="05 · Адмін · Звіти (Reports)"
        subtitle="Модуль для superadmin. 6 розділів: Огляд (KPIs + revenue chart + donut), Виконавці (utilization, comments-ratio, earnings), Клієнти (revenue, margin, debt), Підрозділи (throughput, cycle time, bottleneck), Timesheet (хронологія), Audit log (всі дії в системі)."
      >
        <DCArtboard id="ws-rep-overview" label="/reports — Огляд (KPIs + spark + donut + top executors)" width={1600} height={1280} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'reports']} {...common}>
            <WithTimer><ReportsOverview /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-rep-executors" label="/reports/executors — utilization · comments% · earnings" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'reports', 'executors']} {...common}>
            <WithTimer><ReportsExecutors /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-rep-clients" label="/reports/clients — revenue · margin · debt" width={1600} height={840} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'reports', 'clients']} {...common}>
            <WithTimer><ReportsClients /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-rep-departments" label="/reports/departments — throughput · cycle · bottleneck" width={1600} height={840} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'reports', 'departments']} {...common}>
            <WithTimer><ReportsDepartments /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-rep-timesheet" label="/reports/timesheet — chronological by-day grouping" width={1600} height={1100} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'reports', 'timesheet']} {...common}>
            <WithTimer><ReportsTimesheet /></WithTimer>
          </Frame>
        </DCArtboard>

        <DCArtboard id="ws-rep-audit" label="/reports/audit — system audit log + retention" width={1600} height={900} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'reports', 'audit']} {...common}>
            <WithTimer><ReportsAudit /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-admin-settings"
        title="05 · Адмін · Системні налаштування (G5)"
        subtitle="Owner-керування системою (per-agency): шаблони листів (спліт-редактор з {{variables}} + live-прев'ю), SMTP-відправники (статус + тест + мапінг подій), брендинг PDF (лого/акцент/шрифт + live invoice-прев'ю), номенклатура послуг (внутрішній каталог), монітор крон-задач."
      >
        <DCArtboard id="ws-admin-templates" label="/admin/templates — шаблони листів + спліт-редактор" width={1600} height={1320} style={{ background: bg }}>
          <Frame kind="workspace" active="admin-set" crumbs={['work', 'адмін', 'шаблони']} {...common}>
            <WithTimer><AdminTemplates /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-admin-smtp" label="/admin/smtp — відправники + мапінг" width={1600} height={980} style={{ background: bg }}>
          <Frame kind="workspace" active="admin-set" crumbs={['work', 'адмін', 'smtp']} {...common}>
            <WithTimer><AdminSmtp /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-admin-branding" label="/admin/branding — брендинг PDF + live прев'ю" width={1600} height={920} style={{ background: bg }}>
          <Frame kind="workspace" active="admin-set" crumbs={['work', 'адмін', 'брендинг']} {...common}>
            <WithTimer><AdminBranding /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-admin-nomenclature" label="/admin/nomenclature — каталог послуг (CRUD)" width={1600} height={760} style={{ background: bg }}>
          <Frame kind="workspace" active="admin-set" crumbs={['work', 'адмін', 'номенклатура']} {...common}>
            <WithTimer><AdminNomenclature /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-admin-crons" label="/admin/crons — монітор крон-задач" width={1600} height={820} style={{ background: bg }}>
          <Frame kind="workspace" active="admin-set" crumbs={['work', 'адмін', 'крони']} {...common}>
            <WithTimer><AdminCrons /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-monitoring"
        title="05 · Адмін · Моніторинг системи (G6)"
        subtitle="Owner-дашборд здоровʼя системи в реальному часі: health-картки (uptime / активні / DB pool / крони / deploy / Sentry), теплокарта крон-задач за 7 днів, здоровʼя каналів сповіщень (success rate + заблоковані), live audit-log дій, error-log Sentry з resolve/ignore."
      >
        <DCArtboard id="ws-sysmon" label="/admin/system — моніторинг (health · heatmap · audit · errors)" width={1600} height={1500} style={{ background: bg }}>
          <Frame kind="workspace" active="sysmon" crumbs={['work', 'адмін', 'моніторинг']} {...common}>
            <WithTimer><SystemMonitoring /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-leave"
        title="05 · Адмін · Відпустки команди (G10)"
        subtitle="Виконавець подає запит (тип: відпустка/лікарняний/без збереження/особистий + діапазон дат + причина + вкладення) → owner приймає/відхиляє (з обовʼязковою причиною) → схвалене зʼявляється в календарі (G7) як greyed-out блок доступності. Баланси днів по типах."
      >
        <DCArtboard id="ws-leave-my" label="/leave — виконавець: мої запити + баланси" width={1280} height={840} style={{ background: bg }}>
          <Frame kind="workspace" active="leave" crumbs={['work', 'відпустки']} {...common}>
            <WithTimer><LeaveExecutor /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-leave-admin" label="/admin/leave — owner: погодження запитів" width={1600} height={760} style={{ background: bg }}>
          <Frame kind="workspace" active="leave" crumbs={['work', 'адмін', 'відпустки']} {...common}>
            <WithTimer><LeaveAdmin /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-leave-request" label="Модал · новий запит (тип + range picker)" width={560} height={720} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <LeaveRequestModal />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-leave-reject" label="Модал · причина відмови (обовʼязкова)" width={520} height={420} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <LeaveRejectModal />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-calendar"
        title="06 · Календар · Зустрічі та події (G7)"
        subtitle="Внутрішні + клієнтські зустрічі, дедлайни (з kanban), відпустки. Три view-режими (місяць / тиждень / день), створення події з учасниками й нагадуваннями, RSVP для запрошених, порожній стан. Кольорова система типів: внутрішні · клієнтські · дедлайни · відпустки."
      >
        <DCArtboard id="ws-cal-month" label="/calendar — місяць" width={1600} height={920} style={{ background: bg }}>
          <Frame kind="workspace" active="calendar" crumbs={['work', 'календар']} {...common}>
            <WithTimer><CalendarMonth /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-cal-week" label="/calendar — тиждень (24h × 7)" width={1600} height={1020} style={{ background: bg }}>
          <Frame kind="workspace" active="calendar" crumbs={['work', 'календар', 'тиждень']} {...common}>
            <WithTimer><CalendarWeek /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-cal-day" label="/calendar — день (розклад + деталі)" width={1600} height={1000} style={{ background: bg }}>
          <Frame kind="workspace" active="calendar" crumbs={['work', 'календар', 'день']} {...common}>
            <WithTimer><CalendarDay /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-cal-event" label="Модал · створення події" width={840} height={760} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <CalEventModal />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-cal-rsvp" label="Модал · RSVP" width={560} height={620} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <CalRsvpModal />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-cal-empty" label="/calendar — порожній стан" width={1100} height={620} style={{ background: bg }}>
          <Frame kind="workspace" active="calendar" crumbs={['work', 'календар']} {...common}>
            <CalendarEmpty />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-minors"
        title="07 · Компоненти · Interaction refinements (M1–M5)"
        subtitle="Дрібні UI-елементи з нових фіч: M1 OAuth-кнопки (Google/GitHub) у терміналь-стилі · M2 теги замовлення + залежності (blocks/blocked-by) + dropdown шаблонів · M3 чат — reply-to, реакції + picker, edit-affordance, read-receipts · M4 /reports/revenue (line chart) · M5 chat-hub — mute/archive, SSE slide-in, unread badge."
      >
        <DCArtboard id="ws-m-revenue" label="M4 · /reports/revenue — графік виручки" width={1600} height={620} style={{ background: bg }}>
          <Frame kind="workspace" active="reports" crumbs={['work', 'звіти', 'виручка']} {...common}>
            <WithTimer><RevenueReport /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-m-oauth" label="M1 · OAuth-кнопки (login)" width={520} height={320} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 32 }}>
            <OAuthButtons />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-m-tags" label="M2 · теги + залежності + шаблони" width={560} height={620} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 28 }}>
            <OrderTagsDeps />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-m-chat" label="M3 · чат — reply / реакції / edit / receipts" width={620} height={560} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 28 }}>
            <ChatRefine />
          </div>
        </DCArtboard>
        <DCArtboard id="ws-m-hub" label="M5 · chat-hub — mute/archive + SSE + badge" width={640} height={400} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 28 }}>
            <ChatHubRefine />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-emails"
        title="07 · Компоненти · Email — транзакційні (5)"
        subtitle="5 листів, які отримує клієнт, у фірмовому стилі (mono + lime, той самий wordmark). Показані всередині прев'ю поштового клієнта — рівно те, що приходить в інбокс. Запрошення в портал · замовлення прийнято · рахунок · оплату отримано · нагадування про оплату."
      >
        <DCArtboard id="email-invite" label="Email · запрошення в портал (set password)" width={900} height={920} style={{ background: bg }}>
          <EmailInvite />
        </DCArtboard>
        <DCArtboard id="email-order" label="Email · замовлення прийнято в роботу" width={900} height={940} style={{ background: bg }}>
          <EmailOrderReceived />
        </DCArtboard>
        <DCArtboard id="email-invoice" label="Email · виставлено рахунок (pay CTA)" width={900} height={960} style={{ background: bg }}>
          <EmailInvoice />
        </DCArtboard>
        <DCArtboard id="email-payment" label="Email · оплату отримано (receipt)" width={900} height={900} style={{ background: bg }}>
          <EmailPaymentOk />
        </DCArtboard>
        <DCArtboard id="email-deadline" label="Email · нагадування про оплату (warning)" width={900} height={880} style={{ background: bg }}>
          <EmailDeadline />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-emails-auth"
        title="07 · Компоненти · Email — Auth & безпека (6)"
        subtitle="Системні листи автентифікації й безпеки: підтвердження пошти, скидання паролю, пароль змінено, новий вхід (security alert), одноразовий код 2FA, зміна email. Великий OTP-блок, security-рядки з пристроєм/локацією/часом, кольорові hero (info / ok / alert)."
      >
        <DCArtboard id="email-verify" label="Email · підтвердження пошти (код)" width={900} height={760} style={{ background: bg }}>
          <EmailVerify />
        </DCArtboard>
        <DCArtboard id="email-reset" label="Email · скидання паролю" width={900} height={820} style={{ background: bg }}>
          <EmailPasswordReset />
        </DCArtboard>
        <DCArtboard id="email-pwd-changed" label="Email · пароль змінено (security)" width={900} height={820} style={{ background: bg }}>
          <EmailPasswordChanged />
        </DCArtboard>
        <DCArtboard id="email-new-login" label="Email · новий вхід виявлено (alert)" width={900} height={900} style={{ background: bg }}>
          <EmailNewLogin />
        </DCArtboard>
        <DCArtboard id="email-otp" label="Email · одноразовий код 2FA" width={900} height={720} style={{ background: bg }}>
          <EmailOtp />
        </DCArtboard>
        <DCArtboard id="email-change" label="Email · підтвердження зміни email" width={900} height={800} style={{ background: bg }}>
          <EmailChange />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-emails-system"
        title="07 · Компоненти · Email — системні та інфо (4)"
        subtitle="Сповіщення й службові листи: запрошення в команду (workspace), згадка/нове повідомлення (з цитатою), документ готовий на погодження, тижневий дайджест (stat-сітка + список подій)."
      >
        <DCArtboard id="email-team-invite" label="Email · запрошення в команду (executor)" width={900} height={880} style={{ background: bg }}>
          <EmailTeamInvite />
        </DCArtboard>
        <DCArtboard id="email-mention" label="Email · згадка / нове повідомлення" width={900} height={820} style={{ background: bg }}>
          <EmailMention />
        </DCArtboard>
        <DCArtboard id="email-doc-ready" label="Email · документ готовий на погодження" width={900} height={820} style={{ background: bg }}>
          <EmailDocReady />
        </DCArtboard>
        <DCArtboard id="email-digest" label="Email · тижневий дайджест" width={900} height={960} style={{ background: bg }}>
          <EmailDigest />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-onboarding"
        title="07 · Компоненти · Онбординг нового простору (5 кроків)"
        subtitle="First-run візард для нового власника: робочий простір → профіль компанії (вибір галузі тематичною аватаркою) → команда (виконавці з ролями-аватарками) → канали (Telegram/email/дайджест) → готово. Інтерактивний — клікай по кроках у лівій колонці або кнопками. Тут показані всі 5 кроків як окремі артборди."
      >
        <DCArtboard id="ob-step-0" label="Онбординг · крок 1 · робочий простір" width={1100} height={780} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <OnboardingFlow initStep={0} />
          </div>
        </DCArtboard>
        <DCArtboard id="ob-step-1" label="Онбординг · крок 2 · галузь (аватар компанії)" width={1100} height={820} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <OnboardingFlow initStep={1} />
          </div>
        </DCArtboard>
        <DCArtboard id="ob-step-2" label="Онбординг · крок 3 · команда (ролі-аватарки)" width={1100} height={900} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <OnboardingFlow initStep={2} />
          </div>
        </DCArtboard>
        <DCArtboard id="ob-step-3" label="Онбординг · крок 4 · канали" width={1100} height={780} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <OnboardingFlow initStep={3} />
          </div>
        </DCArtboard>
        <DCArtboard id="ob-step-4" label="Онбординг · крок 5 · готово (summary)" width={1100} height={820} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 24 }}>
            <OnboardingFlow initStep={4} />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-shared-overlays"
        title="07 · Компоненти · Notification center + Toasts"
        subtitle="Кросс-продуктові оверлеї з §10 брифу. Notification center (🔔): дропдаун з табами Непрочитані/Всі, аватарки відправників, типи подій. Toast-система: success / error / warning / info / loading, опційна дія, стек до 3 + лічильник прихованих."
      >
        <DCArtboard id="ws-notif-center" label="Notification center · 🔔 дропдаун" width={840} height={680} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent}>
            <div className="wfn-demo">
              <div>
                <div className="wft-demo-label">// непрочитані (default)</div>
                <NotificationCenter initialTab="unread" />
              </div>
              <div>
                <div className="wft-demo-label">// всі</div>
                <NotificationCenter initialTab="all" />
              </div>
            </div>
          </div>
        </DCArtboard>
        <DCArtboard id="ws-toasts" label="Toast-система · 5 варіантів + action" width={520} height={640} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent}>
            <div className="wft-demo">
              <div>
                <div className="wft-demo-label">// bottom-right стек · auto-dismiss 5s</div>
                <ToastSystem />
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-loading-states"
        title="07 · Компоненти · Skeleton-лоадери (loading states)"
        subtitle="Бриф §11: skeleton замість spinner'ів. Shimmer-блоки в кольорах токенів, що повторюють форму майбутнього контенту — dashboard (stats + таблиця), список/інбокс, картки. Спокійна 1.4s-анімація, respect prefers-reduced-motion."
      >
        <DCArtboard id="ws-skel-dashboard" label="Dashboard · loading" width={1600} height={760} style={{ background: bg }}>
          <Frame kind="workspace" active="dashboard" crumbs={['work', 'dashboard']} {...common}>
            <DashboardSkeleton />
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-skel-list" label="Інбокс / список · loading" width={1600} height={680} style={{ background: bg }}>
          <Frame kind="workspace" active="inbox" crumbs={['work', 'інбокс']} {...common}>
            <ListSkeleton rows={7} />
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-skel-cards" label="Картки (кейси/клієнти) · loading" width={1100} height={520} style={{ background: bg }}>
          <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ padding: 28 }}>
            <SkelCards n={4} cols={2} />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ws-phase2"
        title="08 · Phase-2 · Подальші фічі"
        subtitle="Заплановане розширення з брифу: ADR-004 multi-agency switcher (для користувачів у >1 агенції — топбар-оверлей), DB-метрики моніторингу (пул зʼєднань / cache hit / повільні запити з pg_stat_statements) і маржа по клієнтах (дохід − собівартість годин). Booking-лінк /book/:slug — на лендінгу."
      >
        <DCArtboard id="ws-p2-agency" label="ADR-004 · multi-agency switcher (топбар-оверлей)" width={1100} height={620} style={{ background: bg }}>
          <Frame kind="workspace" active="dashboard" crumbs={['work', 'dashboard']} {...common}>
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
              <AgencySwitcherPop />
            </div>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-p2-db" label="G6 ext · DB-метрики (/admin/system/db)" width={1600} height={760} style={{ background: bg }}>
          <Frame kind="workspace" active="sysmon" crumbs={['work', 'адмін', 'моніторинг', 'db']} {...common}>
            <WithTimer><DbMetrics /></WithTimer>
          </Frame>
        </DCArtboard>
        <DCArtboard id="ws-p2-margin" label="G9 ext · маржа по клієнтах (/admin/finance/margin)" width={1600} height={700} style={{ background: bg }}>
          <Frame kind="workspace" active="finance" crumbs={['work', 'фінанси', 'маржа']} {...common}>
            <WithTimer><ClientMargin /></WithTimer>
          </Frame>
        </DCArtboard>
      </DCSection>
    </React.Fragment>
  );
}

function BrandbookSection({ tweaks }) {
  const bg = tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9';
  return (
    <DCSection
      id="brandbook"
      title="Brandbook · єдина дизайн-система"
      subtitle="Один спільний довідник на всю екосистему. Foundations (колір, типографіка, простір, тіні, рух, ASCII, голос) — спільна основа лендінгу й продукту. Components — перевикористувані UI-елементи продукту: Buttons / Badges / Forms / Surfaces / Data display / Layout. Те саме джерело правди для будь-якої сторінки."
    >
      <DCArtboard id="bb-foundations" label="Foundations · токени · колір · тип · рух · ASCII · голос" width={1200} height={9400} style={{ background: bg }}>
        <Brandbook theme={tweaks.theme} />
      </DCArtboard>
      <DCArtboard id="bb-avatars" label="Avatars · тематичні гліф-аватарки (ролі + клієнти)" width={1200} height={2100} style={{ background: bg }}>
        <div style={{ padding: '40px 44px' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--wf-fg-muted)', marginBottom: 6 }}>// avatars</div>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--wf-fg)' }}>Тематичні аватарки</h2>
          <p style={{ fontSize: 14, color: 'var(--wf-fg-secondary)', maxWidth: '62ch', margin: '0 0 28px', lineHeight: 1.6 }}>Гліф-аватарки в terminal-стилі: ролі команди (дизайнер, розробник, devops, AI…) та клієнти за галуззю (логістика, рітейл, food, fintech…). Tile або circle, soft/solid, зі статусом і кутовими дужками.</p>
          <AvatarCatalog />
        </div>
      </DCArtboard>
      <DCArtboard id="bb-components" label="Components · продуктові UI-елементи (.wfp- · .wfd- · R3)" width={1440} height={4960} style={{ background: bg }}>
        <ProductBrandbook />
      </DCArtboard>
    </DCSection>
  );
}

function DocumentsSection({ tweaks }) {
  const common = { theme: tweaks.theme, accent: tweaks.accent, density: tweaks.density };

  // Wrapper that centers a PDF page inside an artboard
  const Page = ({ children }) => (
    <div style={{ padding: 32, display: 'flex', justifyContent: 'center', background: tweaks.theme === 'dark' ? '#1a1a1a' : '#E7E5E4', minHeight: '100%' }}>
      {children}
    </div>
  );

  return (
    <React.Fragment>
      <DCSection
        id="doc-system"
        title="Documents · система"
        subtitle="Спільний template для всіх PDF: ASCII-маркою workflo зліва, темна шапка таблиці, lime акцент тільки на номері та підсумку. Geist для тексту, JetBrains Mono для всіх чисел/реквізитів. Підпис (caveat) + штамп watermark для signed-документів, draft-штамп для чернеток. UI-сторінка `/documents` — список усіх документів компанії з фільтрами."
      >
        <DCArtboard id="doc-index" label="/documents — UI-індекс документів клієнта" width={1440} height={1000} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <Frame kind="portal" active="documents" crumbs={['portal', 'документи']} aesthetic="B" {...common}>
            <DocumentsIndex />
          </Frame>
        </DCArtboard>

        <DCArtboard id="doc-types-overview" label="Огляд 5 типів документів · скоуп системи" width={920} height={420} style={{ background: tweaks.theme === 'dark' ? '#0A0A0A' : '#FAFAF9' }}>
          <div className="wfp-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ height: '100%', padding: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
              {Object.entries(window.WFP_DATA.doc_types).map(([k, t]) => (
                <div key={k} className="wfp-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="wfp-doc-type-pill" data-t={k}>{t.code}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>PDF · A4</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', lineHeight: 1.5 }}>{descByType(k)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="wfp-card">
                <div className="wfp-card-h"><div className="wfp-card-h-t">Спільні принципи</div></div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
                  <li>A4 (794×1123) · margins 56/64</li>
                  <li>Geist body · JetBrains Mono для цифр</li>
                  <li>Темна шапка таблиці, lime акцент на № і total</li>
                  <li>Штамп: SIGNED / DRAFT як watermark</li>
                  <li>Підпис: Caveat font, повертаний -3°</li>
                </ul>
              </div>
              <div className="wfp-card">
                <div className="wfp-card-h"><div className="wfp-card-h-t">Локалі</div></div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
                  <li>UA + EN (за замовч UA)</li>
                  <li>Дати: 24.05.2026 · May 24, 2026</li>
                  <li>Валюти dual: $ + ₴ з НБУ-курсом</li>
                  <li>Реквізити: ФОП 3 гр (без ПДВ)</li>
                </ul>
              </div>
              <div className="wfp-card">
                <div className="wfp-card-h"><div className="wfp-card-h-t">Engine</div></div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
                  <li>HTML → Puppeteer → PDF</li>
                  <li>Шаблон-toolkit: DocBrand, DocParties, DocSigs, DocFoot</li>
                  <li>QR — IBAN + amount + ref</li>
                  <li>e-Signature: SVG layer (optional)</li>
                </ul>
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="doc-invoice"
        title="01 · Invoice · Рахунок-фактура"
        subtitle="Найчастіший документ. Виставляється після підтвердження клієнтом оцінки. Містить розбивку робіт, реквізити для оплати (IBAN + USDT + QR), курс гривні від НБУ. Lime акцент на номері та total — щоб клієнт одразу бачив суму."
      >
        <DCArtboard id="doc-invoice-page" label="INV-2025-0418 · надіслано клієнту" width={920} height={1280}>
          <Page><InvoiceDoc /></Page>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="doc-act"
        title="02 · Completion Act · Акт виконаних робіт"
        subtitle="Виставляється коли всі роботи зі специфікації виконані і клієнт прийняв їх. Підстава для закриття замовлення. Зелений штамп SIGNED у верхньому правому куті, два підписи з Caveat-шрифтом."
      >
        <DCArtboard id="doc-act-page" label="ACT-2025-0392 · підписано обома сторонами" width={920} height={1280}>
          <Page><CompletionActDoc /></Page>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="doc-rec"
        title="03 · Reconciliation Act · Акт звірки"
        subtitle="Генерується раз у квартал або за запитом. Показує всі взаєморозрахунки за період — дебет / кредит / сальдо. Помаранчевий штамп DRAFT поки не підписано. Підсумок виділяється чорним блоком з lime акцентом."
      >
        <DCArtboard id="doc-rec-page" label="REC-2025-0014 · чернетка · потрібен підпис" width={920} height={1280}>
          <Page><ReconciliationActDoc /></Page>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="doc-spec"
        title="04 · Specification · Специфікація проєкту"
        subtitle="Найбільший за обсягом документ. Базується на discovery-сесіях. Розділи: Контекст, Цілі, Скоуп, Deliverables, Етапи (з тижневою сіткою), Критерії приймання, Поза скоупом, Бюджет. Підпис фіксує scope і вартість — далі за ним генеруються invoice."
      >
        <DCArtboard id="doc-spec-page" label="SPC-2025-0418 · підписано · чинна" width={920} height={1900}>
          <Page><SpecificationDoc /></Page>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="doc-contract"
        title="05 · Contract · Договір про надання послуг"
        subtitle="Рамковий договір, підписується один раз на клієнта. Далі усі конкретні замовлення додаються Специфікаціями. Двоколонкова верстка статей для щільності — щоб увійшло у 1 сторінку. Електронний підпис через workflo.space."
      >
        <DCArtboard id="doc-contract-page" label="CTR-2025-0004 · рамковий договір" width={920} height={1280}>
          <Page><ContractDoc /></Page>
        </DCArtboard>
      </DCSection>
    </React.Fragment>
  );
}

function descByType(k) {
  return {
    invoice:            'Рахунок до оплати. Виставляється після estimate.',
    completion_act:     'Закриває замовлення. Підстава для платежу.',
    reconciliation_act: 'Періодична звірка взаєморозрахунків.',
    specification:      'Технічне завдання + бюджет + етапи.',
    contract:           'Рамковий договір на послуги.',
  }[k] || '';
}

// ─── Root ───
const PRODUCT_LOCAL_TABS = ['portal', 'workspace', 'documents', 'brandbook'];

function ProductApp() {
  const [tweaks, setTweak] = useTweaks(PRODUCT_TWEAK_DEFAULTS);

  // Honour ?tab= from the shared ecosystem nav (deep links from other surfaces).
  React.useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('tab');
      if (q && PRODUCT_LOCAL_TABS.includes(q) && q !== tweaks.tab) setTweak('tab', q);
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply accent color to root via CSS var
  const accentPreset = (window.ACCENT_PRESETS && window.ACCENT_PRESETS[tweaks.accent]) || null;
  const rootCssVars = accentPreset ? {
    '--wf-accent': tweaks.theme === 'dark' ? accentPreset.dark : accentPreset.light,
    '--wf-accent-bg': accentPreset.dark,
    '--wf-accent-soft': tweaks.theme === 'dark' ? accentPreset.softDark : accentPreset.soft,
  } : {};

  const setTab = (id) => setTweak('tab', id);

  return (
    <div className="wfp-root wf-root" data-theme={tweaks.theme} data-accent={tweaks.accent} style={{ minHeight: '100vh', ...rootCssVars }}>
      <EcoNav
        active={tweaks.tab}
        theme={tweaks.theme}
        accent={tweaks.accent}
        localTabs={PRODUCT_LOCAL_TABS}
        onSelect={setTab}
      />

      <DesignCanvas>
        {tweaks.tab === 'portal'    && <PortalSection tweaks={tweaks} />}
        {tweaks.tab === 'workspace' && <WorkspaceSection tweaks={tweaks} />}
        {tweaks.tab === 'documents' && <DocumentsSection tweaks={tweaks} />}
        {tweaks.tab === 'brandbook' && <BrandbookSection tweaks={tweaks} />}
      </DesignCanvas>

      <ProductTweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

const productRoot = ReactDOM.createRoot(document.getElementById('root'));
productRoot.render(<ProductApp />);
