// inbox-screens.jsx — Global Inbox for Portal + Workspace
// Master-detail layout: filterable list on the left, focused thread on the right.

const INBOX_KIND = {
  chat:      { label: 'чат',      glyph: '💬' },
  mention:   { label: '@згадка',  glyph: '@'  },
  status:    { label: 'статус',   glyph: '→'  },
  doc:       { label: 'документ', glyph: '📄' },
  payment:   { label: 'платіж',   glyph: '$'  },
  overdue:   { label: 'борг',     glyph: '!'  },
  order:     { label: 'новий',    glyph: '+'  },
  marketing: { label: 'продукт',  glyph: '★'  },
  system:    { label: 'system',   glyph: '#'  },
};

// ──────────────────────────────────────────────────────────────────────
// PortalInbox / WorkspaceInbox — one component, two modes
// ──────────────────────────────────────────────────────────────────────
function GlobalInbox({ mode = 'portal', filter = 'all', selectedId }) {
  const data = mode === 'portal'
    ? window.WFP_DATA.portal_inbox
    : window.WFP_DATA.workspace_inbox;

  // master-detail: which thread is open. null → list view on phone.
  const [openId, setOpenId] = React.useState(null);

  // Filter logic
  const filtered = data.filter((m) => {
    if (filter === 'all')      return true;
    if (filter === 'unread')   return m.unread;
    if (filter === 'mentions') return m.mentioned;
    if (filter === 'system')   return m.kind === 'system' || m.kind === 'marketing';
    return true;
  });

  // Default selected — opened row, else prop, else first unread / first row
  const sel = (openId && filtered.find((m) => m.id === openId))
    || (selectedId ? filtered.find((m) => m.id === selectedId) : null)
    || (filtered.find((m) => m.unread) || filtered[0]);

  const counts = {
    all:      data.length,
    unread:   data.filter((m) => m.unread).length,
    mentions: data.filter((m) => m.mentioned).length,
    system:   data.filter((m) => m.kind === 'system' || m.kind === 'marketing').length,
  };

  return (
    <React.Fragment>
      <PageHeader
        title="Інбокс"
        subtitle={mode === 'portal'
          ? `// ${counts.unread} нових · по всіх ваших замовленнях + системні`
          : `// ${counts.unread} нових · по всіх клієнтах і команді`
        }
      >
        <button className="wfp-btn">Позначити прочитаним</button>
        <button className="wfp-btn"><Icon name="settings" size={13} />Канали</button>
      </PageHeader>

      <div className="wfp-ibox" data-mobile-view={openId ? 'detail' : 'list'}>
        {/* Left — list */}
        <div className="wfp-ibox-list">
          <div className="wfp-ibox-list-h">
            <div className="wfp-search" style={{ height: 32, minWidth: 0 }}>
              <Icon name="search" size={13} color="var(--wf-fg-muted)" />
              <input placeholder="Шукати в інбоксі…" />
            </div>
            <div className="wfp-ibox-list-tabs">
              <span className="wfp-ibox-list-tab" data-on={filter === 'all'      || undefined}>усі <span className="wfp-ibox-list-tab-count">{counts.all}</span></span>
              <span className="wfp-ibox-list-tab" data-on={filter === 'unread'   || undefined}>непрочитані <span className="wfp-ibox-list-tab-count">{counts.unread}</span></span>
              <span className="wfp-ibox-list-tab" data-on={filter === 'mentions' || undefined}>@згадки <span className="wfp-ibox-list-tab-count">{counts.mentions}</span></span>
              <span className="wfp-ibox-list-tab" data-on={filter === 'system'   || undefined}>system <span className="wfp-ibox-list-tab-count">{counts.system}</span></span>
            </div>
          </div>

          <div className="wfp-ibox-list-rows">
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                $ ls inbox/{filter}<br />
                <span style={{ color: 'var(--wf-fg-subtle)' }}># нічого тут</span>
              </div>
            ) : filtered.map((m) => (
              <InboxRow
                key={m.id}
                m={m}
                selected={sel && sel.id === m.id}
                mode={mode}
                onOpen={() => setOpenId(m.id)}
              />
            ))}
          </div>
        </div>

        {/* Right — detail */}
        {sel ? <InboxDetail m={sel} mode={mode} onBack={() => setOpenId(null)} /> : <InboxEmpty />}
      </div>
    </React.Fragment>
  );
}

