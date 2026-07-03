// workspace-p2c.jsx — Email template admin (/admin/templates) ·
// Wallet top-up (25-А) · Referral funnel (09-Б).

const _pc = React.useState;

// ════════════════ Email-шаблони · керування (розділ 6) ════════════════
const MAIL_TEMPLATES = [
  { id: 'invite', name: 'Запрошення в портал', event: 'team.invite', locale: 'ua', channel: 'email', updated: '12.06', subject: 'Вас запрошено до {{company}} на workflo.space' },
  { id: 'order_received', name: 'Замовлення прийнято', event: 'order.created', locale: 'ua', channel: 'email', updated: '10.06', subject: '{{order}} прийнято в роботу' },
  { id: 'invoice', name: 'Новий рахунок', event: 'invoice.issued', locale: 'ua', channel: 'email', updated: '08.06', subject: 'Рахунок {{invoice}} на {{amount}}' },
  { id: 'payment_ok', name: 'Оплату отримано', event: 'payment.succeeded', locale: 'ua', channel: 'email', updated: '08.06', subject: 'Дякуємо! Оплату {{amount}} отримано' },
  { id: 'overdue', name: 'Нагадування про борг', event: 'invoice.overdue', locale: 'ua', channel: 'email', updated: '14.06', subject: 'Рахунок {{invoice}} прострочено' },
  { id: 'digest', name: 'Ранковий дайджест', event: 'digest.daily', locale: 'ua', channel: 'email', updated: '11.06', subject: 'Ваш ранковий зведений звіт' },
  { id: 'magic', name: 'Вхід за посиланням', event: 'auth.magic_link', locale: 'ua', channel: 'email', updated: '09.06', subject: 'Ваше посилання для входу' },
];
const MAIL_VARS = ['{{company}}', '{{client.name}}', '{{order}}', '{{invoice}}', '{{amount}}', '{{due_date}}', '{{link}}'];

// UA/EN subject + body pairs (06-Г двомовність)
const MAIL_I18N = {
  invite:         { ua: { s: 'Вас запрошено до {{company}} на workflo.space', b: 'Вітаємо, {{client.name}}!\n\nВас запрошено до {{company}}. Натисніть, щоб прийняти: {{link}}\n\n— Команда workflo.space' }, en: { s: 'You’re invited to {{company}} on workflo.space', b: 'Hi {{client.name}},\n\nYou’ve been invited to {{company}}. Click to accept: {{link}}\n\n— The workflo.space team' } },
  order_received: { ua: { s: '{{order}} прийнято в роботу', b: 'Вітаємо, {{client.name}}!\n\nЗамовлення {{order}} прийнято в роботу. Стежте за прогресом у порталі.\n\n— Команда workflo.space' }, en: { s: '{{order}} accepted', b: 'Hi {{client.name}},\n\nOrder {{order}} is now in progress. Track it in your portal.\n\n— The workflo.space team' } },
  invoice:        { ua: { s: 'Рахунок {{invoice}} на {{amount}}', b: 'Вітаємо, {{client.name}}!\n\nВиставили рахунок {{invoice}} на суму {{amount}}. Термін оплати — {{due_date}}.\n\n— Команда workflo.space' }, en: { s: 'Invoice {{invoice}} for {{amount}}', b: 'Hi {{client.name}},\n\nWe’ve issued invoice {{invoice}} for {{amount}}. Due by {{due_date}}.\n\n— The workflo.space team' } },
  payment_ok:     { ua: { s: 'Дякуємо! Оплату {{amount}} отримано', b: 'Вітаємо, {{client.name}}!\n\nОплату {{amount}} отримано. Дякуємо!\n\n— Команда workflo.space' }, en: { s: 'Thank you! Payment {{amount}} received', b: 'Hi {{client.name}},\n\nWe’ve received your payment of {{amount}}. Thank you!\n\n— The workflo.space team' } },
  overdue:        { ua: { s: 'Рахунок {{invoice}} прострочено', b: 'Вітаємо, {{client.name}}!\n\nЗвертаємо увагу: рахунок {{invoice}} на {{amount}} прострочено. Будь ласка, оплатіть.\n\n— Команда workflo.space' }, en: { s: 'Invoice {{invoice}} is overdue', b: 'Hi {{client.name}},\n\nA reminder: invoice {{invoice}} for {{amount}} is overdue. Please settle it or reach out.\n\n— The workflo.space team' } },
  digest:         { ua: { s: 'Ваш ранковий зведений звіт', b: 'Доброго ранку, {{client.name}}!\n\nОсь що на сьогодні: активні задачі, дедлайни та нові повідомлення.\n\n— Команда workflo.space' }, en: { s: 'Your morning digest', b: 'Good morning {{client.name}},\n\nHere’s today: active tasks, deadlines and new messages.\n\n— The workflo.space team' } },
  magic:          { ua: { s: 'Ваше посилання для входу', b: 'Вітаємо, {{client.name}}!\n\nНатисніть посилання, щоб увійти: {{link}}\nДіє 15 хвилин.\n\n— Команда workflo.space' }, en: { s: 'Your sign-in link', b: 'Hi {{client.name}},\n\nClick to sign in: {{link}}\nValid for 15 minutes.\n\n— The workflo.space team' } },
};
const MAIL_DELIVERY = { invite: { sent: 24, delivered: 24, opened: 19 }, order_received: { sent: 58, delivered: 57, opened: 50 }, invoice: { sent: 42, delivered: 42, opened: 38 }, payment_ok: { sent: 40, delivered: 40, opened: 31 }, overdue: { sent: 12, delivered: 12, opened: 7 }, digest: { sent: 180, delivered: 176, opened: 92 }, magic: { sent: 66, delivered: 66, opened: 61 } };

