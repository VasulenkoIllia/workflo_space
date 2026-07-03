// workspace-minors.jsx — M1–M5 interaction refinements showcase.
// M1 OAuthButtons · M2 OrderTagsDeps · M3 ChatRefine · M4 RevenueReport · M5 ChatHubRefine.

// M1 — OAuth buttons (terminal-styled brand glyphs)
function OAuthButtons() {
  return (
    <div className="wfm5-oauth">
      <button className="wfm5-oauth-btn">
        <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.6a4.8 4.8 0 0 1-2.08 3.15v2.6h3.36C20.8 18 22 15.4 22 12.2z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.36-2.6c-.93.62-2.12.99-3.27.99-2.52 0-4.65-1.7-5.41-3.99H3.13v2.68A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.59 13.97a6 6 0 0 1 0-3.83V7.46H3.13a10 10 0 0 0 0 9.08l3.46-2.57z"/><path fill="#EA4335" d="M12 6.18c1.47 0 2.78.5 3.82 1.5l2.85-2.85A10 10 0 0 0 3.13 7.46l3.46 2.68C7.35 7.88 9.48 6.18 12 6.18z"/></svg>
        Continue with Google
      </button>
      <button className="wfm5-oauth-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>
        Continue with GitHub
      </button>
      <div className="wfm5-divider">або email + пароль</div>
    </div>
  );
}

// M2 — order tags + dependencies + templates dropdown
function OrderTagsDeps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <span className="wfm5-field-label">// теги замовлення</span>
        <div className="wfm5-tags">
          <span className="wfm5-tag" data-c="lime">automation <span className="x">×</span></span>
          <span className="wfm5-tag" data-c="blue">1c <span className="x">×</span></span>
          <span className="wfm5-tag" data-c="amber">urgent <span className="x">×</span></span>
          <input className="wfm5-tag-input" placeholder="+ тег…" />
        </div>
      </div>
      <div>
        <span className="wfm5-field-label">// залежності</span>
        <div className="wfm5-deps">
          <div className="wfm5-dep"><span className="wfm5-dep-rel" data-r="blocks">blocks</span><span className="wfm5-dep-id">ORD-2415</span><span style={{ color: 'var(--wf-fg-muted)', fontSize: 12 }}>Webhook retry queue</span></div>
          <div className="wfm5-dep"><span className="wfm5-dep-rel" data-r="blocked">blocked by</span><span className="wfm5-dep-id">ORD-2410</span><span style={{ color: 'var(--wf-fg-muted)', fontSize: 12 }}>Налаштування CRM воронок</span></div>
        </div>
      </div>
      <div>
        <span className="wfm5-field-label">// шаблон замовлення (preset поля)</span>
        <div className="wfm5-tpl-dd">
          <div className="wfm5-tpl-opt"><div className="wfm5-tpl-opt-t">Інтеграція 1С</div><div className="wfm5-tpl-opt-d">department: dev · estimate: 16год · tags: 1c, automation</div></div>
          <div className="wfm5-tpl-opt"><div className="wfm5-tpl-opt-t">Telegram-бот</div><div className="wfm5-tpl-opt-d">department: dev · estimate: 24год · tags: telegram</div></div>
          <div className="wfm5-tpl-opt"><div className="wfm5-tpl-opt-t">Парсер даних</div><div className="wfm5-tpl-opt-d">department: automation · estimate: 8год · tags: parsing</div></div>
        </div>
      </div>
    </div>
  );
}

