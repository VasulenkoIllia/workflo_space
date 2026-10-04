// portal-screens.jsx — Portal screens (Block 1 update)
// Refactored to use portal-components.jsx (PageHeader, Stat, Tabs, FileRow, etc.)

// ──────────────────────────────────────────────────────────────────────
// /orders — list (B·Studio as final)
// ──────────────────────────────────────────────────────────────────────
function PortalOrders({ onOpen }) {
  const orders = window.WFP_DATA.orders;
  return (
    <React.Fragment>
      <PageHeader
        title="Замовлення"
        subtitle={`// ${orders.length} активних · 2 очікують вашої дії`}
      >
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт · демо', 'ok')}>Експорт</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Нове замовлення · демо', 'ok')}><Icon name="plus" size={14} />Нове замовлення</button>
      </PageHeader>

      <StatsRow>
        <Stat k="активних"             v="3"      sub="2 нових за тиждень" />
        <Stat k="очікують вашої дії"   v="2"      sub="оцінка + перевірка" kind="warn" />
        <Stat k="до оплати"            v="$1 550" sub="2 неоплачених рахунки" />
        <Stat k="витрачено за квартал" v="$6 400" sub="−12% до Q1" />
      </StatsRow>

      <FilterBar search searchPlaceholder="Шукати замовлення…">
        <button className="wfp-pill" data-on="true">всі · {orders.length}</button>
        <button className="wfp-pill">очікують 2</button>
        <button className="wfp-pill">в роботі 1</button>
        <button className="wfp-pill">готово 2</button>
      </FilterBar>

      <div className="wfp-orders">
        {orders.map((o) => {
          const overdue = new Date(o.deadline) < new Date('2026-05-27');
          const soon    = !overdue && (new Date(o.deadline) - new Date('2026-05-27')) < 4 * 86400000;
          const payStatus = o.paid === 0 ? 'unpaid' : (o.paid < o.total ? 'partial' : 'paid');
          return (
            <div className="wfp-order-row" key={o.num} style={{ cursor: 'pointer' }} onClick={() => onOpen && onOpen(o.num)}>
              <div className="wfp-order-num">{o.num}</div>
              <div className="wfp-order-title">
                <div className="wfp-order-title-t">{o.title}</div>
                <div className="wfp-order-title-m">
                  <span>{o.comments_unread > 0 ? `💬 ${o.comments_unread} нових` : '💬 0'}</span>
                  <span>·</span>
                  <span>📎 {o.files}</span>
                  <span>·</span>
                  <span>📄 {o.docs}</span>
                </div>
              </div>
              <StatusDot status={o.status} />
              <div className="wfp-order-money">
                <span>${o.total.toLocaleString('uk-UA')}</span>
                <span className="wfp-order-money-sub">
                  <span className={`wfp-badge wfp-badge--${payStatus}`}>
                    {payStatus === 'paid'    && 'оплачено'}
                    {payStatus === 'partial' && `${Math.round(o.paid / o.total * 100)}% оплачено`}
                    {payStatus === 'unpaid'  && 'не оплачено'}
                  </span>
                </span>
              </div>
              <div className={`wfp-order-deadline${overdue ? ' wfp-order-deadline--over' : (soon ? ' wfp-order-deadline--soon' : '')}`}>
                <span>{o.deadline.split('-').reverse().join('.')}</span>
                <span className="wfp-order-deadline-sub">{overdue ? 'прострочено' : soon ? '⚠ скоро' : 'у строк'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /orders/:id — detail with 3 tabs (Chat / Files / Documents)
// ──────────────────────────────────────────────────────────────────────
function PortalOrderDetail({ initialTab = 'chat' }) {
  const o    = window.WFP_DATA.orders[0]; // pending_approval
  const chat = window.WFP_DATA.chat;
  const files = window.WFP_DATA.order_files;
  const docs  = window.WFP_DATA.order_docs;

  const [tab, setTab] = React.useState(initialTab);

  return (
    <React.Fragment>
      <div className="wfp-od-header">
        <div>
          <div className="wfp-order-num" style={{ marginBottom: 6 }}>{o.num} · створено 22.05.2026</div>
          <h1 className="wfp-od-h1">{o.title}</h1>
          <div className="wfp-od-meta">
            <StatusDot status={o.status} />
            <span>·</span>
            <span>дедлайн: <span style={{ color: 'var(--wf-fg)' }}>{o.deadline.split('-').reverse().join('.')}</span></span>
            <span>·</span>
            <span>пріоритет: <span style={{ color: 'var(--wf-destructive)' }}>{o.priority}</span></span>
            <span>·</span>
            <span>виконавець: <AvatarsStack ids={o.assignees} /></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Завантажити рахунок · демо', 'ok')}>Завантажити рахунок</button>
        </div>
      </div>

      {/* Approval banner — only when pending_approval */}
      {o.status === 'pending_approval' && (
        <div className="wfp-approve">
          <div className="wfp-approve-l">
            <div className="wfp-approve-k">// потрібна ваша дія</div>
            <div className="wfp-approve-t">Погодьте оцінку $4 200 · 6 тижнів</div>
            <div className="wfp-approve-sub">Деталі розбивки у документі spec-ord-2412.pdf (доступний у вкладці «Документи»). Після підтвердження команда стартує — рахунок створиться автоматично.</div>
          </div>
          <div className="wfp-approve-r">
            <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Запросити правки · демо', 'ok')}>Запросити правки</button>
            <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Погодити · демо', 'ok')}><Icon name="check" size={14} />Погодити</button>
          </div>
        </div>
      )}

      <div className="wfp-od">
        <div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'chat',  label: 'Чат',        badge: chat.length },
              { id: 'files', label: 'Файли',      badge: files.length },
              { id: 'docs',  label: 'Документи',  badge: docs.length },
            ]}
            right={<div className="wfp-od-tab" style={{ color: 'var(--wf-fg-muted)', borderBottom: 0 }}>Activity →</div>}
          />

          {tab === 'chat'  && <OrderDetailChat  chat={chat} />}
          {tab === 'files' && <OrderDetailFiles files={files} />}
          {tab === 'docs'  && <OrderDetailDocs  docs={docs} />}
        </div>

        {/* Right sticky */}
        <aside>
          <div className="wfp-card" style={{ marginBottom: 16 }}>
            <div className="wfp-card-h">
              <div className="wfp-card-h-t">Фінанси</div>
              <div className="wfp-card-h-aux">// awaiting approval</div>
            </div>
            <div className="wfp-side">
              <div className="wfp-side-row"><div className="wfp-side-k">оцінка</div><div className="wfp-money-big">$4 200</div></div>
              <div className="wfp-side-row"><div className="wfp-side-k">оплачено</div><div className="wfp-side-v">$0</div></div>
              <div className="wfp-side-row"><div className="wfp-side-k">залишок</div><div className="wfp-side-v wfp-side-v-em">$4 200</div></div>
              <div className="wfp-side-row"><div className="wfp-side-k">тип</div><div className="wfp-side-v">fixed</div></div>
            </div>
          </div>

          <div className="wfp-card" style={{ marginBottom: 16 }}>
            <div className="wfp-card-h"><div className="wfp-card-h-t">Деталі</div></div>
            <div className="wfp-side">
              <div className="wfp-side-row"><div className="wfp-side-k">створено</div><div className="wfp-side-v">22.05.2026</div></div>
              <div className="wfp-side-row"><div className="wfp-side-k">дедлайн</div><div className="wfp-side-v">08.06.2026</div></div>
              <div className="wfp-side-row"><div className="wfp-side-k">пріоритет</div><div className="wfp-side-v" style={{ color: 'var(--wf-destructive)' }}>high</div></div>
              <div className="wfp-side-row"><div className="wfp-side-k">виконавці</div><div><AvatarsStack ids={o.assignees} /></div></div>
            </div>
          </div>

          <div className="wfp-card">
            <div className="wfp-card-h">
              <div className="wfp-card-h-t">Activity · останні</div>
              <div className="wfp-card-h-aux">→ повна історія</div>
            </div>
            <div>
              {window.WFP_DATA.activity.slice(0, 4).map((a, i) => (
                <div key={i} className="wfp-activity-row">
                  <span className="wfp-activity-ts">{a.ts}</span>
                  <span><span className="wfp-activity-actor">{a.actor}</span> · <span className="wfp-activity-what">{a.what}</span></span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </React.Fragment>
  );
}

// ─── Chat panel (extracted) ───
function OrderDetailChat({ chat }) {
  return (
    <div className="wfp-chat">
      {chat.map((m, i) => (
        <div key={i} className={`wfp-chat-row${m.who === 'system' ? ' wfp-chat-row--system' : ''}`}>
          <span className="wfp-chat-ts">{m.ts}</span>
          <ChatWho who={m.who} label={m.who === 'system' ? 'system' : (m.who === 'client' ? 'client' : 'illia')} />
          <div className="wfp-chat-text">
            {m.text}
            {m.attach && (
              <div className="wfp-chat-attach">
                <Icon name="paperclip" size={12} />
                <span>{m.attach.name}</span>
                <span className="wfp-chat-attach-size">· {m.attach.size}</span>
                <Icon name="download" size={12} />
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="wfp-chat-input">
        <span className="wfp-chat-input-ts">24.05 17:42</span>
        <span className="wfp-chat-input-who">client</span>
        <input className="wfp-chat-input-field" placeholder="Напишіть повідомлення... @mention підтримується, markdown ok" />
        <div className="wfp-chat-input-actions">
          <button className="wfp-iconbtn" title="Приєднати"><Icon name="paperclip" size={14} /></button>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Send · демо', 'ok')}><Icon name="send" size={12} />Send</button>
        </div>
      </div>
    </div>
  );
}

// ─── Files panel ───
function OrderDetailFiles({ files }) {
  return (
    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <UploadZone hint="PDF, DOC, XLS, PNG, ZIP · до 25 МБ · можна перетягнути кілька одразу" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0 4px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          // {files.length} файлів · 332 КБ
        </div>
        <div style={{ display: 'flex', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          <span style={{ color: 'var(--wf-fg)', fontWeight: 500 }}>всі</span>
          <span>·</span>
          <span>ваші</span>
          <span>·</span>
          <span>команди</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {files.map((f, i) => <FileRow key={i} {...f} />)}
      </div>
    </div>
  );
}

// ─── Documents panel ───
function OrderDetailDocs({ docs }) {
  return (
    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '12px 14px', border: '1px solid var(--wf-border)', borderRadius: 8, background: 'color-mix(in oklab, var(--wf-accent) 6%, transparent)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>// як це працює</div>
        <div style={{ fontSize: 13, color: 'var(--wf-fg)', lineHeight: 1.5 }}>
          Документи генеруються автоматично після ключових подій: <strong>специфікація</strong> з'являється коли команда сформулювала scope; <strong>рахунок</strong> — після підтвердження оцінки; <strong>акт виконаних робіт</strong> — після приймання проєкту.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0 4px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          // {docs.length} {docs.length === 1 ? 'документ' : 'документів'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map((d, i) => <PortalDocRow key={i} {...d} />)}
      </div>

      {/* Pending generation hint */}
      <div style={{ padding: '14px 16px', border: '1px dashed var(--wf-border-strong)', borderRadius: 6, marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 4, background: 'color-mix(in oklab, var(--wf-fg) 4%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: 'var(--wf-fg-subtle)' }}>
          ACT
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--wf-fg-secondary)' }}>Акт виконаних робіт · з'явиться після завершення</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>auto-generated · awaiting status: done</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /billing — with Invoices / Payments / Recurring tabs
// ──────────────────────────────────────────────────────────────────────
function PortalBilling({ initialTab = 'invoices' }) {
  const invoices  = window.WFP_DATA.invoices;
  const payments  = window.WFP_DATA.payments;
  const recurring = window.WFP_DATA.recurring;

  const [tab, setTab] = React.useState(initialTab);

  return (
    <React.Fragment>
      <PageHeader title="Фінанси" subtitle="// рахунки, платежі, реквізити" />

      <StatsRow>
        <Stat k="борг"                  v="$1 550"  sub="≈ ₴64 040 · НБУ 41.31" kind="warn" />
        <Stat k="сплачено за весь час"  v="$22 380" sub="12 рахунків" />
        <Stat k="бонусний баланс"       v="$340"    sub="loyalty + referral" kind="accent" />
        <Stat k="наступний tier"        v="vip"     sub="потрібно ще $2 600" />
      </StatsRow>

      <div className="wfp-billing-grid">
        <div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'invoices',  label: 'Рахунки',   badge: invoices.length  },
              { id: 'payments',  label: 'Платежі',   badge: payments.length  },
              { id: 'recurring', label: 'Recurring', badge: recurring.length },
            ]}
          />

          {tab === 'invoices'  && <BillingInvoices  invoices={invoices} />}
          {tab === 'payments'  && <BillingPayments  payments={payments} />}
          {tab === 'recurring' && <BillingRecurring recurring={recurring} />}
        </div>

        {/* Sticky pay card */}
        <div className="wfp-pay">
          <div className="wfp-pay-h">
            <span className="wfp-accent-dot" />
            Реквізити для оплати
          </div>
          <div className="wfp-pay-row">
            <div className="wfp-pay-k">Отримувач</div>
            <div className="wfp-pay-v"><span>ФОП Васюленко І. С.</span></div>
          </div>
          <div className="wfp-pay-row">
            <div className="wfp-pay-k">IBAN · UAH</div>
            <div className="wfp-pay-v">
              <span>UA21 3052 9900 0002 6005 0123 45678</span>
              <span className="wfp-pay-copy"><Icon name="copy" size={12} /></span>
            </div>
          </div>
          <div className="wfp-pay-row">
            <div className="wfp-pay-k">EDRPOU</div>
            <div className="wfp-pay-v">
              <span>3456 7890 12</span>
              <span className="wfp-pay-copy"><Icon name="copy" size={12} /></span>
            </div>
          </div>
          <div className="wfp-pay-row">
            <div className="wfp-pay-k">USDT · TRC20</div>
            <div className="wfp-pay-v">
              <span style={{ fontSize: 11 }}>TXyZ8fQ3rN9pW2vK4mB7sH1jR5cE6dA0xN</span>
              <span className="wfp-pay-copy"><Icon name="copy" size={12} /></span>
            </div>
          </div>
          <div className="wfp-pay-note">
            // у призначенні платежу обов'язково вказуйте номер інвойсу, напр. <strong style={{ color: 'var(--wf-accent-bg)' }}>"INV-2025-0411"</strong>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── Invoices tab content ───
function BillingInvoices({ invoices }) {
  return (
    <table className="wfp-table">
      <thead>
        <tr>
          <th>№</th>
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
            <td className="wfp-mono"><span className="wfp-link">{inv.order}</span></td>
            <td className="wfp-mono">{inv.date.split('-').reverse().join('.')}</td>
            <td className="wfp-mono">{inv.due.split('-').reverse().join('.')}</td>
            <td><span className={`wfp-badge wfp-badge--${inv.status}`}>{inv.status === 'paid' ? 'оплачено' : inv.status === 'partial' ? 'частково' : 'не оплачено'}</span></td>
            <td className="wfp-num">${inv.amount.toLocaleString('uk-UA')}</td>
            <td className="wfp-num" style={{ color: inv.paid === inv.amount ? 'var(--wf-success)' : 'var(--wf-fg-muted)' }}>${inv.paid.toLocaleString('uk-UA')}</td>
            <td>
              <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={12} />PDF</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Payments tab content ───
function BillingPayments({ payments }) {
  const labelByType = {
    full:     'повна оплата',
    partial:  'часткова',
    bonus:    'loyalty bonus',
    referral: 'referral bonus',
  };
  const colorByType = {
    full:     'var(--wf-success)',
    partial:  'var(--wf-warning)',
    bonus:    'var(--wf-accent)',
    referral: 'var(--wf-accent)',
  };
  return (
    <table className="wfp-table">
      <thead>
        <tr>
          <th style={{ width: 100 }}>Дата</th>
          <th className="wfp-num" style={{ width: 100 }}>Сума</th>
          <th style={{ width: 130 }}>Тип</th>
          <th style={{ width: 130 }}>Метод</th>
          <th>Замовлення / інвойс</th>
          <th className="wfp-num">в гривні</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p, i) => (
          <tr key={i}>
            <td className="wfp-mono">{p.date}</td>
            <td className="wfp-num" style={{ color: 'var(--wf-fg)', fontWeight: 600 }}>${p.amount.toLocaleString('uk-UA')}</td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: colorByType[p.type] }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                {labelByType[p.type]}
              </span>
            </td>
            <td className="wfp-mono" style={{ color: 'var(--wf-fg-secondary)', fontSize: 12 }}>{p.method}</td>
            <td>
              <div style={{ display: 'flex', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                {p.invoice !== '—' ? <span className="wfp-link">{p.invoice}</span> : <span style={{ color: 'var(--wf-fg-subtle)' }}>—</span>}
                {p.order !== '—' && <><span style={{ color: 'var(--wf-fg-subtle)' }}>·</span><span className="wfp-link">{p.order}</span></>}
              </div>
            </td>
            <td className="wfp-num" style={{ color: 'var(--wf-fg-muted)' }}>{p.uah ? `₴${p.uah.toLocaleString('uk-UA')}` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Recurring tab content ───
function BillingRecurring({ recurring }) {
  const active = recurring.filter((r) => r.status === 'active');
  const paused = recurring.filter((r) => r.status === 'paused');
  const total  = active.reduce((s, r) => s + r.amount, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="wfp-card" style={{ padding: 16 }}>
          <div className="wfp-card-h-aux">// місячний run-rate</div>
          <div className="wfp-money-big" style={{ marginTop: 4 }}>${total.toLocaleString('uk-UA')}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--wf-fg-muted)', marginLeft: 6 }}>/ міс</span></div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}>
            ≈ ₴{(total * 41.2857).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} · {active.length} активних підписок
          </div>
        </div>
        <div className="wfp-card" style={{ padding: 16 }}>
          <div className="wfp-card-h-aux">// наступне списання</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--wf-fg)' }}>01.06.2026</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 4 }}>
            $235 · «Підтримка» + «AI-токени» (відновити)
          </div>
        </div>
      </div>

      <table className="wfp-table">
        <thead>
          <tr>
            <th>Послуга</th>
            <th>Старт</th>
            <th className="wfp-num">Сума / період</th>
            <th>Наступний charge</th>
            <th className="wfp-num">Виставлено</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {recurring.map((r, i) => (
            <tr key={i}>
              <td><strong>{r.name}</strong></td>
              <td className="wfp-mono">{r.started}</td>
              <td className="wfp-num">${r.amount}<span style={{ color: 'var(--wf-fg-muted)' }}> / {r.period}</span></td>
              <td className="wfp-mono">{r.status === 'paused' ? '—' : r.next}</td>
              <td className="wfp-num">{r.invoiced}</td>
              <td>
                <span className={`wfp-badge wfp-badge--${r.status === 'active' ? 'paid' : 'soft'}`}>
                  {r.status === 'active' ? 'активна' : 'призупинено'}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {r.status === 'active' ? (
                    <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Призупинити · демо', 'ok')}>Призупинити</button>
                  ) : (
                    <button className="wfp-btn wfp-btn--ghost wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відновити · демо', 'ok')}>Відновити</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ padding: '10px 14px', border: '1px solid var(--wf-border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>// рахунки за підписками виставляються 1-го числа місяця · charge через 5 днів</span>
        <a className="wfp-link" style={{ color: 'var(--wf-fg)' }}>Налаштувати канал нагадувань →</a>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /orders/:id — Alternative compact / focused layout
// ──────────────────────────────────────────────────────────────────────
function PortalOrderDetailAlt({ initialTab = 'chat' }) {
  const o = window.WFP_DATA.orders[0];
  const chat = window.WFP_DATA.chat;
  const files = window.WFP_DATA.order_files;
  const docs  = window.WFP_DATA.order_docs;

  const [tab, setTab] = React.useState(initialTab);

  return (
    <React.Fragment>
      <div className="wfp-od--compact">
        {/* Hero header */}
        <div style={{ marginBottom: 14 }}>
          <div className="wfp-order-num" style={{ marginBottom: 4 }}>{o.num} · створено 22.05.2026</div>
          <h1 className="wfp-od-h1" style={{ fontSize: 26 }}>{o.title}</h1>
        </div>

        {/* Compact stats strip */}
        <div className="wfp-od-compact-strip">
          <div className="wfp-od-compact-stat">
            <div className="wfp-od-compact-stat-k">статус</div>
            <div className="wfp-od-compact-stat-v" style={{ fontSize: 14 }}>
              <StatusDot status={o.status} />
            </div>
          </div>
          <div className="wfp-od-compact-stat">
            <div className="wfp-od-compact-stat-k">оцінка</div>
            <div className="wfp-od-compact-stat-v">$4 200</div>
          </div>
          <div className="wfp-od-compact-stat">
            <div className="wfp-od-compact-stat-k">оплачено</div>
            <div className="wfp-od-compact-stat-v" style={{ color: 'var(--wf-fg-muted)' }}>$0</div>
          </div>
          <div className="wfp-od-compact-stat">
            <div className="wfp-od-compact-stat-k">дедлайн</div>
            <div className="wfp-od-compact-stat-v">08.06</div>
          </div>
          <div className="wfp-od-compact-stat">
            <div className="wfp-od-compact-stat-k">пріоритет</div>
            <div className="wfp-od-compact-stat-v" style={{ color: 'var(--wf-destructive)' }}>high</div>
          </div>
          <div className="wfp-od-compact-stat">
            <div className="wfp-od-compact-stat-k">виконавці</div>
            <div className="wfp-od-compact-stat-v"><AvatarsStack ids={o.assignees} /></div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Завантажити рахунок · демо', 'ok')}>Завантажити рахунок</button>
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="settings" size={13} /></button>
          </div>
        </div>

        {/* Approval banner */}
        {o.status === 'pending_approval' && (
          <div className="wfp-approve" style={{ marginBottom: 18 }}>
            <div className="wfp-approve-l">
              <div className="wfp-approve-k">// потрібна ваша дія</div>
              <div className="wfp-approve-t">Погодьте оцінку $4 200 · 6 тижнів</div>
              <div className="wfp-approve-sub">Деталі розбивки у вкладці «Документи». Після підтвердження команда стартує — рахунок створиться автоматично.</div>
            </div>
            <div className="wfp-approve-r">
              <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Запросити правки · демо', 'ok')}>Запросити правки</button>
              <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Погодити · демо', 'ok')}><Icon name="check" size={14} />Погодити</button>
            </div>
          </div>
        )}

        {/* Tabs — wider, more visible */}
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'chat',     label: 'Чат',        badge: chat.length },
            { id: 'files',    label: 'Файли',      badge: files.length },
            { id: 'docs',     label: 'Документи',  badge: docs.length },
            { id: 'details',  label: 'Деталі' },
            { id: 'activity', label: 'Activity' },
          ]}
        />

        {/* Full-width content */}
        <div style={{ marginTop: 6 }}>
          {tab === 'chat'     && <OrderDetailChat  chat={chat} />}
          {tab === 'files'    && <OrderDetailFiles files={files} />}
          {tab === 'docs'     && <OrderDetailDocs  docs={docs} />}
          {tab === 'details'  && <OrderDetailMetrics />}
          {tab === 'activity' && <OrderDetailActivityFull />}
        </div>
      </div>
    </React.Fragment>
  );
}

function OrderDetailMetrics() {
  const o = window.WFP_DATA.orders[0];
  return (
    <div style={{ padding: '20px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <div className="wfp-card">
        <div className="wfp-card-h">
          <div className="wfp-card-h-t">Фінанси</div>
          <div className="wfp-card-h-aux">// awaiting approval</div>
        </div>
        <div className="wfp-side">
          <div className="wfp-side-row"><div className="wfp-side-k">оцінка</div><div className="wfp-money-big">$4 200</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">оплачено</div><div className="wfp-side-v">$0</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">залишок</div><div className="wfp-side-v wfp-side-v-em">$4 200</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">тип</div><div className="wfp-side-v">fixed</div></div>
        </div>
      </div>
      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Параметри</div></div>
        <div className="wfp-side">
          <div className="wfp-side-row"><div className="wfp-side-k">створено</div><div className="wfp-side-v">22.05.2026</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">дедлайн</div><div className="wfp-side-v">08.06.2026</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">пріоритет</div><div className="wfp-side-v" style={{ color: 'var(--wf-destructive)' }}>high</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">категорія</div><div className="wfp-side-v">integration</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">канал</div><div className="wfp-side-v">у системі + email</div></div>
        </div>
      </div>
      <div className="wfp-card">
        <div className="wfp-card-h"><div className="wfp-card-h-t">Команда</div></div>
        <div className="wfp-side">
          <div className="wfp-side-row"><div className="wfp-side-k">виконавці</div><div><AvatarsStack ids={o.assignees} /></div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">lead</div><div className="wfp-side-v">Ілля</div></div>
          <div className="wfp-side-row"><div className="wfp-side-k">контактна особа</div><div className="wfp-side-v">Олена · ви</div></div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailActivityFull() {
  const items = window.WFP_DATA.activity;
  return (
    <div style={{ padding: '20px 0' }}>
      <div className="wfp-card">
        <div className="wfp-card-h">
          <div className="wfp-card-h-t">Повна історія · {items.length}</div>
          <div className="wfp-card-h-aux">// останні події вгорі</div>
        </div>
        {items.map((a, i) => (
          <div key={i} className="wfp-activity-row">
            <span className="wfp-activity-ts">{a.ts}</span>
            <span><span className="wfp-activity-actor">{a.actor}</span> · <span className="wfp-activity-what">{a.what}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// /login — moved to portal-auth.jsx
// ──────────────────────────────────────────────────────────────────────

Object.assign(window, {
  PortalOrders,
  PortalOrderDetail,
  PortalOrderDetailAlt,
  PortalBilling,
});