function InboxRow({ m, selected, mode, onOpen }) {
  const k = INBOX_KIND[m.kind] || INBOX_KIND.system;
  const sourceLabel = mode === 'portal'
    ? m.company || m.source
    : m.client || m.source;
  // pick an avatar: a person actor → role glyph; client/company → industry; else kind glyph
  const KIND_GLYPH = { doc: 'file', status: 'alert', payment: 'fintech', system: 'devops', marketing: 'agency', chat: 'support', mention: 'support' };
  let avKind = 'support', avShape = 'circle';
  if (m.actor && window.WFA_PERSON_KIND && window.WFA_PERSON_KIND[m.actor]) {
    avKind = window.WFA_PERSON_KIND[m.actor]; avShape = 'tile';
  } else if (mode === 'workspace' && (m.client || m.company)) {
    avKind = window.wfAvatarKindForIndustry ? window.wfAvatarKindForIndustry(m.client || m.company) : 'startup';
  } else {
    avKind = KIND_GLYPH[m.kind] || 'support';
  }
  return (
    <div
      className="wfp-ibox-row"
      data-unread={m.unread || undefined}
      data-selected={selected || undefined}
      data-internal={m.internal || undefined}
      onClick={onOpen}
      style={{ cursor: 'pointer' }}
    >
      <span className="wfp-ibox-row-unread" />
      {window.WfAvatar && <WfAvatar kind={avKind} size="sm" shape={avShape} />}
      <div className="wfp-ibox-row-body">
        <div className="wfp-ibox-row-meta">
          <span className={`wfp-ibox-row-kind wfp-ibox-row-kind--${m.kind}`}>{k.label}</span>
          <span className="wfp-ibox-row-source">
            {m.source !== 'system' && <span style={{ color: 'var(--wf-fg-muted)' }}>{m.source} · </span>}
            {sourceLabel}
          </span>
        </div>
        <div className="wfp-ibox-row-title">{m.source_title}</div>
        <div className="wfp-ibox-row-preview">
          {m.actor && m.actor !== 'system' && m.actor !== 'workflo' && (
            <strong style={{ color: 'var(--wf-fg)' }}>{m.actor_name || m.actor}: </strong>
          )}
          {m.preview}
        </div>
      </div>
      <span className="wfp-ibox-row-ts">{m.ts.split(' ')[0]}</span>
    </div>
  );
}

function InboxEmpty() {
  return (
    <div className="wfp-ibox-empty">
      <div className="wfp-ibox-empty-glyph">{`/\\_/\\\n( -.-)\n > ^ <`}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--wf-fg-secondary)' }}>Виберіть повідомлення</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>// клік на елемент зліва → відкриє контекст</div>
    </div>
  );
}

// ─── Detail pane: switches based on kind ───
function InboxDetail({ m, mode, onBack }) {
  const isOrderContext = m.source && m.source.startsWith('ORD-');
  const isInvoiceContext = m.source && (m.source.startsWith('INV-') || m.source.startsWith('ACT-'));

  return (
    <div className="wfp-ibox-detail">
      <div className="wfp-ibox-detail-h">
        {onBack && (
          <button className="wfp-backbar wfp-ibox-back" onClick={onBack}>
            <Icon name="chevron" size={15} style={{ transform: 'rotate(90deg)' }} />Назад до списку
          </button>
        )}
        <div className="wfp-ibox-detail-meta">
          <span className={`wfp-ibox-row-kind wfp-ibox-row-kind--${m.kind}`}>{INBOX_KIND[m.kind]?.label}</span>
          {m.source !== 'system' && <span style={{ color: 'var(--wf-fg)', fontWeight: 500 }}>{m.source}</span>}
          <span>·</span>
          <span>{mode === 'portal' ? m.company : m.client}</span>
          <span>·</span>
          <span>{m.ts}</span>
        </div>
        <div className="wfp-ibox-detail-t">{m.source_title}</div>
        <div className="wfp-ibox-detail-actions">
          {isOrderContext && (
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відкрити замовлення → · демо', 'ok')}>
              <Icon name="external" size={12} />Відкрити замовлення →
            </button>
          )}
          {isInvoiceContext && (
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відкрити рахунок → · демо', 'ok')}>
              <Icon name="external" size={12} />Відкрити рахунок →
            </button>
          )}
          {!isOrderContext && !isInvoiceContext && (
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm">
              <Icon name="external" size={12} />Детальніше →
            </button>
          )}
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Позначити непрочитаним</button>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Snooze · 1д</button>
        </div>
      </div>

      <div className="wfp-ibox-detail-body">
        {/* Different rendering by kind */}
        {(m.kind === 'chat' || m.kind === 'mention') && <InboxChatThread m={m} mode={mode} />}
        {m.kind === 'status'     && <InboxStatusCard m={m} />}
        {m.kind === 'doc'        && <InboxDocCard m={m} />}
        {m.kind === 'payment'    && <InboxPaymentCard m={m} />}
        {m.kind === 'overdue'    && <InboxOverdueCard m={m} />}
        {m.kind === 'order'      && <InboxNewOrderCard m={m} />}
        {(m.kind === 'system' || m.kind === 'marketing') && <InboxBroadcastCard m={m} />}
      </div>
    </div>
  );
}

