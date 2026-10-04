// portal-order-new.jsx — Portal /orders/new
// Two variants: form-based (final) + conversational chat-style (alt)

// ──────────────────────────────────────────────────────────────────────
// Final: form-based with side preview
// ──────────────────────────────────────────────────────────────────────
function PortalOrderNew() {
  const [prio, setPrio] = React.useState('normal');
  const [billing, setBilling] = React.useState('fixed');
  const [channel, setChannel] = React.useState('system');
  const draft = {
    title: 'Інтеграція 1С ↔ Telegram-бот для водіїв',
    deadline: '15.06.2026',
    priority: 'normal',
    billing: 'fixed',
    category: 'integration',
    budget: 4000,
    files: 1,
    contact: 'chat',
  };

  return (
    <React.Fragment>
      <PageHeader
        title="Нове замовлення"
        subtitle="// розкажіть що потрібно — оцінку дамо за день"
      >
        <button className="wfp-btn" onClick={() => window.__portalNav && window.__portalNav('orders')}>Скасувати</button>
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Чернетку збережено', 'ok')}>Зберегти чернетку</button>
      </PageHeader>

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div>
          <div className="wfp-no-section">
            <div className="wfp-no-section-h">
              <div className="wfp-no-section-h-t" data-n="1">Що потрібно зробити?</div>
              <div className="wfp-no-section-h-aux">// обов'язково</div>
            </div>
            <div className="wfp-field">
              <label>Назва замовлення</label>
              <input defaultValue={draft.title} />
              <div className="wfp-field-hint">1 речення · ≥10 символів · побачите ви та команда</div>
            </div>
            <div className="wfp-field" style={{ marginTop: 12 }}>
              <label>Опис · детально</label>
              <div className="wfp-no-toolbar">
                <span className="wfp-no-toolbar-btn"><strong>B</strong></span>
                <span className="wfp-no-toolbar-btn"><em>i</em></span>
                <span className="wfp-no-toolbar-btn">`code`</span>
                <span className="wfp-no-toolbar-btn">— list</span>
                <span className="wfp-no-toolbar-btn">→</span>
                <span style={{ marginLeft: 'auto', color: 'var(--wf-fg-subtle)' }}>markdown</span>
              </div>
              <textarea
                className="wfp-no-textarea"
                defaultValue={`Маємо 54 водія, працюємо з 1С 8.3 БП. Зараз накладні приходять у Viber у форматі "фото + ПІБ + сума" — це хаос.

Потрібно:
- Telegram-бот для водіїв (submit накладної)
- Парсер фото з AI-валідацією
- Створення документа "Надходження товарів" у 1С автоматично
- Адмін-панель з manual review queue

Очікуємо ~180 накладних/день. Деталі — у файлі examples.zip.`}
                style={{ minHeight: 160 }}
              />
              <div className="wfp-field-hint">розкажіть про контекст, обсяг, обмеження · можна markdown</div>
            </div>
          </div>

          <div className="wfp-no-section">
            <div className="wfp-no-section-h">
              <div className="wfp-no-section-h-t" data-n="2">Деталі</div>
              <div className="wfp-no-section-h-aux">// опційно · допомагає швидше оцінити</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="wfp-field">
                <label>Категорія</label>
                <select defaultValue="integration" style={{ height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6, color: 'var(--wf-fg)', font: 'inherit', fontSize: 13 }}>
                  <option value="">Виберіть категорію…</option>
                  <option value="web">Web-додаток</option>
                  <option value="integration">Інтеграція / автоматизація</option>
                  <option value="bot">Бот · Telegram / WhatsApp</option>
                  <option value="ai">AI-агент / ML</option>
                  <option value="data">Парсинг / data scraping</option>
                  <option value="crm">CRM / 1С налаштування</option>
                  <option value="other">Інше</option>
                </select>
              </div>
              <div className="wfp-field">
                <label>Орієнтовний бюджет</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 12px', background: 'var(--wf-bg)', border: '1px solid var(--wf-border)', borderRadius: 6 }}>
                  <span style={{ color: 'var(--wf-fg-muted)' }}>$</span>
                  <input defaultValue="4000" style={{ flex: 1, border: 0, background: 'transparent', outline: 0, font: 'inherit', color: 'var(--wf-fg)', padding: 0, fontFamily: 'JetBrains Mono, monospace' }} />
                  <span style={{ color: 'var(--wf-fg-muted)', fontSize: 11 }}>± команда уточнить</span>
                </div>
              </div>
            </div>
            <div className="wfp-field" style={{ marginTop: 12 }}>
              <label>Пріоритет</label>
              <div className="wfp-chip-group">
                <button className="wfp-chip" data-on={prio === 'low' || undefined} onClick={() => setPrio('low')}><span className="wfp-chip-dot" style={{ background: 'var(--wf-fg-subtle)' }} />Low · не горить</button>
                <button className="wfp-chip" data-on={prio === 'normal' || undefined} onClick={() => setPrio('normal')}><span className="wfp-chip-dot" style={{ background: 'var(--wf-accent)' }} />Normal</button>
                <button className="wfp-chip" data-on={prio === 'high' || undefined} onClick={() => setPrio('high')}><span className="wfp-chip-dot" style={{ background: 'var(--wf-warning)' }} />High</button>
                <button className="wfp-chip" data-on={prio === 'urgent' || undefined} onClick={() => setPrio('urgent')}><span className="wfp-chip-dot" style={{ background: 'var(--wf-destructive)' }} />Urgent · 🔥</button>
              </div>
            </div>
            <div className="wfp-field" style={{ marginTop: 12 }}>
              <label>Тип білінгу</label>
              <div className="wfp-chip-group">
                <button className="wfp-chip" data-on={billing === 'fixed' || undefined} onClick={() => setBilling('fixed')}><Icon name="receipt" size={13} />Fixed-price</button>
                <button className="wfp-chip" data-on={billing === 'hourly' || undefined} onClick={() => setBilling('hourly')}><Icon name="coins" size={13} />Hourly · t&m</button>
                <button className="wfp-chip" data-on={billing === 'discuss' || undefined} onClick={() => setBilling('discuss')}><Icon name="alert" size={13} />Обговорити</button>
              </div>
            </div>
          </div>

          <div className="wfp-no-section">
            <div className="wfp-no-section-h">
              <div className="wfp-no-section-h-t" data-n="3">Дедлайн</div>
              <div className="wfp-no-section-h-aux">// коли вам це треба</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
              <div className="wfp-field">
                <label>Бажана дата завершення</label>
                <input type="date" defaultValue="2026-06-15" />
              </div>
              <div className="wfp-field">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontFamily: 'Geist, sans-serif', fontSize: 12.5, color: 'var(--wf-fg-secondary)', height: 38 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--wf-accent-bg)' }} />
                  <span>Гнучкий дедлайн · можемо посунути</span>
                </label>
              </div>
            </div>
          </div>

          <div className="wfp-no-section">
            <div className="wfp-no-section-h">
              <div className="wfp-no-section-h-t" data-n="4">Файли</div>
              <div className="wfp-no-section-h-aux">// макети, брифи, приклади</div>
            </div>
            <UploadZone hint="examples.zip · 4.2 МБ · ✓ завантажено" />
            <div className="wfp-file-row" style={{ marginTop: 10 }}>
              <div className="wfp-file-icon" style={{ color: 'var(--wf-fg-muted)' }}>ZIP</div>
              <div className="wfp-file-meta">
                <div className="wfp-file-name">examples.zip</div>
                <div className="wfp-file-sub"><span>4.2 МБ</span><span>·</span><span>ви</span><span>·</span><span>щойно</span></div>
              </div>
              <div className="wfp-file-actions">
                <button className="wfp-btn wfp-btn--ghost wfp-btn--sm wfp-btn--danger" onClick={() => window.wfToast && window.wfToast('Файл видалено', 'warn')}>Видалити</button>
              </div>
            </div>
          </div>

          <div className="wfp-no-section">
            <div className="wfp-no-section-h">
              <div className="wfp-no-section-h-t" data-n="5">Як зв'язуватися?</div>
              <div className="wfp-no-section-h-aux">// канал по замовчуванню</div>
            </div>
            <div className="wfp-chip-group">
              <button className="wfp-chip" data-on={channel === 'system' || undefined} onClick={() => setChannel('system')}><Icon name="inbox" size={13} />У системі</button>
              <button className="wfp-chip" data-on={channel === 'telegram' || undefined} onClick={() => setChannel('telegram')}><Icon name="external" size={13} />Telegram</button>
              <button className="wfp-chip" data-on={channel === 'email' || undefined} onClick={() => setChannel('email')}><Icon name="bell" size={13} />Email</button>
              <button className="wfp-chip" data-on={channel === 'phone' || undefined} onClick={() => setChannel('phone')}><Icon name="external" size={13} />Phone</button>
            </div>
            <div className="wfp-field-hint" style={{ marginTop: 10 }}>
              «У системі» = всі чати тут, копія в email. Зміните пізніше в /settings/notifications.
            </div>
          </div>

          {/* Submit row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px dashed var(--wf-border)', marginTop: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>
              // після створення команда відповість протягом доби з оцінкою
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Чернетку збережено', 'ok')}>Зберегти чернетку</button>
              <button className="wfp-btn wfp-btn--primary" onClick={() => window.wfModal && window.wfModal({ title: 'Створити замовлення?', fields: [{ type: 'static', label: 'Замовлення', value: draft.title }, { type: 'static', label: 'Пріоритет / білінг', value: prio + ' · ' + billing }], confirmLabel: 'Створити', note: 'Ми надішлемо оцінку протягом дня. Стежте у розділі «Замовлення».', successToast: 'Замовлення створено · очікуйте оцінку', onConfirm: () => window.__portalNav && window.__portalNav('orders') })}><Icon name="send" size={13} />Створити замовлення</button>
            </div>
          </div>
        </div>

        {/* Side preview */}
        <aside>
          <div className="wfp-no-side">
            <div className="wfp-no-side-h">
              <Icon name="check" size={14} color="var(--wf-success)" />
              Чернетка
              <span className="wfp-no-side-h-aux">auto-save 14:36</span>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">назва</div>
              <div className="wfp-no-side-v" style={{ fontWeight: 500 }}>{draft.title}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">категорія</div>
              <div className="wfp-no-side-v">Інтеграція / автоматизація</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">пріоритет</div>
              <div className="wfp-no-side-v"><span className="wfp-mono" style={{ color: 'var(--wf-accent)' }}>normal</span></div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">бюджет ~</div>
              <div className="wfp-no-side-v wfp-mono">${draft.budget.toLocaleString('uk-UA')}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">дедлайн</div>
              <div className="wfp-no-side-v wfp-mono">{draft.deadline}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">файли</div>
              <div className="wfp-no-side-v">{draft.files} файл (examples.zip)</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">канал</div>
              <div className="wfp-no-side-v">у системі + email копія</div>
            </div>

            <div className="wfp-no-side-flow">
              <div style={{ color: 'var(--wf-fg)', fontWeight: 600, marginBottom: 6 }}>// що далі?</div>
              <div>1. ви натиснете «створити»</div>
              <div>2. команда отримає сповіщення</div>
              <div>3. протягом доби — оцінка від нас</div>
              <div>4. ви підтверджуєте — старт</div>
            </div>
          </div>
        </aside>
      </div>
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Alternative: conversational chat-style intake
// ──────────────────────────────────────────────────────────────────────
function PortalOrderNewChat() {
  const messages = window.WFP_DATA.order_new_chat;
  const draft = {
    title: 'Інтеграція 1С ↔ Telegram-бот для водіїв',
    deadline: '15.06.2026',
    priority: 'normal',
    drivers: '54 водія',
    erp: '1С 8.3 БП',
    volume: '~180 накладних/день',
    files: 1,
  };

  return (
    <React.Fragment>
      <PageHeader
        title="Нове замовлення"
        subtitle="// розкажіть як з другом · 5 хвилин"
      >
        <button className="wfp-btn" onClick={() => window.wfToast && window.wfToast('Перемкнено на форму · демо', 'info')}>→ форма натомість</button>
      </PageHeader>

      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        <div className="wfp-no-chat">
          <div className="wfp-no-chat-h">
            <div className="wfp-no-chat-h-t">workflo bot · order intake</div>
            <span>session: 5m 12s · ESC щоб зберегти і вийти</span>
          </div>

          <div className="wfp-chat" style={{ padding: '16px 18px', maxHeight: 'none', flex: 1 }}>
            {messages.map((m, i) => (
              <div key={i} className={`wfp-chat-row${m.who === 'system' ? ' wfp-chat-row--system' : ''}`}>
                <span className="wfp-chat-ts">{m.ts}</span>
                <ChatWho who={m.who} label={m.who === 'system' ? 'system' : m.who === 'client' ? 'client' : 'workflo'} />
                <div className="wfp-chat-text">
                  {m.text}
                  {m.attach && (
                    <div className="wfp-chat-attach">
                      <Icon name="paperclip" size={12} />
                      <span>{m.attach.name}</span>
                      <span className="wfp-chat-attach-size">· {m.attach.size}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick-pick chips for last bot question */}
          <div className="wfp-no-chat-quick">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--wf-fg-muted)', marginRight: 6 }}>quick:</span>
            <button className="wfp-no-chat-quick-chip" onClick={() => window.wfToast && window.wfToast('UAH-оплата через 1С Звітність · демо', 'ok')}>UAH-оплата через 1С Звітність</button>
            <button className="wfp-no-chat-quick-chip">water-tight безпека</button>
            <button className="wfp-no-chat-quick-chip">мобільна версія потрібна</button>
            <button className="wfp-no-chat-quick-chip">потрібен 24/7 support</button>
          </div>

          <div className="wfp-chat-input">
            <span className="wfp-chat-input-ts">14:36</span>
            <span className="wfp-chat-input-who">client</span>
            <input className="wfp-chat-input-field" placeholder="Введіть або виберіть варіант вище..." />
            <div className="wfp-chat-input-actions">
              <button className="wfp-iconbtn" title="Файл" onClick={() => window.wfToast && window.wfToast('Вибір файлу · демо', 'info')}><Icon name="paperclip" size={14} /></button>
              <button className="wfp-btn wfp-btn--sm" onClick={() => window.wfModal && window.wfModal({ title: 'Завершити заявку?', fields: [{ type: 'static', value: 'Ми зберемо відповіді й повернемося з оцінкою.' }], confirmLabel: 'Завершити', successToast: 'Заявку створено · очікуйте оцінку' })}>Завершити</button>
              <button className="wfp-btn wfp-btn--primary wfp-btn--sm" onClick={() => window.wfToast && window.wfToast('Відповідь надіслано', 'ok')}><Icon name="send" size={12} />Відповісти</button>
            </div>
          </div>
        </div>

        {/* Live draft preview */}
        <aside>
          <div className="wfp-no-side">
            <div className="wfp-no-side-h">
              <Icon name="check" size={14} color="var(--wf-accent)" />
              Збираємо контекст
              <span className="wfp-no-side-h-aux">5/6 полів</span>
            </div>
            <div className="wfp-wizard-bar" style={{ marginBottom: 4 }}>
              <div className="wfp-wizard-bar-fill" style={{ width: '83%' }} />
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">що</div>
              <div className="wfp-no-side-v" style={{ fontWeight: 500 }}>{draft.title}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">водіїв</div>
              <div className="wfp-no-side-v wfp-mono">{draft.drivers}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">ERP</div>
              <div className="wfp-no-side-v wfp-mono">{draft.erp}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">обсяг</div>
              <div className="wfp-no-side-v">{draft.volume}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">дедлайн</div>
              <div className="wfp-no-side-v wfp-mono">{draft.deadline}</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">пріоритет</div>
              <div className="wfp-no-side-v"><span className="wfp-mono" style={{ color: 'var(--wf-accent)' }}>normal</span></div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">файли</div>
              <div className="wfp-no-side-v">1 · examples.zip</div>
            </div>
            <div className="wfp-no-side-row">
              <div className="wfp-no-side-k">особливості</div>
              <div className="wfp-no-side-v wfp-no-side-v--empty">очікую вашу відповідь…</div>
            </div>

            <div className="wfp-no-side-flow">
              <div style={{ color: 'var(--wf-fg)', fontWeight: 600, marginBottom: 6 }}>// чому чат?</div>
              <div>не треба думати які поля заповнити — бот сам спитає що потрібно</div>
            </div>
          </div>
        </aside>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, {
  PortalOrderNew,
  PortalOrderNewChat,
});