// M3 — chat refinements
function ChatRefine() {
  const av = (id) => (window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[id]) || 'developer';
  return (
    <div className="wfm5-chat">
      {/* message with reply-to + reactions + read receipt */}
      <div className="wfm5-msg">
        <WfAvatar kind={av('oleh')} size="sm" />
        <div className="wfm5-msg-body">
          <div className="wfm5-msg-head"><span className="wfm5-msg-who">Олег</span><span className="wfm5-msg-ts">13:48</span></div>
          <div className="wfm5-quote"><div className="wfm5-quote-who">Ілля</div><div className="wfm5-quote-txt">глянь версію 1С 8.3 БП?</div></div>
          <div className="wfm5-bubble">Так, 8.3 БП — REST через ВЕБ-сервіси підтримується. Закриємо сьогодні 👍</div>
          <div className="wfm5-reactions">
            <span className="wfm5-react" data-mine="true">👍 2</span>
            <span className="wfm5-react">🔥 1</span>
            <span className="wfm5-react wfm5-react-add"><Icon name="plus" size={11} /></span>
          </div>
          <div className="wfm5-receipt" data-read="true"><Icon name="eye" size={11} />прочитано · Ілля, Марія</div>
        </div>
      </div>
      {/* own message with edit affordance + edited mark */}
      <div className="wfm5-msg">
        <WfAvatar kind={av('illia')} size="sm" />
        <div className="wfm5-msg-body">
          <div className="wfm5-msg-head"><span className="wfm5-msg-who">Ілля</span><span className="wfm5-msg-ts">13:50</span><span className="wfm5-msg-edited">· ред.</span>
            <span className="wfm5-msg-tools" style={{ marginLeft: 'auto' }}>
              <span className="wfm5-msg-tool"><Icon name="edit" size={12} /></span>
              <span className="wfm5-msg-tool"><Icon name="send" size={12} /></span>
            </span>
          </div>
          <div className="wfm5-bubble">Супер. Демо о 16:00 тоді.</div>
          <div className="wfm5-picker"><span>👍</span><span>🔥</span><span>✅</span><span>🙏</span><span>😄</span></div>
        </div>
      </div>
    </div>
  );
}

// M4 — /reports/revenue (reuse LineChart from finance)
function RevenueReport() {
  const f = window.WFP_FINANCE;
  return (
    <React.Fragment>
      <PageHeader title="Звіт · Виручка" subtitle="// дохід / витрати / прибуток за період + breakdown">
        <button className="wfp-btn"><Icon name="download" size={13} />CSV</button>
      </PageHeader>
      <StatsRow>
        <Stat k="виручка · міс" v={`$${f.overview.income.toLocaleString('en-US')}`} kind="accent" sub={`+${f.overview.delta}%`} />
        <Stat k="витрати" v={`$${f.overview.expenses.toLocaleString('en-US')}`} sub="за категоріями" />
        <Stat k="прибуток" v={`$${f.overview.net.toLocaleString('en-US')}`} sub={`маржа ${f.overview.margin}%`} />
        <Stat k="середній чек" v="$2 467" sub="на замовлення" />
      </StatsRow>
      <div style={{ marginTop: 16 }}>
        <PnlChart />
      </div>
    </React.Fragment>
  );
}

// M5 — chat hub conversation rows
function ChatHubRefine() {
  const av = (id) => (window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[id]) || 'developer';
  return (
    <div style={{ maxWidth: 560 }}>
      <div className="wfm5-conv is-new">
        <span className="wfm5-conv-pulse" />
        <WfAvatar kind="food" size="sm" shape="circle" />
        <div className="wfm5-conv-main">
          <div className="wfm5-conv-top"><span className="wfm5-conv-name">Brunky · ORD-2412</span><span className="wfm5-conv-ts">щойно</span></div>
          <div className="wfm5-conv-prev">Олена: дякую, чекаємо демо!</div>
        </div>
        <span className="wfm5-conv-badge">3</span>
        <span className="wfm5-conv-acts"><span className="wfm5-conv-act" title="mute"><Icon name="alert" size={13} /></span><span className="wfm5-conv-act" title="archive"><Icon name="inbox" size={13} /></span></span>
      </div>
      <div className="wfm5-conv">
        <WfAvatar kind={av('oleh')} size="sm" />
        <div className="wfm5-conv-main">
          <div className="wfm5-conv-top"><span className="wfm5-conv-name">Олег · внутрішній</span><span className="wfm5-conv-ts">12 хв</span></div>
          <div className="wfm5-conv-prev">REST через ВЕБ-сервіси підтримується…</div>
        </div>
        <span className="wfm5-conv-acts"><span className="wfm5-conv-act" title="archive"><Icon name="inbox" size={13} /></span></span>
      </div>
      <div className="wfm5-conv is-muted">
        <WfAvatar kind="logistics" size="sm" shape="circle" />
        <div className="wfm5-conv-main">
          <div className="wfm5-conv-top"><span className="wfm5-conv-name">NordStream · ORD-2413</span><span className="wfm5-conv-ts">2 год</span></div>
          <div className="wfm5-conv-prev">🔇 без звуку · Notion → Telegram digest</div>
        </div>
        <span className="wfm5-conv-badge">1</span>
        <span className="wfm5-conv-acts"><span className="wfm5-conv-act" title="unmute"><Icon name="alert" size={13} /></span></span>
      </div>
    </div>
  );
}

Object.assign(window, { OAuthButtons, OrderTagsDeps, ChatRefine, RevenueReport, ChatHubRefine });