// ─── Chat thread (recent messages + quick reply) ───
function InboxChatThread({ m, mode }) {
  const thread = window.WFP_DATA.inbox_thread_2412;
  return (
    <div>
      <div className="wfp-chat" style={{ padding: '8px 18px', maxHeight: 'none' }}>
        {thread.map((msg, i) => (
          <div key={i} className={`wfp-chat-row${msg.who === 'system' ? ' wfp-chat-row--system' : ''}${m.internal && msg.who !== 'client' ? ' wfp-chat-row--internal' : ''}`}>
            <span className="wfp-chat-ts">{msg.ts}</span>
            <ChatWho who={msg.who} label={msg.who === 'system' ? 'system' : (msg.who === 'client' ? 'client' : 'illia')} />
            <div className="wfp-chat-text">{msg.text}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px dashed var(--wf-border)' }}>
        <div className="wfp-chat-input" style={{ padding: 0, border: 0 }}>
          <span className="wfp-chat-input-ts">24.05 17:42</span>
          <span className="wfp-chat-input-who">{mode === 'portal' ? 'client' : 'illia'}</span>
          <input className="wfp-chat-input-field" placeholder={`Швидка відповідь у ${m.source}…`} />
          <div className="wfp-chat-input-actions">
            <button className="wfp-iconbtn" title="Файл"><Icon name="paperclip" size={14} /></button>
            <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Send · демо', 'ok')}><Icon name="send" size={12} />Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxStatusCard({ m }) {
  return (
    <div className="wfp-ibox-system-card">
      <div className="wfp-ibox-system-card-l">// зміна статусу</div>
      <div className="wfp-ibox-system-card-t">Статус замовлення оновлено</div>
      <div className="wfp-ibox-system-card-p">{m.preview}</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0 0', borderTop: '1px dashed var(--wf-border)', marginTop: 6 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-fg-muted)' }}>clarification</span>
        <Icon name="chev_r" size={14} color="var(--wf-accent)" />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--wf-accent)', fontWeight: 600 }}>estimating</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)' }}>{m.ts}</span>
      </div>
    </div>
  );
}