function WsEmailTemplates() {
  const [sel, setSel] = _pc(MAIL_TEMPLATES[0]);
  const [loc, setLoc] = _pc('ua');
  const [body, setBody] = _pc('');
  const [subject, setSubject] = _pc('');
  const [saved, setSaved] = _pc(false);
  const [tested, setTested] = _pc(false);
  React.useEffect(() => {
    const pair = (MAIL_I18N[sel.id] || {})[loc] || (MAIL_I18N[sel.id] || {}).ua || { s: sel.subject, b: '' };
    setBody(pair.b.replace(/\\n/g, '\n')); setSubject(pair.s);
    setSaved(false); setTested(false);
  }, [sel, loc]);
  const dl = MAIL_DELIVERY[sel.id] || { sent: 0, delivered: 0, opened: 0 };
  const openRate = dl.sent ? Math.round((dl.opened / dl.sent) * 100) : 0;
  return (
    <React.Fragment>
      <div className="wfp-ph">
        <div className="wfp-ph-l"><h1 className="wfp-ph-h1">Email-шаблони</h1><div className="wfp-ph-sub">// подія × локаль × канал · редактор зі змінними + тест-відправка</div></div>
      </div>
      <div className="wfp-cols2" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MAIL_TEMPLATES.map((t) => (
            <div key={t.id} className="wfl-pipe-item" data-on={sel.id === t.id || undefined} onClick={() => setSel(t)}>
              <span className="wfc-proj-ico" style={{ width: 30, height: 30 }}><Icon name="mail" size={14} /></span>
              <div className="wfl-pipe-item-n">{t.name}<div className="wf-mono" style={{ fontSize: 9.5, color: 'var(--wf-fg-subtle)', fontWeight: 400 }}>{t.event} · {t.locale}</div></div>
            </div>
          ))}
        </div>
        <div>
          <div className="wfc-grid2" style={{ marginBottom: 14 }}>
            <div className="wfp-field"><label>Тема листа</label><input value={subject} onChange={(e) => { setSubject(e.target.value); setSaved(false); }} /></div>
            <div className="wfp-field"><label>Локаль</label>
              <div className="wff-seg">
                <button className="wff-seg-opt" data-on={loc === 'ua' || undefined} onClick={() => setLoc('ua')}>🇺🇦 ua</button>
                <button className="wff-seg-opt" data-on={loc === 'en' || undefined} onClick={() => setLoc('en')}>🇬🇧 en</button>
              </div>
            </div>
          </div>

          <div className="wfem-delivery">
            <span className="wfem-delivery-l">// доставка (06-Г):</span>
            <span className="wfem-dl"><Icon name="send" size={11} />надіслано {dl.sent}</span>
            <span className="wfem-dl" data-tone="ok"><span className="wfem-dl-dot" />доставлено {dl.delivered}</span>
            <span className="wfem-dl" data-tone="accent"><span className="wfem-dl-dot" />відкрито {dl.opened} · {openRate}%</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <div className="wfp-field"><label>Тіло (HTML / {'{{змінні}}'})</label>
              <textarea value={body} onChange={(e) => { setBody(e.target.value); setSaved(false); }} style={{ width: '100%', minHeight: 240, border: '1px solid var(--wf-border)', borderRadius: 9, padding: 12, background: 'var(--wf-bg)', color: 'var(--wf-fg)', font: 'inherit', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {MAIL_VARS.map((v) => <button key={v} className="wfl-card-chip" style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', color: 'var(--wf-accent)' }} onClick={() => setBody(body + ' ' + v)}>{v}</button>)}
              </div>
            </div>
            <div className="wfp-field"><label>Прев'ю</label>
              <div style={{ border: '1px solid var(--wf-border)', borderRadius: 9, padding: 18, background: 'var(--wf-surface)', minHeight: 240 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>workflo<span style={{ color: 'var(--wf-accent)' }}>.</span>space</div>
                <div style={{ fontSize: 14, fontWeight: 600, padding: '10px 0', borderBottom: '1px solid var(--wf-border)' }}>{subject.replace('{{company}}', 'Brunky').replace('{{order}}', 'ORD-2412').replace('{{invoice}}', 'INV-0418').replace('{{amount}}', '$3 200')}</div>
                <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 12 }}>{body.replace('{{client.name}}', loc === 'en' ? 'Olena' : 'Олена').replace('{{company}}', 'Brunky').replace('{{order}}', 'ORD-2412').replace('{{invoice}}', 'INV-0418').replace('{{amount}}', '$3 200').replace('{{due_date}}', '05.07.2026').replace('{{link}}', 'portal.workflo.space/login?t=…')}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            <button className="wfp-btn wfp-btn--primary" onClick={() => setSaved(true)}><Icon name="check" size={14} />Зберегти</button>
            <button className="wfp-btn" onClick={() => setTested(true)}><Icon name="send" size={13} />Надіслати тест</button>
            <button className="wfp-btn wfp-btn--ghost" onClick={() => window.wfToast && window.wfToast('Відновити дефолт · демо', 'ok')}><Icon name="alert" size={13} />Відновити дефолт</button>
            {saved && <span className="wf-mono" style={{ fontSize: 12, color: 'var(--wf-success)' }}>✓ збережено</span>}
            {tested && <span className="wf-mono" style={{ fontSize: 12, color: 'var(--wf-success)' }}>✓ тест надіслано на illia@workflo.space</span>}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { WsEmailTemplates });
