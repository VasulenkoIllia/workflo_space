// portal-referrals.jsx — /referrals page for Portal

function PortalReferrals() {
  const r = window.WFP_DATA.referrals;
  const statusLabel = { active: 'активний клієнт', signed_up: 'зареєструвався', invited: 'запрошено', cancelled: 'скасовано' };
  const statusColor = { active: 'paid', signed_up: 'partial', invited: 'soft', cancelled: 'unpaid' };

  return (
    <React.Fragment>
      <PageHeader
        title="Реферальна програма"
        subtitle={`// ${r.stats.invited} запрошено · ${r.stats.active_clients} активних · зароблено $${r.stats.earned_total}`}
      >
        <button className="wfp-btn">Як це працює →</button>
        <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfToast && window.wfToast('Запросити email · демо', 'ok')}><Icon name="send" size={13} />Запросити email</button>
      </PageHeader>

      <StatsRow>
        <Stat k="запрошено всього"   v={r.stats.invited}        sub="з вашого посилання" />
        <Stat k="зареєструвалися"    v={r.stats.signed_up}      sub={`${Math.round(r.stats.signed_up / r.stats.invited * 100)}% conversion`} />
        <Stat k="стали клієнтами"    v={r.stats.active_clients} sub="зробили перше замовлення" kind="accent" />
        <Stat k="зароблено бонусів"  v={`$${r.stats.earned_total}`} sub={`+ ще $${r.stats.pending_potential} у роботі`} kind="accent" />
      </StatsRow>

      {/* Referral link */}
      <div className="wfp-card" style={{ marginBottom: 14 }}>
        <div className="wfp-card-h">
          <div className="wfp-card-h-t">Ваше реферальне посилання</div>
          <div className="wfp-card-h-aux">// діє безстроково · код: <strong style={{ color: 'var(--wf-accent)' }}>{r.code}</strong></div>
        </div>
        <div className="wfp-ref-link">
          <span className="wfp-ref-link-prefix">https://</span>
          <span>workflo.space/?ref=</span>
          <span className="wfp-ref-link-code">{r.code}</span>
          <button className="wfp-ref-link-copy"><Icon name="copy" size={12} />Копіювати</button>
        </div>
        <div className="wfp-ref-share">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', alignSelf: 'center', marginRight: 4 }}>// поділитися:</span>
          <button className="wfp-ref-share-btn"><Icon name="external" size={12} />Telegram</button>
          <button className="wfp-ref-share-btn" onClick={() => window.wfToast && window.wfToast('Email · демо', 'ok')}><Icon name="bell" size={12} />Email</button>
          <button className="wfp-ref-share-btn"><Icon name="external" size={12} />LinkedIn</button>
          <button className="wfp-ref-share-btn"><Icon name="external" size={12} />WhatsApp</button>
          <button className="wfp-ref-share-btn"><Icon name="download" size={12} />QR-код</button>
        </div>
      </div>

      {/* How it works */}
      <h2 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 8 }}>
        // як це працює · 3 кроки
      </h2>
      <div className="wfp-rules-grid" style={{ marginBottom: 18 }}>
        <div className="wfp-rule-card">
          <div className="wfp-rule-card-icon">1</div>
          <div className="wfp-rule-card-t">Ви ділитеся посиланням</div>
          <div className="wfp-rule-card-p">Надсилаєте друзям-підприємцям або діляєтеся у соцмережах. Реферальний код прив'язаний до вашого акаунту.</div>
        </div>
        <div className="wfp-rule-card">
          <div className="wfp-rule-card-icon">2</div>
          <div className="wfp-rule-card-t">Реферал реєструється</div>
          <div className="wfp-rule-card-p">Отримує <strong style={{ color: 'var(--wf-accent)' }}>знижку 10% на перше замовлення</strong>. Він не платить нічого зайвого і не знає про ваші бонуси.</div>
        </div>
        <div className="wfp-rule-card">
          <div className="wfp-rule-card-icon" style={{ background: 'color-mix(in oklab, var(--wf-success) 14%, transparent)', color: 'var(--wf-success)' }}>$</div>
          <div className="wfp-rule-card-t">Ви отримуєте бонус</div>
          <div className="wfp-rule-card-p">Після оплати першого замовлення рефералом — <strong style={{ color: 'var(--wf-success)' }}>5% від суми</strong> повертається вам на бонусний баланс. Плюс +1% до знижки тіру на наступний місяць.</div>
        </div>
      </div>

      {/* Referral list */}
      <div className="wfp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="wfp-card-h" style={{ padding: '14px 18px', borderBottom: '1px solid var(--wf-border)', marginBottom: 0 }}>
          <div className="wfp-card-h-t">Ваші реферали · {r.list.length}</div>
          <div className="wfp-card-h-aux">// email маскується для приватності</div>
        </div>
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Email · masked</th>
              <th>Дата запрошення</th>
              <th>Статус</th>
              <th>Перше замовлення</th>
              <th>Примітка</th>
              <th className="wfp-num">Ваш бонус</th>
            </tr>
          </thead>
          <tbody>
            {r.list.map((ref, i) => (
              <tr key={i}>
                <td className="wfp-mono">{ref.email_masked}</td>
                <td className="wfp-mono">{ref.invited_at}</td>
                <td>
                  <span className={`wfp-badge wfp-badge--${statusColor[ref.status]}`}>
                    {statusLabel[ref.status]}
                  </span>
                </td>
                <td className="wfp-mono" style={{ color: ref.first_order_at ? 'var(--wf-fg)' : 'var(--wf-fg-subtle)' }}>
                  {ref.first_order_at || '—'}
                </td>
                <td style={{ fontFamily: 'Geist, sans-serif', fontSize: 12.5, color: 'var(--wf-fg-secondary)' }}>
                  {ref.note}
                </td>
                <td className="wfp-num" style={{ color: ref.bonus > 0 ? 'var(--wf-success)' : 'var(--wf-fg-subtle)', fontWeight: ref.bonus > 0 ? 600 : 400 }}>
                  {ref.bonus > 0 ? `+$${ref.bonus}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail block: rules + transparency */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        <div style={{ padding: '14px 18px', background: 'color-mix(in oklab, var(--wf-accent) 6%, transparent)', border: '1px solid color-mix(in oklab, var(--wf-accent) 24%, var(--wf-border))', borderRadius: 8 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>// правила нарахування</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
            <li>Тільки той, хто привів — отримує бонус і знижку</li>
            <li>Сам реферал — отримує знижку на 1-ше замовлення</li>
            <li>Бонус нараховується після оплати, не при реєстрації</li>
            <li>Без лімітів на кількість рефералів</li>
          </ul>
        </div>
        <div style={{ padding: '14px 18px', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)', border: '1px dashed var(--wf-border)', borderRadius: 8 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>// чесна гра</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--wf-fg-secondary)', lineHeight: 1.6 }}>
            <li>Самопрямі — заборонено (один email = один акаунт)</li>
            <li>Якщо реферал поверне гроші — бонус відкличеться</li>
            <li>Лог нарахувань — у /reports/audit (для прозорості)</li>
            <li>Підозри на abuse → акаунт пауза, ручний review</li>
          </ul>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { PortalReferrals });