function InboxDocCard({ m }) {
  const isInv = m.source && m.source.startsWith('INV-');
  const isAct = m.source && m.source.startsWith('ACT-');
  const isSpc = m.source && m.source.startsWith('SPC-');
  const code = isInv ? 'INV' : isAct ? 'ACT' : isSpc ? 'SPC' : 'DOC';
  return (
    <div className="wfp-ibox-system-card">
      <div className="wfp-ibox-system-card-l">// новий документ</div>
      <div className="wfp-ibox-system-card-t">{m.source_title}</div>
      <div className="wfp-ibox-system-card-p">{m.preview}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 0 0', borderTop: '1px dashed var(--wf-border)', marginTop: 6 }}>
        <div style={{ width: 52, height: 66, border: '1px solid var(--wf-border)', borderRadius: 4, background: 'var(--wf-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: isInv ? 'var(--wf-fg)' : isAct ? 'var(--wf-success)' : 'var(--wf-accent-bg)' }}>
          {code}
        </div>
        <div>
          <div className="wfp-mono" style={{ fontSize: 13, fontWeight: 600 }}>{m.source}</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>PDF · A4 · згенеровано {m.ts}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Open · демо', 'ok')}><Icon name="external" size={11} />Open</button>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('PDF · демо', 'ok')}><Icon name="download" size={11} />PDF</button>
        </div>
      </div>
    </div>
  );
}

function InboxPaymentCard({ m }) {
  return (
    <div className="wfp-ibox-system-card" style={{ borderColor: 'color-mix(in oklab, var(--wf-success) 24%, var(--wf-border))', background: 'color-mix(in oklab, var(--wf-success) 5%, transparent)' }}>
      <div className="wfp-ibox-system-card-l" style={{ color: 'var(--wf-success)' }}>// $ платіж</div>
      <div className="wfp-ibox-system-card-t">{m.source_title}</div>
      <div className="wfp-ibox-system-card-p">{m.preview}</div>
      {m.amount && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 32, fontWeight: 600, color: 'var(--wf-success)', marginTop: 4, fontFeatureSettings: '"tnum"' }}>
          + ${m.amount.toLocaleString('uk-UA')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відкрити рахунок · демо', 'ok')}><Icon name="external" size={11} />Відкрити рахунок</button>
      </div>
    </div>
  );
}

function InboxOverdueCard({ m }) {
  return (
    <div className="wfp-ibox-system-card" style={{ borderColor: 'color-mix(in oklab, var(--wf-destructive) 24%, var(--wf-border))', background: 'color-mix(in oklab, var(--wf-destructive) 5%, transparent)' }}>
      <div className="wfp-ibox-system-card-l" style={{ color: 'var(--wf-destructive)' }}>// борг прострочено</div>
      <div className="wfp-ibox-system-card-t">{m.source_title}</div>
      <div className="wfp-ibox-system-card-p">{m.preview}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Особисто нагадати · демо', 'ok')}>Особисто нагадати</button>
        <button className="wfp-btn wfp-btn--sm">Auto-reminder ще раз</button>
      </div>
    </div>
  );
}

function InboxNewOrderCard({ m }) {
  return (
    <div className="wfp-ibox-system-card">
      <div className="wfp-ibox-system-card-l">// нове замовлення</div>
      <div className="wfp-ibox-system-card-t">{m.source_title}</div>
      <div className="wfp-ibox-system-card-p">{m.preview}</div>
      <div style={{ marginTop: 8, padding: 12, background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>клієнт</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{m.client}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>пріоритет</div>
          <div style={{ fontWeight: 500, marginTop: 2, color: 'var(--wf-destructive)' }}>high</div>
        </div>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>дедлайн</div>
          <div style={{ fontWeight: 500, marginTop: 2 }} className="wfp-mono">12.06</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Призначити виконавця · демо', 'ok')}>Призначити виконавця</button>
        <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відкрити замовлення · демо', 'ok')}>Відкрити замовлення</button>
      </div>
    </div>
  );
}

function InboxBroadcastCard({ m }) {
  const isMarketing = m.kind === 'marketing';
  return (
    <div className="wfp-ibox-system-card" style={isMarketing ? {} : { borderStyle: 'dashed', background: 'color-mix(in oklab, var(--wf-fg) 1.5%, transparent)' }}>
      <div className="wfp-ibox-system-card-l">{isMarketing ? '// продукт · workflo' : '// системне повідомлення'}</div>
      <div className="wfp-ibox-system-card-t">{m.source_title}</div>
      <div className="wfp-ibox-system-card-p">{m.preview}</div>
      {isMarketing && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="wfp-btn wfp-btn--primary wfp-btn--sm">Спробувати</button>
          <button className="wfp-btn wfp-btn--ghost wfp-btn--sm">Не показувати такі</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  GlobalInbox,
  PortalInbox: (props) => <GlobalInbox mode="portal" {...props} />,
  WorkspaceInbox: (props) => <GlobalInbox mode="workspace" {...props} />,
});
