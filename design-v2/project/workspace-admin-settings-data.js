// workspace-admin-settings-data.js — data for G5 · Admin Settings (module 20):
// /admin/templates · /admin/smtp · /admin/branding · /admin/nomenclature · /admin/crons
// Per-agency (ADR-004). All owner-only.

window.WFP_ADMIN_TEMPLATES = {
  stats: { total: 15, customised: 4, locales: 2 },
  rows: [
    { id: 'invite',        event: 'company.invite',     channel: 'email',    locale: 'ua', subject: 'Вас запросили в портал {{company}}', status: 'custom',  updated: '18.05' },
    { id: 'order-received', event: 'order.received',     channel: 'email',    locale: 'ua', subject: '{{orderId}} прийнято в роботу',        status: 'custom',  updated: '12.05' },
    { id: 'invoice',       event: 'invoice.issued',      channel: 'email',    locale: 'ua', subject: 'Рахунок {{invoiceNo}} · {{amount}}',   status: 'custom',  updated: '21.05' },
    { id: 'payment-ok',    event: 'payment.confirmed',   channel: 'email',    locale: 'ua', subject: 'Оплату отримано · дякуємо',           status: 'default', updated: '—' },
    { id: 'deadline',      event: 'invoice.overdue',     channel: 'email',    locale: 'ua', subject: 'Нагадування: {{invoiceNo}} прострочено', status: 'custom',  updated: '09.05' },
    { id: 'tg-order',      event: 'order.received',      channel: 'telegram', locale: 'ua', subject: '🛠 {{orderId}} у роботі',             status: 'default', updated: '—' },
    { id: 'otp',           event: 'auth.otp',            channel: 'email',    locale: 'ua', subject: 'Код для входу: {{code}}',             status: 'default', updated: '—' },
    { id: 'digest',        event: 'weekly.digest',       channel: 'email',    locale: 'ua', subject: 'Ваш тиждень у workflo',              status: 'default', updated: '—' },
  ],
  // editor sample (invoice template)
  editor: {
    name: 'invoice.issued · email · ua',
    variables: ['company', 'invoiceNo', 'amount', 'amountUah', 'dueDate', 'orderId', 'payUrl'],
    subject: 'Рахунок {{invoiceNo}} · {{amount}} · до {{dueDate}}',
    body: `Вітаємо, {{company}}!

Виставили рахунок за замовленням {{orderId}}.

  Рахунок:  {{invoiceNo}}
  Сума:     {{amount}}  (≈ {{amountUah}})
  Оплатити: до {{dueDate}}

[ Оплатити рахунок → ]  {{payUrl}}

PDF з актом — у вкладенні й у кабінеті.
— workflo.space`,
  },
};

window.WFP_ADMIN_SMTP = {
  senders: [
    { id: 's1', name: 'Транзакційні',  from: 'no-reply@workflo.space',  host: 'smtp.postmark.com', port: 587, enc: 'STARTTLS', status: 'ok',       lastTest: '29.05 14:02', events: 8 },
    { id: 's2', name: 'Білінг',        from: 'billing@workflo.space',   host: 'smtp.postmark.com', port: 587, enc: 'STARTTLS', status: 'ok',       lastTest: '29.05 14:02', events: 4 },
    { id: 's3', name: 'Розсилки',      from: 'news@workflo.space',      host: 'smtp.mailgun.org',  port: 465, enc: 'SSL/TLS',  status: 'fail',     lastTest: '28.05 09:11', events: 1, error: 'auth failed (535)' },
    { id: 's4', name: 'Підтримка',     from: 'support@workflo.space',   host: 'smtp.gmail.com',    port: 587, enc: 'STARTTLS', status: 'untested', lastTest: '—',          events: 2 },
  ],
  mapping: [
    { event: 'auth.*',     sender: 'Транзакційні' },
    { event: 'order.*',    sender: 'Транзакційні' },
    { event: 'invoice.*',  sender: 'Білінг' },
    { event: 'payment.*',  sender: 'Білінг' },
    { event: 'weekly.*',   sender: 'Розсилки' },
    { event: 'support.*',  sender: 'Підтримка' },
  ],
};

window.WFP_ADMIN_BRANDING = {
  logo: 'workflo.space',
  accent: '#A3D90D',
  accentOptions: ['#A3D90D', '#2A6FDB', '#1F8A5B', '#D97757'],
  font: 'Geist',
  fontOptions: ['Geist', 'Inter', 'Roboto'],
  wordmark: 'mono',
  wordmarkOptions: ['mono', 'plain'],
  footer: 'ФОП Когут І. · Україна · workflo.space · hello@workflo.space',
  showQr: true,
};

window.WFP_ADMIN_NOMENCLATURE = {
  stats: { total: 24, active: 21, categories: 5 },
  rows: [
    { code: 'NOM-001', name: 'Інтеграція API (година)',        category: 'dev',     unit: 'год',     price: 45,  active: true },
    { code: 'NOM-002', name: 'Розробка порталу (етап)',         category: 'dev',     unit: 'етап',    price: 1500, active: true },
    { code: 'NOM-003', name: 'AI-агент · впровадження',         category: 'ai',      unit: 'проєкт',  price: 2200, active: true },
    { code: 'NOM-010', name: 'Підтримка · base',                category: 'support', unit: 'місяць',  price: 200,  active: true },
    { code: 'NOM-011', name: 'Backup-моніторинг',               category: 'support', unit: 'місяць',  price: 80,   active: true },
    { code: 'NOM-020', name: 'Парсинг даних (скрипт)',          category: 'auto',    unit: 'скрипт',  price: 350,  active: true },
    { code: 'NOM-021', name: 'Генерація документів',            category: 'auto',    unit: 'проєкт',  price: 600,  active: true },
    { code: 'NOM-030', name: 'Хостинг + домен',                 category: 'infra',   unit: 'місяць',  price: 40,   active: false },
  ],
};

window.WFP_ADMIN_CRONS = {
  stats: { total: 9, ok: 7, failed: 1, running: 1 },
  rows: [
    { id: 'c1', name: 'nbu-rate-sync',        schedule: '0 9 * * *',    last: '29.05 09:00', status: 'success', duration: '1.2s',  next: '30.05 09:00' },
    { id: 'c2', name: 'invoice-overdue-scan',  schedule: '0 8 * * *',    last: '29.05 08:00', status: 'success', duration: '3.4s',  next: '30.05 08:00' },
    { id: 'c3', name: 'weekly-digest',         schedule: '0 10 * * 1',   last: '27.05 10:00', status: 'success', duration: '12.8s', next: '03.06 10:00' },
    { id: 'c4', name: 'telegram-retry-queue',  schedule: '*/5 * * * *',  last: '29.05 14:05', status: 'running', duration: '…',     next: '29.05 14:10' },
    { id: 'c5', name: 'backup-snapshot',       schedule: '0 3 * * *',    last: '29.05 03:00', status: 'success', duration: '44.1s', next: '30.05 03:00' },
    { id: 'c6', name: 'mailgun-bounce-sync',   schedule: '0 */6 * * *',  last: '29.05 12:00', status: 'failed',  duration: '0.4s',  next: '29.05 18:00', error: 'API 401 — перевірте ключ' },
    { id: 'c7', name: 'session-cleanup',       schedule: '0 4 * * *',    last: '29.05 04:00', status: 'success', duration: '0.8s',  next: '30.05 04:00' },
    { id: 'c8', name: 'payout-period-close',   schedule: '0 0 1 * *',    last: '01.05 00:00', status: 'skipped', duration: '—',     next: '01.06 00:00' },
  ],
};
