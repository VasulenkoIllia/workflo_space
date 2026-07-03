// workspace-monitoring-data.js — G6 · System Monitoring dashboard (module 21).
// owner-only /admin/system. One screen, 5 sections.

window.WFP_MONITORING = {
  health: [
    { id: 'uptime',  label: 'Uptime · 30 дн', value: '99.97%', state: 'ok',   sub: '2 інциденти' },
    { id: 'users',   label: 'Активні · 5 хв', value: '14',     state: 'ok',   sub: 'портал + workspace' },
    { id: 'dbpool',  label: 'DB pool',        value: '12/20',  state: 'warn', sub: '60% використано' },
    { id: 'crons',   label: 'Крони в черзі',  value: '1',      state: 'ok',   sub: 'running' },
    { id: 'deploy',  label: 'Deploy',         value: 'a3f9c2e', state: 'ok',  sub: 'main · 2 год тому', link: true },
    { id: 'sentry',  label: 'Sentry · 1 год', value: '3',      state: 'warn', sub: 'нові events' },
  ],
  // cron heatmap: 7 days × crons (statuses)
  heatmapDays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  heatmap: [
    { name: 'nbu-rate-sync',       cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'] },
    { name: 'invoice-overdue',     cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'] },
    { name: 'weekly-digest',       cells: ['ok', 'skip', 'skip', 'skip', 'skip', 'skip', 'skip'] },
    { name: 'telegram-retry',      cells: ['ok', 'ok', 'fail', 'ok', 'ok', 'ok', 'run'] },
    { name: 'backup-snapshot',     cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'] },
    { name: 'mailgun-bounce',      cells: ['ok', 'ok', 'ok', 'ok', 'fail', 'fail', 'fail'] },
    { name: 'session-cleanup',     cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'] },
  ],
  notifChannels: [
    { id: 'email',    label: 'Email',    sent: 1248, rate: 99.2, state: 'ok' },
    { id: 'telegram', label: 'Telegram', sent: 642,  rate: 97.8, state: 'ok' },
    { id: 'push',     label: 'Push',     sent: 310,  rate: 91.3, state: 'warn' },
    { id: 'sms',      label: 'SMS',      sent: 24,   rate: 100,  state: 'ok' },
  ],
  blocked: [
    { who: 'olena@brunky.ua', channel: 'telegram', reason: 'bot заблоковано' },
    { who: '+380•••4521',     channel: 'sms',      reason: 'недоставлено ×3' },
  ],
  audit: [
    { ts: '14:22:08', actor: 'illia', action: 'credentials.reveal', what: 'Brunky · Telegram Bot Token', level: 'sensitive' },
    { ts: '14:05:41', actor: 'oleh',  action: 'invoice.send',       what: 'INV-2025-0419 → Brunky', level: 'info' },
    { ts: '13:48:12', actor: 'illia', action: 'company.transfer',   what: 'ownership · Tably → Олег', level: 'sensitive' },
    { ts: '13:30:55', actor: 'maria', action: 'order.status',       what: 'ORD-2410 → review', level: 'info' },
    { ts: '12:58:03', actor: 'system', action: 'cron.failed',       what: 'mailgun-bounce-sync', level: 'error' },
    { ts: '12:14:39', actor: 'illia', action: 'admin.smtp.test',    what: 'Розсилки → FAIL', level: 'warn' },
    { ts: '11:40:21', actor: 'oleh',  action: 'payout.confirm',     what: 'Павло · $1 820', level: 'info' },
  ],
  errors: [
    { id: 'WF-481', title: 'TypeError: cannot read properties of undefined (reading "rate")', count: 42, lastSeen: '8 хв', state: 'unresolved' },
    { id: 'WF-479', title: '1C connector timeout after 30s', count: 11, lastSeen: '2 год', state: 'unresolved' },
    { id: 'WF-475', title: 'Telegram sendMessage 403: bot blocked by user', count: 7, lastSeen: '5 год', state: 'ignored' },
    { id: 'WF-470', title: 'Postmark 422: inactive recipient', count: 3, lastSeen: '1 дн', state: 'resolved' },
  ],
};
