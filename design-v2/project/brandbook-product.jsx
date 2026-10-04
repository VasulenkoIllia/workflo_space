// brandbook-product.jsx — Component library overview for workflo product
// Single artboard that catalogs all reusable elements

function ProductBrandbook() {
  return (
    <div className="wfp-root wf-root wfp-brandbook" data-theme="light" style={{ height: '100%', padding: 'clamp(18px, 4vw, 40px) clamp(14px, 4vw, 56px)', overflow: 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '2px solid var(--wf-fg)' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            // product · component library
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
            workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space · brandbook
          </h1>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>
            // single source of truth для всіх перевикористуваних UI-елементів. Класи з префіксом <strong style={{ color: 'var(--wf-fg)' }}>.wfp-</strong> (product) і <strong style={{ color: 'var(--wf-fg)' }}>.wfd-</strong> (documents).
          </div>
        </header>

        {/* Tokens / Foundations */}
        <WfpBBSection title="Foundations · колір, типографіка">
          <BBRow title="Брендовий акцент" code="--wf-accent · #A3D90D / #C5F82A" desc="Lime. Тільки для CTA, активних станів, прогресу. Не для текстового вмісту.">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, background: 'var(--wf-accent-bg)', borderRadius: 6 }} />
              <div style={{ width: 48, height: 48, background: 'var(--wf-accent)', borderRadius: 6 }} />
              <div style={{ width: 48, height: 48, background: 'var(--wf-accent-soft)', borderRadius: 6 }} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}>
                bg · solid · soft
              </div>
            </div>
          </BBRow>
          <BBRow title="Семантичні кольори" code="--wf-success · warning · destructive" desc="Stateful. Success — підпис/оплачено. Warning — pending/борг. Destructive — overdue/cancel.">
            <div style={{ display: 'flex', gap: 16 }}>
              {[['success', 'оплачено'], ['warning', 'pending'], ['destructive', 'overdue']].map(([k, l]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: `var(--wf-${k})` }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{l}</span>
                </div>
              ))}
            </div>
          </BBRow>
          <BBRow title="Типографіка" code="Geist · body / JetBrains Mono · data" desc="Geist для UI. Mono для всіх чисел, ID, timestamps, реквізитів. Ніколи не змішувати в одному рядку без явної межі.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Heading · Geist 600 −0.015em</span>
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 13.5 }}>Body · Geist 400 13.5px</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontFeatureSettings: '"tnum"' }}>$1 234.56 · ORD-2412 · 24.05.2026</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>// META · MONO 10.5 UPPER</span>
            </div>
          </BBRow>
        </WfpBBSection>

        {/* Buttons */}
        <WfpBBSection title="Buttons">
          <BBRow title="Primary · Secondary · Ghost" code=".wfp-btn · .wfp-btn--primary · .wfp-btn--ghost" desc="Primary для головної дії на екрані. Secondary — за замовч. Ghost — у тулбарах і поряд з primary.">
            <button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={13} />Primary</button>
            <button className="wfp-btn">Secondary</button>
            <button className="wfp-btn wfp-btn--ghost">Ghost</button>
            <button className="wfp-btn wfp-btn--ghost wfp-btn--danger">Danger</button>
          </BBRow>
          <BBRow title="Розміри" code=".wfp-btn--sm" desc="Default 13px. Small 12px — у тулбарах, фільтрах, картках.">
            <button className="wfp-btn wfp-btn--primary">Default</button>
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm">Small</button>
            <button className="wfp-btn wfp-btn--sm">Small secondary</button>
          </BBRow>
          <BBRow title="Icon button" code=".wfp-iconbtn" desc="Тільки іконка. 32×32 за замовч. Для тулбарів — search/bell/avatar.">
            <button className="wfp-iconbtn"><Icon name="search" size={14} /></button>
            <button className="wfp-iconbtn"><Icon name="bell" size={14} /><span className="wfp-iconbtn-dot" /></button>
            <button className="wfp-iconbtn"><Icon name="settings" size={14} /></button>
          </BBRow>
          <BBRow title="Chip / radio" code=".wfp-chip" desc="Для пріоритетів, типів білінгу, multi-select підрозділів.">
            <button className="wfp-chip" data-on="true"><span className="wfp-chip-dot" style={{ background: 'var(--wf-accent)' }} />Normal</button>
            <button className="wfp-chip"><span className="wfp-chip-dot" style={{ background: 'var(--wf-warning)' }} />High</button>
            <button className="wfp-chip"><span className="wfp-chip-dot" style={{ background: 'var(--wf-destructive)' }} />Urgent</button>
          </BBRow>
          <BBRow title="Pill" code=".wfp-pill" desc="Фільтри (active/done/etc). Округлі повністю. Active має fg-border.">
            <button className="wfp-pill" data-on="true">всі · 5</button>
            <button className="wfp-pill">очікують 2</button>
            <button className="wfp-pill">в роботі</button>
          </BBRow>
        </WfpBBSection>

        {/* Badges & status */}
        <WfpBBSection title="Badges & Status">
          <BBRow title="Payment badge" code=".wfp-badge--paid / --partial / --unpaid" desc="Стан оплати на рахунках і документах.">
            <span className="wfp-badge wfp-badge--paid">оплачено</span>
            <span className="wfp-badge wfp-badge--partial">частково</span>
            <span className="wfp-badge wfp-badge--unpaid">не оплачено</span>
            <span className="wfp-badge wfp-badge--soft">чернетка</span>
          </BBRow>
          <BBRow title="Status dot" code="StatusDot · 9 client-facing statuses" desc="Кольорова точка + лейбл. Beвhavior: статус замовлення в портал-вьюшках.">
            <span className="wfp-order-status"><span className="wfp-status-dot" style={{ background: 'var(--wf-accent)' }} /><span>В роботі</span></span>
            <span className="wfp-order-status"><span className="wfp-status-dot" style={{ background: 'var(--wf-warning)' }} /><span>Очікує підтвердження</span></span>
            <span className="wfp-order-status"><span className="wfp-status-dot" style={{ background: 'var(--wf-success)' }} /><span>Готово</span></span>
            <span className="wfp-order-status"><span className="wfp-status-dot" style={{ background: 'var(--wf-destructive)' }} /><span>Скасовано</span></span>
          </BBRow>
          <BBRow title="Tier badge" code="<TierBadge tier='partner' />" desc="Loyalty tier (new/regular/silver/partner/vip). Показує % знижки.">
            <span className="wfp-tier-badge" style={{ '--tier-color': 'var(--wf-fg-muted)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wf-fg-muted)' }} /><span>silver</span><span style={{ color: 'var(--wf-fg-muted)' }}>· −5%</span></span>
            <span className="wfp-tier-badge" style={{ '--tier-color': 'var(--wf-accent)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wf-accent)' }} /><span>partner</span><span style={{ color: 'var(--wf-fg-muted)' }}>· −8%</span></span>
            <span className="wfp-tier-badge" style={{ '--tier-color': '#D97706' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706' }} /><span>vip</span><span style={{ color: 'var(--wf-fg-muted)' }}>· −12%</span></span>
          </BBRow>
          <BBRow title="Department badge" code="<DeptBadge id='auto' />" desc="Workspace. Кольорова мітка підрозділу. З крапкою.">
            <DeptBadge id="dev" />
            <DeptBadge id="design" />
            <DeptBadge id="automation" />
            <DeptBadge id="content" />
          </BBRow>
          <BBRow title="Role pill" code=".wfp-role-pill" desc="Для команди. 3 ролі — кожна свій колір.">
            <span className="wfp-role-pill wfp-role-pill--superadmin"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />superadmin</span>
            <span className="wfp-role-pill wfp-role-pill--lead"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />lead</span>
            <span className="wfp-role-pill wfp-role-pill--executor"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />executor</span>
          </BBRow>
          <BBRow title="Doc-type pill" code=".wfp-doc-type-pill" desc="Тип документа коротко: INV/ACT/SPC/CTR/REC.">
            <span className="wfp-doc-type-pill" data-t="invoice">INV</span>
            <span className="wfp-doc-type-pill" data-t="completion_act">ACT</span>
            <span className="wfp-doc-type-pill" data-t="reconciliation_act">REC</span>
            <span className="wfp-doc-type-pill" data-t="specification">SPC</span>
            <span className="wfp-doc-type-pill" data-t="contract">CTR</span>
          </BBRow>
          <BBRow title="Verified pill" code=".wfp-verified-pill / --unverified" desc="Для верифікованих сутностей (телефон, telegram).">
            <span className="wfp-verified-pill"><Icon name="check" size={11} />verified</span>
            <span className="wfp-unverified-pill"><Icon name="alert" size={11} />unverified</span>
          </BBRow>
        </WfpBBSection>

        {/* Avatars */}
        <WfpBBSection title="Avatars">
          <BBRow title="Avatar + stack" code=".wfp-av · .wfp-av-stack" desc="Ініціали 2 символи. Стек з overlap для команд (до 3 + counter).">
            <span className="wfp-av wfp-av--illia">ІВ</span>
            <span className="wfp-av wfp-av--oleh">ОШ</span>
            <span className="wfp-av wfp-av--maria">МБ</span>
            <span className="wfp-av-stack">
              <span className="wfp-av wfp-av--illia">ІВ</span>
              <span className="wfp-av wfp-av--oleh">ОШ</span>
              <span className="wfp-av wfp-av--maria">МБ</span>
              <span className="wfp-av wfp-av--more">+2</span>
            </span>
          </BBRow>
        </WfpBBSection>

        {/* Forms */}
        <WfpBBSection title="Forms · поля + повідомлення">
          <BBRow title="Text input" code=".wfp-field" desc="Стандартне поле введення з label (mono uppercase 10.5px).">
            <div className="wfp-field" style={{ width: 300 }}>
              <label>Email</label>
              <input defaultValue="olena@brunky.ua" />
              <div className="wfp-field-hint">допомога під полем</div>
            </div>
          </BBRow>
          <BBRow title="Phone input · UA" code=".wfp-phone-input" desc="З країновим префіксом і mono-номером.">
            <div className="wfp-phone-input" style={{ width: 300 }}>
              <div className="wfp-phone-input-cc">🇺🇦 +380</div>
              <input className="wfp-phone-input-num" defaultValue="50 123 84 12" />
            </div>
          </BBRow>
          <BBRow title="OTP grid · 6 boxes" code=".wfp-otp-grid · <OtpInput />" desc="Для SMS-кодів. Active box має accent рамку.">
            <div style={{ width: 320 }}><OtpInput value="4279" /></div>
          </BBRow>
          <BBRow title="Form messages" code=".wfp-form-msg--error/--success/--info" desc="Інлайн повідомлення у формах. З k-label і іконкою.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 360 }}>
              <FormMsg kind="error"   k="auth_failed">Невірний email або пароль</FormMsg>
              <FormMsg kind="success" k="email sent">Лист надіслано</FormMsg>
              <FormMsg kind="info"    k="info">Інформаційне повідомлення</FormMsg>
            </div>
          </BBRow>
        </WfpBBSection>

        {/* Surfaces */}
        <WfpBBSection title="Surfaces · картки, таби, стрічки">
          <BBRow title="Card" code=".wfp-card · .wfp-card-h" desc="Стандартна поверхня з опційним header (title + aux).">
            <div className="wfp-card" style={{ width: 320, padding: 14 }}>
              <div className="wfp-card-h">
                <div className="wfp-card-h-t">Card title</div>
                <div className="wfp-card-h-aux">// aux</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>Контент картки</div>
            </div>
          </BBRow>
          <BBRow title="Tabs · controlled" code="<Tabs items={[...]} value onChange />" desc="Inline табы з accent-підкресленням active. Опційно badge на табі.">
            <div style={{ width: 460 }}>
              <Tabs
                value="chat"
                onChange={() => {}}
                items={[
                  { id: 'chat',  label: 'Чат',       badge: 9 },
                  { id: 'files', label: 'Файли',     badge: 4 },
                  { id: 'docs',  label: 'Документи', badge: 2 },
                ]}
              />
            </div>
          </BBRow>
          <BBRow title="Stats row" code="<StatsRow><Stat k v sub kind /></StatsRow>" desc="N-cell grid з border-separator. kind: default/accent/warn/danger.">
            <div style={{ width: 700 }}>
              <StatsRow>
                <Stat k="борг"            v="$1 550" sub="2 рахунки"        kind="warn" />
                <Stat k="оплачено"        v="$22 380" sub="12 рахунків" />
                <Stat k="бонусний баланс" v="$340"   sub="loyalty"          kind="accent" />
                <Stat k="наступний tier"  v="vip"    sub="$2 600 залишок" />
              </StatsRow>
            </div>
          </BBRow>
        </WfpBBSection>

        {/* Data display */}
        <WfpBBSection title="Data display · бари, прогрес, mini-bars">
          <BBRow title="Mini bar · utilization" code=".wfp-mini-bar · kind=low/good/warn/over" desc="Inline-bars для таблиць. 60px+ width.">
            <div style={{ display: 'grid', gridTemplateColumns: '120px 80px', gap: 14, width: 380, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              <div className="wfp-mini-bar"><div className="wfp-mini-bar-fill wfp-mini-bar-fill--good" style={{ width: '78%' }} /></div>
              <span>good · 78%</span>
              <div className="wfp-mini-bar"><div className="wfp-mini-bar-fill wfp-mini-bar-fill--warn" style={{ width: '92%' }} /></div>
              <span>warn · 92%</span>
              <div className="wfp-mini-bar"><div className="wfp-mini-bar-fill wfp-mini-bar-fill--low" style={{ width: '34%' }} /></div>
              <span>low · 34%</span>
              <div className="wfp-mini-bar"><div className="wfp-mini-bar-fill wfp-mini-bar-fill--over" style={{ width: '100%' }} /></div>
              <span>over · 100%+</span>
            </div>
          </BBRow>
          <BBRow title="Estimate bar · з tick" code=".wfp-est-bar + .wfp-est-bar-tick" desc="Estimate vs Actual з marker на 80%.">
            <div className="wfp-est-bar-wrap" style={{ width: 360 }}>
              <div className="wfp-est-bar-meta">
                <span className="wfp-est-bar-l">progress</span>
                <span className="wfp-est-bar-v"><strong>5.3h</strong> / 56h · 9%</span>
              </div>
              <div className="wfp-est-bar">
                <div className="wfp-est-bar-fill" style={{ width: '9%' }} />
                <div className="wfp-est-bar-tick" style={{ left: '80%' }} />
              </div>
            </div>
          </BBRow>
          <BBRow title="Wizard steps" code="<WizardSteps current={1} />" desc="Multi-step форми (register). З progress bar.">
            <div style={{ width: 360 }}>
              <WizardSteps current={0} steps={[{ id: 'a', label: 'профіль' }, { id: 'b', label: 'компанія' }]} />
            </div>
          </BBRow>
        </WfpBBSection>

        {/* Other */}
        <WfpBBSection title="Layout patterns">
          <BBRow title="Page header" code="<PageHeader title subtitle>{actions}</PageHeader>" desc="Завжди вгорі сторінки. Title 24px, sub mono 12px з `//` префіксом.">
            <div style={{ width: 600, padding: '12px 14px', border: '1px solid var(--wf-border)', borderRadius: 6, background: 'var(--wf-bg)' }}>
              <PageHeader title="Замовлення" subtitle="// 3 активних · 2 очікують вашої дії">
                <button className="wfp-btn">Експорт</button>
                <button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={13} />Нове</button>
              </PageHeader>
            </div>
          </BBRow>
          <BBRow title="Search + pill filters" code="<FilterBar search>{pills}</FilterBar>" desc="Search input ⌘K + active pills для quick-filters.">
            <div style={{ width: 600 }}>
              <FilterBar search searchPlaceholder="Шукати…">
                <button className="wfp-pill" data-on="true">всі · 5</button>
                <button className="wfp-pill">очікують 2</button>
                <button className="wfp-pill">готово</button>
              </FilterBar>
            </div>
          </BBRow>
        </WfpBBSection>

        {/* R3 · analytics + system patterns */}
        <WfpBBSection title="R3 · Аналітика та системні патерни">
          <BBRow title="Status-pill система" code=".wfas-status-pill · .wfs-status · .wfl-status" desc="Єдиний патерн на всіх R3-екранах: крапка + лейбл + бордер у колір стану. ok/active=success · pending=warning · fail/rejected=destructive · default=subtle.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="wfas-status-pill" data-s="ok">✓ OK</span>
              <span className="wfas-status-pill" data-s="fail">✗ FAIL</span>
              <span className="wfas-status-pill" data-s="untested">untested</span>
              <span className="wfl-status" data-s="pending"><span className="d" />очікує</span>
              <span className="wfl-status" data-s="approved"><span className="d" />схвалено</span>
              <span className="wfl-status" data-s="rejected"><span className="d" />відхилено</span>
            </div>
          </BBRow>

          <BBRow title="Donut · витрати за категоріями" code="<Donut data={cats} total={n} />" desc="SVG-кільце через stroke-dasharray. Кольори категорій — у даних (oklch). Центр — сума mono. Легенда поруч.">
            <div className="wff-donut-wrap" style={{ maxWidth: 360 }}>
              <Donut data={window.WFP_FINANCE.categories} total={window.WFP_FINANCE.overview.expenses} />
              <div className="wff-legend">
                {window.WFP_FINANCE.categories.slice(0, 3).map((c) => (
                  <div className="wff-legend-row" key={c.id}>
                    <span className="wff-legend-dot" style={{ background: c.color }} />
                    <span className="wff-legend-label">{c.label}</span>
                    <span className="wff-legend-amt">${c.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </BBRow>

          <BBRow title="Line chart · P&L" code="<LineChart pnl={...} /> · .wff-chart" desc="3 серії (дохід/витрати/прибуток) inline-SVG. Grid-лінії, осі mono, точки на вузлах. Реюз у /reports/revenue.">
            <div className="wff-chart" style={{ width: 560 }}>
              <div className="wff-chart-head">
                <div className="wff-chart-legend">
                  <span className="wff-chart-leg"><span className="ln" style={{ background: 'var(--wf-success, #1F8A5B)' }} />дохід</span>
                  <span className="wff-chart-leg"><span className="ln" style={{ background: 'var(--wf-destructive, #DC2626)' }} />витрати</span>
                  <span className="wff-chart-leg"><span className="ln" style={{ background: 'var(--wf-accent)' }} />прибуток</span>
                </div>
              </div>
              <LineChart pnl={window.WFP_FINANCE.pnl} />
            </div>
          </BBRow>

          <BBRow title="Balance cards · подвійний баланс" code=".wfw-bal[data-kind][data-owes]" desc="Гаманець клієнта: бонусний (lime лівий бордер) + грошовий (fg, або warning якщо борг). Велика mono-сума.">
            <div className="wfw-hero" style={{ width: 560 }}>
              <div className="wfw-bal" data-kind="bonus">
                <div className="wfw-bal-label">бонусний баланс</div>
                <div className="wfw-bal-v">$180</div>
                <div className="wfw-bal-sub">знижка до 50% рахунку</div>
              </div>
              <div className="wfw-bal" data-kind="money" data-owes="true">
                <div className="wfw-bal-label">грошовий баланс</div>
                <div className="wfw-bal-v">−$2,200</div>
                <div className="wfw-bal-sub">до сплати</div>
              </div>
            </div>
          </BBRow>

          <BBRow title="Timeline · виписка / audit" code=".wfw-timeline · .wfsm-audit-row" desc="Вертикальна стрічка подій із кольоровими вузлами за типом (payment/charge/bonus).">
            <div className="wfw-timeline" style={{ width: 420 }}>
              <div className="wfw-tl-item" data-k="payment">
                <div className="wfw-tl-head"><span className="wfw-tl-date">29.05</span><span className="wfw-tl-title">Платіж отримано</span><span className="wfw-tl-amt" style={{ color: 'var(--wf-success, #1F8A5B)' }}>$4,200</span></div>
                <div className="wfw-tl-note">банк · покрив INV-0418</div>
              </div>
              <div className="wfw-tl-item" data-k="charge">
                <div className="wfw-tl-head"><span className="wfw-tl-date">28.05</span><span className="wfw-tl-title">INV-2025-0418 виставлено</span><span className="wfw-tl-amt" style={{ color: 'var(--wf-destructive, #DC2626)' }}>−$4,200</span></div>
                <div className="wfw-tl-note">ORD-2412 · етап 1</div>
              </div>
            </div>
          </BBRow>

          <BBRow title="Cron heatmap" code=".wfsm-hm-cell[data-s]" desc="Моніторинг крон-задач: клітинки ok/fail/skip/running(пульс) за дні. Hover-scale.">
            <div style={{ display: 'flex', gap: 4 }}>
              {['ok', 'ok', 'fail', 'ok', 'skip', 'run', 'ok'].map((s, i) => (
                <span key={i} className="wfsm-hm-cell" data-s={s} style={{ width: 36, margin: 0 }} title={s} />
              ))}
            </div>
          </BBRow>

          <BBRow title="Toast · 5 варіантів" code="<Toast t={{variant,title,sub,action}} />" desc="success/error/warning/info/loading. Кольорова смужка зліва + іконка. Опційна дія. loading має спінер.">
            <div className="wft-stack" style={{ width: 360 }}>
              <Toast t={{ variant: 'success', title: 'Рахунок створено', sub: 'INV-2025-0419 надіслано' }} />
              <Toast t={{ variant: 'error', title: 'Не вдалося зберегти', sub: 'Перевірте зʼєднання', action: 'Повторити' }} />
              <Toast t={{ variant: 'loading', title: 'Генеруємо PDF…', sub: 'Специфікація ORD-2412' }} />
            </div>
          </BBRow>

          <BBRow title="Calendar atoms" code=".wfcal-pill · .wfcal-block" desc="Події в місячній сітці (пігулка) і тижневій (блок з висотою = тривалість). Колір за типом: internal/client/deadline/leave.">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <span className="wfcal-pill" data-type="client" style={{ maxWidth: 160 }}><span className="wfcal-pill-time">11:00</span><span>Демо · Brunky</span></span>
              <span className="wfcal-pill" data-type="internal" style={{ maxWidth: 160 }}><span className="wfcal-pill-time">10:00</span><span>Планерка</span></span>
              <span className="wfcal-pill" data-type="deadline" style={{ maxWidth: 160 }}><span>Дедлайн ORD-2412</span></span>
            </div>
          </BBRow>

          <BBRow title="Tier row · реферальні тіри" code=".wfw-tier[data-t]" desc="Налаштування лояльності. Кольорова мітка тіру + пороги + % бонусу.">
            <div className="wfw-tier" style={{ width: 540 }}>
              <span className="wfw-tier-name" data-t="partner"><span className="wfw-tier-badge" />Partner</span>
              <span><span className="wfw-tier-k">від</span> <span className="wfw-tier-v">$5,000</span></span>
              <span><span className="wfw-tier-v" style={{ color: 'var(--wf-accent)' }}>7%</span> <span className="wfw-tier-k">+ пріоритет</span></span>
              <span />
            </div>
          </BBRow>

          <BBRow title="Tags + dependencies" code=".wfm5-tag[data-c] · .wfm5-dep[data-r]" desc="Замовлення: кольорові теги (lime/blue/amber) + залежності blocks/blocked-by.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 420 }}>
              <div className="wfm5-tags">
                <span className="wfm5-tag" data-c="lime">automation <span className="x">×</span></span>
                <span className="wfm5-tag" data-c="blue">1c <span className="x">×</span></span>
                <span className="wfm5-tag" data-c="amber">urgent <span className="x">×</span></span>
              </div>
              <div className="wfm5-dep"><span className="wfm5-dep-rel" data-r="blocks">blocks</span><span className="wfm5-dep-id">ORD-2415</span></div>
            </div>
          </BBRow>
        </WfpBBSection>

        {/* Component list reference */}
        <WfpBBSection title="Файлова мапа">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {[
              ['product-shell.jsx',     'AppShell + Sidebar + Topbar · обгортка для всіх внутрішніх сторінок'],
              ['portal-components.jsx', 'PageHeader, StatsRow, Stat, Tabs, FileRow, UploadZone, TierBadge, FilterBar'],
              ['portal-screens.jsx',    '/orders · /orders/:id (з chat/files/docs табами) · /billing'],
              ['portal-auth.jsx',       'Login (email/phone OTP/2FA) · Register · Forgot · Reset · Invite'],
              ['portal-order-new.jsx',  '/orders/new — форма (final) + chat-bot intake (alt)'],
              ['portal-loyalty.jsx',    '/loyalty — tier ladder + progress + bonus history'],
              ['portal-referrals.jsx',  '/referrals — link + stats + list + правила'],
              ['portal-settings.jsx',   '/settings/security (phone verify, sessions, 2FA)'],
              ['portal-mobile.jsx',     'Нативні iOS-екрани: login, dashboard, order, chat, calendar'],
              ['inbox-screens.jsx',     'Global Inbox (Portal + Workspace) · master-detail з 7 типами'],
              ['workspace-screens.jsx', 'Dashboard з Kanban (board/list/timeline) · /companies/:id · /debtors'],
              ['workspace-tasks.jsx',   'Task Card v2 · /orders/intake · FloatingTimerBar + Stop/Close модали'],
              ['workspace-reports.jsx', 'Reports · Overview/Executors/Clients/Departments/Timesheet/Audit'],
              ['workspace-admin.jsx',   '/settings/departments + /team + /permissions · invite/edit модали'],
              ['workspace-services.jsx','/services-admin · /billing/services (recurring) + Notif center + Toasts'],
              ['workspace-admin-settings.jsx', 'G5 · /admin: templates · smtp · branding · nomenclature · crons'],
              ['workspace-monitoring.jsx', 'G6 · /admin/system — health · cron heatmap · audit · error log'],
              ['workspace-calendar.jsx','G7 · /calendar — month/week/day + event + RSVP + mobile'],
              ['workspace-wallet.jsx',  'G8 · /wallet (client) + /admin/wallet + referral tiers'],
              ['workspace-finance.jsx', 'G9 · /admin/finance — donut + P&L chart + expenses + /reports/pnl'],
              ['workspace-leave.jsx',   'G10 · /leave (executor) + /admin/leave + request/reject модали'],
              ['workspace-minors.jsx',  'M1–M5 · OAuth · tags/deps · chat refine · revenue · chat-hub'],
              ['email-templates.jsx',   '15 транзакційних листів (invite/order/invoice/auth/digest/…)'],
              ['documents-screens.jsx', '5 PDF templates · INV/ACT/REC/SPC/CTR · DocFrame'],
              ['product-data.js',       'Усі placeholder-дані: orders, invoices, team, loyalty, reports'],
              ['product-styles.css',    'CSS токени + базові компонентні стилі (wfp- + wfd-)'],
            ].map(([f, d]) => (
              <div key={f} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, padding: '8px 0', borderTop: '1px dashed var(--wf-border)', fontSize: 12.5 }}>
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-accent)' }}>{f}</code>
                <span style={{ color: 'var(--wf-fg-secondary)', lineHeight: 1.5 }}>{d}</span>
              </div>
            ))}
          </div>
        </WfpBBSection>
      </div>
    </div>
  );
}

function WfpBBSection({ title, children }) {
  return (
    <div className="wfp-bb-section">
      <div className="wfp-bb-h">
        <span>// {title.split(' ·')[0]}</span>
        <span className="wfp-bb-h-t">{title}</span>
      </div>
      {children}
    </div>
  );
}

function BBRow({ title, code, desc, children }) {
  return (
    <div className="wfp-bb-row">
      <div className="wfp-bb-row-l">
        <div className="wfp-bb-row-l-t">{title}</div>
        <div className="wfp-bb-row-l-d">{desc}</div>
        <code className="wfp-bb-row-l-code">{code}</code>
      </div>
      <div className="wfp-bb-row-r">
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { ProductBrandbook });
