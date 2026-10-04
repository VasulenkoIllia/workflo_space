// workspace-billing-hub.jsx — single Білінг hub: one sidebar entry, clickable
// subtabs (Рахунки · Платежі · Дебітори · Виплати · Сервіси · Гаманці).
// Removes the sidebar duplication (Дебітори/Виплати were separate items).
// Reuses the existing self-contained screens; the shared BillingSubtabs bar
// drives navigation via window.__billingNav.

const _bh = React.useState;

// Payments subtab (was unreachable in workspace before)
function WorkspacePayments() {
  const pays = window.WFP_DATA.payments || [];
  const total = pays.reduce((s, p) => s + p.amount, 0);
  return (
    <React.Fragment>
      <PageHeader title="Білінг" subtitle="// вхідні платежі клієнтів · звірка з рахунками">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт CSV · демо', 'ok')}><Icon name="download" size={13} />Експорт CSV</button>
      </PageHeader>
      <StatsRow>
        <Stat k="отримано всього" v={`$${total.toLocaleString('uk-UA')}`} sub={`${pays.length} платежів`} kind="accent" />
        <Stat k="повних" v={String(pays.filter((p) => p.type === 'full').length)} sub="закриті рахунки" />
        <Stat k="часткових" v={String(pays.filter((p) => p.type === 'partial').length)} sub="є залишок" kind="warn" />
        <Stat k="методи" v="3" sub="IBAN · USDT · картка" />
      </StatsRow>
      <BillingSubtabs active="payments" badges={{ invoices: 4, payments: pays.length, debtors: 4, payouts: 6, services: 6, wallet: 2 }} />
      <table className="wfp-table">
        <thead><tr><th>Дата</th><th>Рахунок</th><th>Замовлення</th><th>Метод</th><th className="wfp-num">Сума</th><th className="wfp-num">У UAH</th><th>Тип</th></tr></thead>
        <tbody>
          {pays.map((p, i) => (
            <tr key={i}>
              <td className="wfp-mono">{p.date}</td>
              <td className="wfp-mono"><span className="wfp-link">{p.invoice}</span></td>
              <td className="wfp-mono"><span className="wfp-link">{p.order}</span></td>
              <td>{p.method}</td>
              <td className="wfp-num" style={{ fontWeight: 600 }}>${p.amount.toLocaleString('uk-UA')}</td>
              <td className="wfp-num wfp-mono" style={{ color: 'var(--wf-fg-muted)' }}>{p.uah ? `₴${p.uah.toLocaleString('uk-UA')}` : '—'}</td>
              <td><span className={`wfp-badge wfp-badge--${p.type === 'full' ? 'paid' : 'partial'}`}>{p.type === 'full' ? 'повний' : 'частковий'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

const BILLING_BODIES = {
  invoices: 'WorkspaceBilling',
  payments: 'WorkspacePayments',
  debtors:  'WorkspaceDebtors',
  payouts:  'WorkspacePayouts',
  services: 'WorkspaceBillingServices',
  wallet:   'WalletAdminCompanies',
};

function WorkspaceBillingHub() {
  const [tab, setTab] = _bh('invoices');
  // bridge for the shared BillingSubtabs bar (rendered inside each body)
  window.__billingNav = setTab;
  const name = BILLING_BODIES[tab] || BILLING_BODIES.invoices;
  const Body = window[name];
  return Body ? React.createElement(Body) : null;
}

Object.assign(window, { WorkspacePayments, WorkspaceBillingHub });
