// portal-loyalty.jsx — /loyalty page for Portal
// Tier ladder + progress + bonus balance/history + rules

function PortalLoyalty() {
  const l = window.WFP_DATA.loyalty;
  const tiers = window.WFP_DATA.tiers;
  const tierOrder = ['new', 'regular', 'silver', 'partner', 'vip'];
  const tierThresholds = { new: 0, regular: 500, silver: 5000, partner: 25000, vip: 100000 };
  const currentIdx = tierOrder.indexOf(l.current_tier);

  return (
    <React.Fragment>
      <PageHeader
        title="Лояльність"
        subtitle={`// ваш tier: ${l.current_tier} · знижка ${tiers[l.current_tier].discount} · кешбек 5% → у гаманець`}
      >
        <button className="wfp-btn" onClick={() => window.__portalNav && window.__portalNav('wallet')}><Icon name="coins" size={13} />Бонуси у гаманці →</button>
      </PageHeader>

      <StatsRow>
        <Stat k="всього сплачено"  v={`$${l.total_spent_usd.toLocaleString('uk-UA')}`} sub={`≈ ₴${(l.total_spent_uah / 1000).toFixed(0)}k`} kind="accent" />
        <Stat k="поточний tier"     v={l.current_tier} sub={`знижка ${tiers[l.current_tier].discount} на наступні`} />
        <Stat k="зароблено бонусів"  v={`$${l.bonus_total_earned}`} sub="зараховано в гаманець" kind="accent" />
        <Stat k="до наступного tier" v={`$${l.next_tier_remaining.toLocaleString('uk-UA')}`} sub={`${Math.round(l.progress_pct * 100)}% до ${l.next_tier}`} kind="warn" />
      </StatsRow>

      {/* Tier ladder */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          // 5 рівнів лояльності
        </h2>
        <div className="wfp-tier-ladder">
          {tierOrder.map((id, i) => {
            const state = i < currentIdx ? 'passed' : (i === currentIdx ? 'current' : (i === currentIdx + 1 ? 'next' : 'future'));
            return (
              <div key={id} className="wfp-tier-step" data-state={state}>
                <div className="wfp-tier-step-n">tier {String(i + 1).padStart(2, '0')}</div>
                <div className="wfp-tier-step-mark">●</div>
                <div className="wfp-tier-step-l">{id}</div>
                <div className="wfp-tier-step-d">{tiers[id].discount} знижка</div>
                <div className="wfp-tier-step-thresh">
                  {tierThresholds[id] === 0 ? 'з реєстрації' : `від $${tierThresholds[id].toLocaleString('uk-UA')}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress card */}
      <div className="wfp-progress-card" style={{ marginBottom: 24 }}>
        <div className="wfp-progress-meter">
          <div className="wfp-progress-meter-h">
            <span className="wfp-progress-meter-h-l">// до tier <strong style={{ color: 'var(--wf-warning)' }}>{l.next_tier}</strong> залишилось</span>
            <span className="wfp-progress-meter-h-r">${l.spent_this_year.toLocaleString('uk-UA')} / ${l.next_tier_threshold.toLocaleString('uk-UA')}</span>
          </div>
          <div className="wfp-progress-meter-bar">
            <div className="wfp-progress-meter-fill" style={{ width: `${l.progress_pct * 100}%` }} />
          </div>
          <div className="wfp-progress-meter-marks">
            <span>silver</span>
            <span style={{ color: 'var(--wf-fg)' }}>{Math.round(l.progress_pct * 100)}% · ви тут</span>
            <span style={{ color: 'var(--wf-warning)', fontWeight: 600 }}>partner →</span>
          </div>
        </div>
        <div className="wfp-progress-aside">
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            // що дасть partner
          </div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
            <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={13} color="var(--wf-success)" />Знижка 8% замість 5%</li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={13} color="var(--wf-success)" />Пріоритет у черзі задач</li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={13} color="var(--wf-success)" />Назначений PM від нашої сторони</li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={13} color="var(--wf-success)" />Подвоєний бонусний кешбек</li>
          </ul>
        </div>
      </div>

      {/* Two-column: spending chart + bonus transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 16 }}>
        <div className="wfp-card">
          <div className="wfp-card-h">
            <div className="wfp-card-h-t">Витрати за останні 6 місяців</div>
            <div className="wfp-card-h-aux">// $ · травень 2026</div>
          </div>
          <div className="wfp-spend-chart">
            {l.spending_history.map((m, i) => {
              const max = Math.max(...l.spending_history.map((x) => x.amount));
              return (
                <div key={i} className="wfp-spend-bar" style={{ height: `${(m.amount / max) * 100}%`, opacity: m.amount === 0 ? 0.15 : 1 }}>
                  <span className="wfp-spend-bar-v">${(m.amount / 1000).toFixed(1)}k</span>
                  <span className="wfp-spend-bar-l">{m.month}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'color-mix(in oklab, var(--wf-fg) 2.5%, transparent)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--wf-fg)' }}>// trending up:</strong> ${(l.spending_history[5].amount).toLocaleString('uk-UA')} цього місяця, +39% до квітня. При такому темпі досягнете <strong style={{ color: 'var(--wf-warning)' }}>partner</strong> до 15 червня.
          </div>
        </div>

        <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="wfp-card-h" style={{ padding: '14px 18px', borderBottom: '1px solid var(--wf-border)', marginBottom: 0 }}>
            <div className="wfp-card-h-t">Бонуси</div>
            <div className="wfp-card-h-aux">// єдиний баланс — у гаманці</div>
          </div>
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.55 }}>
              Бонуси з лояльності та рефералів зараховуються на <strong>єдиний бонусний баланс у Гаманці</strong> і автоматично списуються при сплаті рахунків.
            </div>
            <div style={{ display: 'flex', gap: 18, padding: '12px 0', borderTop: '1px solid var(--wf-border)', borderBottom: '1px solid var(--wf-border)' }}>
              <div><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>поточний баланс</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--wf-accent)' }}>${l.bonus_balance}</div></div>
              <div><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--wf-fg-muted)' }}>зароблено всього</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700 }}>${l.bonus_total_earned}</div></div>
            </div>
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => window.__portalNav && window.__portalNav('wallet')}><Icon name="coins" size={13} />Історія бонусів у гаманці</button>
          </div>
        </div>
      </div>

      {/* Rules cards */}
      <h2 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 8 }}>
        // як заробити бонус
      </h2>
      <div className="wfp-rules-grid">
        <div className="wfp-rule-card">
          <div className="wfp-rule-card-icon" style={{ background: 'color-mix(in oklab, var(--wf-success) 14%, transparent)', color: 'var(--wf-success)' }}>$</div>
          <div className="wfp-rule-card-t">Оплачуйте замовлення</div>
          <div className="wfp-rule-card-p">5% від оплати повертається на бонусний баланс. Чим вищий tier — тим більший cashback (до 12% для vip).</div>
        </div>
        <div className="wfp-rule-card">
          <div className="wfp-rule-card-icon" style={{ background: 'color-mix(in oklab, var(--wf-accent) 14%, transparent)', color: 'var(--wf-fg)' }}>👥</div>
          <div className="wfp-rule-card-t">Запрошуйте інших клієнтів</div>
          <div className="wfp-rule-card-p">Поділіться реферальним посиланням. Коли запрошений зробить перше замовлення — ви отримаєте 5% від його суми як бонус. Деталі — у <strong>/referrals</strong>.</div>
        </div>
        <div className="wfp-rule-card">
          <div className="wfp-rule-card-icon" style={{ background: 'color-mix(in oklab, var(--wf-warning) 14%, transparent)', color: 'var(--wf-warning)' }}>📝</div>
          <div className="wfp-rule-card-t">Швидко погоджуйте</div>
          <div className="wfp-rule-card-p">Підпис специфікації або акту за 24 години — +$20 на бонусний баланс. Допомагає команді планувати завантаження.</div>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: '14px 18px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--wf-fg)' }}>// як витратити бонус:</strong>
          {' '}при сплаті будь-якого рахунку — оплата автоматично спишеться з балансу до повного покриття. Можна вимкнути в /settings/billing.
        </div>
        <button className="wfp-btn">Деталі правил →</button>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { PortalLoyalty });
