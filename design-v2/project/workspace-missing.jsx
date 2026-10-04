// workspace-missing.jsx — Block A of workspace deepening
// /companies (list with heatmap) · /billing overview (tabs) · /billing/payouts
// + Empty states for /intake, /reports, /companies

// ──────────────────────────────────────────────────────────────────────
// Activity heatmap (28 days mini calendar)
// ──────────────────────────────────────────────────────────────────────
function Heatmap({ values }) {
  const today = values.length - 1;
  return (
    <div className="wfp-heatmap">
      {values.map((v, i) => (
        <div
          key={i}
          className="wfp-heatmap-cell"
          data-v={Math.min(6, v) || undefined}
          title={`день -${values.length - i} · ${v} активн.`}
          style={i === today ? { outline: '1.5px solid var(--wf-fg)', outlineOffset: 1 } : {}}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /companies — list view
// ──────────────────────────────────────────────────────────────────────
function WorkspaceCompaniesList() {
  const companies = window.WFP_DATA.companies_full;
  const totalRev = companies.reduce((s, c) => s + c.revenue_total, 0);
  const activeOrders = companies.reduce((s, c) => s + c.orders_active, 0);
  const totalDebt = companies.reduce((s, c) => s + c.debt, 0);

  return (
    <React.Fragment>
      <PageHeader
        title="Клієнти"
        subtitle={`// ${companies.length} компаній · ${companies.filter((c) => c.orders_active > 0).length} активних · виручка $${totalRev.toLocaleString('uk-UA')}`}
      >
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}>Експорт CSV</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Додати клієнта · демо', 'ok')}><Icon name="plus" size={13} />Додати клієнта</button>
      </PageHeader>

      <StatsRow>
        <Stat k="всього клієнтів"     v={companies.length} sub={`${companies.filter((c) => c.tier === 'partner').length} partner-tier`} />
        <Stat k="активних замовлень"  v={activeOrders} sub="у роботі" kind="accent" />
        <Stat k="виручка · всього"    v={`$${totalRev.toLocaleString('uk-UA')}`} sub="всі часи" />
        <Stat k="загальний борг"      v={`$${totalDebt.toLocaleString('uk-UA')}`} sub={`${companies.filter((c) => c.debt > 0).length} клієнтів`} kind="warn" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати клієнта…">
        <button className="wfp-pill" data-on="true">всі · {companies.length}</button>
        <button className="wfp-pill">активні · {companies.filter((c) => c.orders_active > 0).length}</button>
        <button className="wfp-pill">з боргом · {companies.filter((c) => c.debt > 0).length}</button>
        <button className="wfp-pill">нові</button>
        <span style={{ width: 1, height: 24, background: 'var(--wf-border)', margin: '0 4px' }} />
        <button className="wfp-pill">tier ↓</button>
      </FilterBar>

      <div>
        {companies.map((c) => (
          <div className="wfp-co-row" key={c.slug}>
            <div className="wfp-co-row-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <WfAvatar kind={wfAvatarKindForIndustry(c.industry)} size="sm" shape="circle" />
              <div>
                <div className="wfp-co-row-name">{c.name}</div>
                <div className="wfp-co-row-sub">
                  <span>{c.industry}</span>
                  <span>·</span>
                  <span>{c.members} {c.members === 1 ? 'учасник' : 'учасників'}</span>
                  <span>·</span>
                  <span>останньо: {c.last_activity}</span>
                </div>
              </div>
            </div>
            <div><TierBadge tier={c.tier} /></div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                активність · 28 днів
              </div>
              <Heatmap values={c.heatmap} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600 }}>{c.orders_active}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>активних</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600 }}>{c.orders_closed}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>закрито</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600, color: c.debt > 0 ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)' }}>
                {c.debt > 0 ? `$${c.debt.toLocaleString('uk-UA')}` : '—'}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)' }}>борг</div>
            </div>
            <div>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відкрити → · демо', 'ok')}>Відкрити →</button>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Billing subtabs (used in /billing overview)
// ──────────────────────────────────────────────────────────────────────
function BillingSubtabs({ active, badges }) {
  const tabs = [
    { id: 'invoices', label: 'Рахунки',   badge: badges.invoices },
    { id: 'payments', label: 'Платежі',   badge: badges.payments },
    { id: 'debtors',  label: 'Дебітори',  badge: badges.debtors },
    { id: 'payouts',  label: 'Виплати',   badge: badges.payouts },
    { id: 'services', label: 'Сервіси',   badge: badges.services },
    { id: 'wallet',   label: 'Гаманці',   badge: badges.wallet },
  ];
  return (
    <div className="wfp-subtabs">
      {tabs.map((t) => (
        <button key={t.id} className="wfp-subtabs-tab" data-on={t.id === active || undefined}
          style={{ cursor: 'pointer' }}
          onClick={() => { if (window.__billingNav) window.__billingNav(t.id); else if (window.__wsNav) window.__wsNav('billing'); }}>
          {t.label}
          {t.badge !== undefined && <span className="wfp-subtabs-tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /billing — overview (workspace)
// ──────────────────────────────────────────────────────────────────────
function WorkspaceBilling() {
  const invoices = window.WFP_DATA.invoices;
  return (
    <React.Fragment>
      <PageHeader
        title="Білінг"
        subtitle="// рахунки клієнтів · платежі · дебітори · виплати команді"
      >
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}>Експорт CSV</button>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Канали оплати · демо', 'ok')}><Icon name="settings" size={13} />Канали оплати</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Новий рахунок · демо', 'ok')}><Icon name="plus" size={13} />Новий рахунок</button>
      </PageHeader>

      <StatsRow>
        <Stat k="отримано · травень"  v="$12 400"  sub="+18% до квітня" kind="accent" />
        <Stat k="до отримання"        v="$4 230"   sub="4 рахунки активні" kind="warn" />
        <Stat k="прострочено > 30д"   v="$2 200"   sub="NordStream · 34 дні" kind="danger" />
        <Stat k="payout · команді"    v="$6 700"   sub="6 виконавців · pending" />
      </StatsRow>

      <BillingSubtabs active="invoices" badges={{ invoices: invoices.length, payments: 5, debtors: 4, payouts: 6 }} />

      <table className="wfp-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Клієнт</th>
            <th>Замовлення</th>
            <th>Дата</th>
            <th>Строк</th>
            <th>Статус</th>
            <th className="wfp-num">Сума</th>
            <th className="wfp-num">Оплачено</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.num}>
              <td className="wfp-mono"><span className="wfp-link">{inv.num}</span></td>
              <td><strong>Brunky</strong></td>
              <td className="wfp-mono"><span className="wfp-link">{inv.order}</span></td>
              <td className="wfp-mono">{inv.date.split('-').reverse().join('.')}</td>
              <td className="wfp-mono">{inv.due.split('-').reverse().join('.')}</td>
              <td><span className={`wfp-badge wfp-badge--${inv.status}`}>{inv.status === 'paid' ? 'оплачено' : inv.status === 'partial' ? 'частково' : 'не оплачено'}</span></td>
              <td className="wfp-num">${inv.amount.toLocaleString('uk-UA')}</td>
              <td className="wfp-num" style={{ color: inv.paid === inv.amount ? 'var(--wf-success)' : 'var(--wf-fg-muted)' }}>${inv.paid.toLocaleString('uk-UA')}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Mark paid · демо', 'ok')}>Mark paid</button>
                  <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={11} />PDF</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /billing/payouts — earnings per executor
// ──────────────────────────────────────────────────────────────────────
function WorkspacePayouts() {
  const p = window.WFP_DATA.payouts;
  const totalHours = p.rows.reduce((s, r) => s + r.hours, 0);
  const billable = p.rows.reduce((s, r) => s + r.hours_billable, 0);
  return (
    <React.Fragment>
      <PageHeader
        title="Виплати команді"
        subtitle={`// період ${p.period.label} · ${p.period.closed ? 'закрито' : 'ще відкрито · оновлюється з кожною новою сесією'}`}
      >
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт payroll CSV · демо', 'ok')}><Icon name="download" size={13} />Експорт payroll CSV</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Підтвердити та виплатити · демо', 'ok')}><Icon name="check" size={13} />Підтвердити та виплатити</button>
      </PageHeader>

      <StatsRow>
        <Stat k="всього до виплати" v={`$${p.summary.total.toLocaleString('uk-UA')}`} sub={`${p.summary.executors} виконавців`} kind="accent" />
        <Stat k="billable годин"    v={`${billable}h`}                              sub={`з ${totalHours}h залогованих`} />
        <Stat k="оплачено"          v="$0"                                          sub="ще не закрито · в кінці місяця" />
        <Stat k="середня ефективність" v={`${Math.round(billable / totalHours * 100)}%`} sub="billable / total" />
      </StatsRow>

      <BillingSubtabs active="payouts" badges={{ invoices: 4, payments: 5, debtors: 4, payouts: p.rows.length }} />

      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 80px 90px 100px 100px 100px 90px', gap: 12, padding: '10px 16px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', borderBottom: '1px solid var(--wf-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span></span>
          <span>виконавець</span>
          <span>роль</span>
          <span style={{ textAlign: 'right' }}>rate $/h</span>
          <span style={{ textAlign: 'right' }}>годин</span>
          <span style={{ textAlign: 'right' }}>billable</span>
          <span style={{ textAlign: 'right' }}>base</span>
          <span style={{ textAlign: 'right' }}>bonus</span>
          <span style={{ textAlign: 'right' }}>total</span>
        </div>
        {p.rows.map((r) => (
          <div className="wfp-payout-row" key={r.id}>
            <span className={`wfp-av wfp-av--${r.id}`} style={{ width: 32, height: 32, fontSize: 11 }}>
              {r.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </span>
            <div>
              <div className="wfp-payout-row-name">{r.name}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--wf-fg-muted)', marginTop: 2 }}>{r.notes}</div>
            </div>
            <div><span className={`wfp-role-pill wfp-role-pill--${r.role}`}>{r.role}</span></div>
            <div className="wfp-payout-row-mono">${r.rate}</div>
            <div className="wfp-payout-row-mono">{r.hours}h</div>
            <div className="wfp-payout-row-mono" style={{ color: 'var(--wf-fg-muted)' }}>{r.hours_billable}h</div>
            <div className="wfp-payout-row-mono">${r.base.toLocaleString('uk-UA')}</div>
            <div className="wfp-payout-row-bonus">{r.bonus > 0 ? `+$${r.bonus}` : '—'}</div>
            <div className="wfp-payout-row-total">${r.total.toLocaleString('uk-UA')}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 80px 90px 100px 100px 100px 90px', gap: 12, padding: '14px 16px', background: 'color-mix(in oklab, var(--wf-fg) 4%, transparent)', borderTop: '2px solid var(--wf-fg)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>
          <span></span>
          <span style={{ color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>// разом</span>
          <span></span>
          <span></span>
          <span style={{ textAlign: 'right' }}>{totalHours}h</span>
          <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>{billable}h</span>
          <span style={{ textAlign: 'right' }}>${p.rows.reduce((s, r) => s + r.base, 0).toLocaleString('uk-UA')}</span>
          <span style={{ textAlign: 'right', color: 'var(--wf-accent)' }}>+${p.rows.reduce((s, r) => s + r.bonus, 0).toLocaleString('uk-UA')}</span>
          <span style={{ textAlign: 'right', color: 'var(--wf-success)' }}>${p.summary.total.toLocaleString('uk-UA')}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '14px 18px', background: 'color-mix(in oklab, var(--wf-accent) 5%, transparent)', border: '1px solid color-mix(in oklab, var(--wf-accent) 24%, var(--wf-border))', borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>// як працює виплата</div>
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
            Період закривається 1-го числа місяця. Базова виплата = billable годин × rate. Бонуси за: перевиконання estimate, AAR (after-action reports), peer-recognition. Платіж проходить SEPA через ЄДРПОУ виконавця або USDT TRC20.
          </div>
        </div>
        <button className="wfp-btn">Налаштувати правила бонусів →</button>
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Empty state component
// ──────────────────────────────────────────────────────────────────────
function WorkspaceEmpty({ title, glyph, t, sub, cta }) {
  return (
    <React.Fragment>
      <PageHeader title={title} subtitle="// порожньо · empty state" />
      <div className="wfp-empty" style={{ padding: '80px 24px' }}>
        <div className="wfp-empty-glyph">{glyph}</div>
        <div className="wfp-empty-t">{t}</div>
        <div className="wfp-empty-sub">{sub}</div>
        {cta && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {cta}
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

const IntakeEmpty = () => (
  <WorkspaceEmpty
    title="Вхідні замовлення"
    glyph={`/\\_/\\\n( ✓ ✓ )\n > ^ <`}
    t="Тиша. Жодних нових замовлень."
    sub="Усі задачі вже мають assignment. Чудовий момент для огляду /reports або retrospective з командою."
    cta={[
      <button key="r" className="wfp-btn" onClick={() => window.wfToast && window.wfToast('→ Відкрити /reports · демо', 'ok')}>→ Відкрити /reports</button>,
      <button key="b" className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Створити задачу вручну · демо', 'ok')}>Створити задачу вручну</button>,
    ]}
  />
);

const ClientsEmpty = () => (
  <WorkspaceEmpty
    title="Клієнти"
    glyph={`/\\_/\\\n( o.o )\n > ^ <`}
    t="Поки нема жодного клієнта"
    sub="Перший клієнт з'явиться коли ви запросите його через portal-link, або коли він зареєструється сам з landing page."
    cta={[
      <button key="i" className="wfp-btn">Поділитися invite-link</button>,
      <button key="a" className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Додати клієнта вручну · демо', 'ok')}><Icon name="plus" size={13} />Додати клієнта вручну</button>,
    ]}
  />
);

const ReportsEmpty = () => (
  <WorkspaceEmpty
    title="Звіти"
    glyph={`/\\_/\\\n( -.- )\n > ^ <`}
    t="Поки немає даних за обраний період"
    sub="Виберіть ширший період або переконайтеся що в системі є time-entries. Звіти оновлюються щохвилини у міру логування часу командою."
    cta={[
      <button key="p" className="wfp-btn">Розширити період</button>,
      <button key="d" className="wfp-btn wfp-btn--primary">→ Demo-данні</button>,
    ]}
  />
);

Object.assign(window, {
  WorkspaceCompaniesList,
  WorkspaceBilling,
  WorkspacePayouts,
  IntakeEmpty, ClientsEmpty, ReportsEmpty,
  Heatmap,
});
