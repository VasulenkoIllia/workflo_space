// workspace-wallet.jsx — G8 · Client Wallet.
// Portal: WalletPortal (balance + transactions + statement + rules).
// Workspace: WalletAdminCompanies, WalletAdminLedger, WalletAdjustModal, ReferralTiers.

const WFW_KIND_ICON = { payment: 'check', charge: 'receipt', bonus: 'star' };
const fmtMoney = (n) => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US');

// ───────────── Portal /wallet ─────────────
function WalletPortal({ tab = 'transactions', onTopup }) {
  const w = window.WFP_WALLET;
  return (
    <React.Fragment>
      <PageHeader title="Гаманець" subtitle="// єдиний баланс компанії · поповнення + бонуси з лояльності й рефералів">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Виписка PDF · демо', 'ok')}><Icon name="download" size={13} />Виписка PDF</button>
      </PageHeader>

      <div className="wfw-hero">
        <div className="wfw-bal" data-kind="bonus">
          <div className="wfw-bal-label"><Icon name="star" size={13} />бонусний баланс</div>
          <div className="wfw-bal-v">{fmtMoney(w.balance.bonus)}</div>
          <div className="wfw-bal-sub">з лояльності + рефералів · до 50% рахунку</div>
          <div className="wfw-bal-actions"><button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Застосувати до рахунку · демо', 'ok')}>Застосувати до рахунку</button></div>
        </div>
        <div className="wfw-bal" data-kind="money" data-owes={w.balance.moneyState === 'owes' || undefined}>
          <div className="wfw-bal-label"><Icon name="receipt" size={13} />грошовий баланс</div>
          <div className="wfw-bal-v">{fmtMoney(w.balance.money)}</div>
          <div className="wfw-bal-sub">{w.balance.moneyState === 'owes' ? 'до сплати за рахунками' : 'передоплата'}</div>
          <div className="wfw-bal-actions" style={{ display: 'flex', gap: 8 }}>
            <button className="wfp-btn wfp-btn--sm wfp-btn--primary" onClick={() => onTopup ? onTopup() : (window.wfToast && window.wfToast('Поповнити · демо', 'ok'))}><Icon name="plus" size={12} />Поповнити</button>
            {w.balance.moneyState === 'owes' && <button className="wfp-btn wfp-btn--sm" onClick={() => window.__portalNav && window.__portalNav('billing')}>До рахунків</button>}
          </div>
        </div>
      </div>

      <Tabs items={[{ id: 'transactions', label: 'Транзакції' }, { id: 'statement', label: 'Виписка' }, { id: 'rules', label: 'Правила' }]} value={tab} />

      {tab === 'transactions' && (
        <React.Fragment>
          <div className="wfw-chips">
            <span className="wfw-chip" data-on="true">всі</span>
            <span className="wfw-chip">бонуси</span>
            <span className="wfw-chip">гроші</span>
            <span className="wfw-chip">реферали</span>
          </div>
          <table className="wfp-table">
            <thead><tr><th>Дата</th><th style={{ width: '38%' }}>Опис</th><th className="wfp-num">Сума</th><th className="wfp-num">Баланс</th><th>Алокація</th></tr></thead>
            <tbody>
              {w.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="wfp-mono">{t.date}</td>
                  <td>
                    <span className="wfw-kind"><span className="wfw-kind-ic" data-k={t.kind}><Icon name={WFW_KIND_ICON[t.kind]} size={13} /></span>{t.title}</span>
                  </td>
                  <td className="wfp-num"><span className="wfw-amt" data-bonus={t.kind === 'bonus' || undefined} data-pos={t.amount > 0}>{fmtMoney(t.amount)}</span></td>
                  <td className="wfp-num wfp-mono">{fmtMoney(t.run)}</td>
                  <td><span className="wfw-alloc">{t.alloc}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </React.Fragment>
      )}

      {tab === 'statement' && (
        <div style={{ marginTop: 18 }}>
          <div className="wfw-timeline">
            {w.statement.map((s, i) => (
              <div className="wfw-tl-item" data-k={s.kind} key={i}>
                <div className="wfw-tl-head">
                  <span className="wfw-tl-date">{s.date}</span>
                  <span className="wfw-tl-title">{s.title}</span>
                  <span className="wfw-tl-amt" style={{ color: s.kind === 'payment' ? 'var(--wf-success, #1F8A5B)' : s.kind === 'bonus' ? 'var(--wf-accent)' : 'var(--wf-destructive, #DC2626)' }}>{fmtMoney(s.amount)}</span>
                </div>
                <div className="wfw-tl-note">{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div style={{ marginTop: 18 }}>
          {w.rules.map((r, i) => (
            <div className="wfw-rule" key={i}><span className="wfw-rule-k">{r[0]}</span><span className="wfw-rule-v">{r[1]}</span></div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

// ───────────── Workspace /admin/wallet/companies ─────────────
function WalletAdminCompanies() {
  const d = window.WFP_WALLET_ADMIN;
  return (
    <React.Fragment>
      <PageHeader title="Білінг · Гаманці клієнтів" subtitle="// AR + бонусні зобовʼязання по всіх компаніях">
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Експорт · демо', 'ok')}><Icon name="download" size={13} />Експорт</button>
      </PageHeader>
      <BillingSubtabs active="wallet" badges={{ invoices: 4, payments: 5, debtors: 4, payouts: 6, services: 6, wallet: d.companies.length }} />

      <StatsRow>
        <Stat k="дебіторка (AR)" v={fmtMoney(d.summary.ar)} kind="warn" sub="до отримання" />
        <Stat k="бонусні зобовʼязання" v={fmtMoney(d.summary.bonusLiability)} kind="accent" sub="нараховано клієнтам" />
        <Stat k="компаній" v={d.summary.companies} sub="з гаманцями" />
        <Stat k="з боргом" v={d.summary.overdue} kind="warn" sub="прострочено" />
      </StatsRow>

      <table className="wfp-table" style={{ marginTop: 14 }}>
        <thead><tr><th style={{ width: '34%' }}>Компанія</th><th className="wfp-num">Бонуси</th><th className="wfp-num">Грошовий баланс</th><th>Остання</th><th></th></tr></thead>
        <tbody>
          {d.companies.map((c) => (
            <tr key={c.slug}>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  <WfAvatar kind={window.wfAvatarKindForIndustry ? window.wfAvatarKindForIndustry(c.industry) : 'startup'} size="xs" shape="circle" />{c.name}
                </span>
              </td>
              <td className="wfp-num"><span className="wfw-amt" data-bonus="true">{c.bonus ? fmtMoney(c.bonus) : '—'}</span></td>
              <td className="wfp-num"><span className="wfw-co-money wfp-mono" data-owes={c.money < 0}>{fmtMoney(c.money)}</span></td>
              <td className="wfp-mono">{c.last}</td>
              <td style={{ textAlign: 'right' }}><button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Деталі</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── Workspace /admin/wallet/companies/:id ─────────────
function WalletAdminLedger() {
  const w = window.WFP_WALLET;
  return (
    <React.Fragment>
      <PageHeader title="Гаманець · Brunky" subtitle="// повний ledger + ручні коригування">
        <button className="wfp-btn"><Icon name="receipt" size={13} />Refund</button>
        <button className="wfp-btn wfp-btn--primary"><Icon name="plus" size={13} />Коригування</button>
      </PageHeader>
      <div className="wfw-hero" style={{ marginTop: 4 }}>
        <div className="wfw-bal" data-kind="bonus">
          <div className="wfw-bal-label"><Icon name="star" size={13} />бонуси</div>
          <div className="wfw-bal-v">{fmtMoney(w.balance.bonus)}</div>
        </div>
        <div className="wfw-bal" data-kind="money" data-owes="true">
          <div className="wfw-bal-label"><Icon name="receipt" size={13} />борг</div>
          <div className="wfw-bal-v">{fmtMoney(w.balance.money)}</div>
        </div>
      </div>
      <table className="wfp-table" style={{ marginTop: 14 }}>
        <thead><tr><th>Дата</th><th style={{ width: '40%' }}>Опис</th><th className="wfp-num">Сума</th><th className="wfp-num">Баланс</th><th>Джерело</th></tr></thead>
        <tbody>
          {w.transactions.map((t) => (
            <tr key={t.id}>
              <td className="wfp-mono">{t.date}</td>
              <td><span className="wfw-kind"><span className="wfw-kind-ic" data-k={t.kind}><Icon name={WFW_KIND_ICON[t.kind]} size={13} /></span>{t.title}</span></td>
              <td className="wfp-num"><span className="wfw-amt" data-bonus={t.kind === 'bonus' || undefined} data-pos={t.amount > 0}>{fmtMoney(t.amount)}</span></td>
              <td className="wfp-num wfp-mono">{fmtMoney(t.run)}</td>
              <td><span className="wfw-alloc">{t.alloc}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

// ───────────── Manual adjustment modal ─────────────
function WalletAdjustModal() {
  return (
    <div className="wfp-modal-overlay" style={{ position: 'relative', padding: 0, background: 'transparent', display: 'block' }}>
      <div className="wfp-modal" style={{ margin: 0, width: 460 }}>
        <div className="wfp-modal-h"><span className="wfp-modal-h-t">Ручне коригування · Brunky</span><span className="wfp-modal-h-aux">// audit</span><span className="wfp-modal-h-close"><Icon name="close" size={15} /></span></div>
        <div className="wfp-modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="wfcal-field"><span className="wfcal-field-label">// тип</span>
              <div className="wfas-seg"><span className="wfas-seg-opt" data-on="true">credit (+)</span><span className="wfas-seg-opt">debit (−)</span></div>
            </div>
            <div className="wfcal-field"><span className="wfcal-field-label">// сума ($)</span><input className="wfcal-input" defaultValue="50" /></div>
            <div className="wfcal-field"><span className="wfcal-field-label">// нотатка (обовʼязково · audit)</span><textarea className="wfcal-input" rows={2} defaultValue="Компенсація за затримку демо" style={{ resize: 'vertical' }} /></div>
            <div className="wfw-adj-preview"><span style={{ color: 'var(--wf-fg-muted)' }}>новий бонус-баланс:</span><span className="v">$230</span></div>
          </div>
        </div>
        <div className="wfp-modal-foot">
          <span className="wfp-modal-foot-left">// зафіксується в audit-log</span>
          <div style={{ display: 'flex', gap: 8 }}><button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Скасувати · демо', 'ok')}>Скасувати</button><button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Застосувати · демо', 'ok')}>Застосувати</button></div>
        </div>
      </div>
    </div>
  );
}

// ───────────── Referral tier settings ─────────────
function ReferralTiers() {
  const r = window.WFP_REFERRAL_TIERS;
  const f = r.formula;
  return (
    <React.Fragment>
      <PageHeader title="Білінг · Реферальні тіри" subtitle="// налаштування програми лояльності та реферального бонусу">
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-accent)' }}>● увімкнено</span>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Зберегти · демо', 'ok')}><Icon name="check" size={13} />Зберегти</button>
      </PageHeader>

      <div style={{ marginTop: 14 }}>
        {r.tiers.map((t) => (
          <div className="wfw-tier" key={t.id}>
            <span className="wfw-tier-name" data-t={t.id}><span className="wfw-tier-badge" />{t.name}</span>
            <span><span className="wfw-tier-k">від заробленого</span><br /><span className="wfw-tier-v">{fmtMoney(t.minEarned)}</span></span>
            <span><span className="wfw-tier-k">бонус</span><br /><span className="wfw-tier-v" style={{ color: 'var(--wf-accent)' }}>{t.percent}%</span> <span className="wfw-tier-k">{t.bonus}</span></span>
            <button className="wfp-btn wfp-btn--ghost wfp-btn--sm"><Icon name="edit" size={12} /></button>
          </div>
        ))}
      </div>

      <div className="wfw-formula">
        <span>{fmtMoney(f.earned)}</span><span className="op">×</span><span>{f.percent}%</span><span className="op">→</span><span className="res">{fmtMoney(f.bonus)} бонус</span>
        <span style={{ marginLeft: 'auto', color: 'var(--wf-fg-muted)', fontSize: 11 }}>// live прев'ю формули</span>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WalletPortal, WalletAdminCompanies, WalletAdminLedger, WalletAdjustModal, ReferralTiers });
