// workspace-notify-data.js — loyalty settings (10) + notifications hub (07/13).

(function () {
  // Loyalty tiers — editable (10-А/В/Г)
  const LOYALTY_TIERS = [
    { id: 'base',    name: 'base',    threshold: 0,     discount: 0,  color: '#A8A29E', perks: ['Стандартна підтримка'] },
    { id: 'regular', name: 'regular', threshold: 5000,  discount: 3,  color: '#78716C', perks: ['−3% на разові', 'Пріоритет у черзі'] },
    { id: 'pro',     name: 'pro',     threshold: 15000, discount: 7,  color: '#0EA5E9', perks: ['−7% на разові', 'Виділений менеджер', 'SLA 4 год'] },
    { id: 'partner', name: 'partner', threshold: 30000, discount: 12, color: '#A3D90D', perks: ['−12% на все', 'Виділений менеджер', 'SLA 2 год', 'Квартальний review'] },
  ];
  const LOYALTY_CONFIG = { applyOneTime: true, applyHourly: false, autoUpgrade: true, notifyAt: 90 };

  // In-app announcements (07-В)
  const ANNOUNCEMENTS = [
    { id: 'a1', title: 'Планове оновлення 20 червня', body: 'З 02:00 до 04:00 можливі короткі перебої. Дані не постраждають.', audience: 'Усі клієнти', status: 'active', reads: 38, total: 52, from: '14.06.2026' },
    { id: 'a2', title: 'Новий розділ «Документи»', body: 'Тепер ви можете самі формувати акти звірки у себе в порталі.', audience: 'Сегмент: partner', status: 'scheduled', reads: 0, total: 8, from: '18.06.2026' },
    { id: 'a3', title: 'Святкові вихідні', body: 'Команда не працює 28 червня. Тікети обробимо 29-го.', audience: 'Усі клієнти', status: 'draft', reads: 0, total: 52, from: '—' },
  ];

  // Digest config (07-А)
  const DIGEST = {
    enabled: true, time: '08:30', tz: 'Europe/Kyiv', to: 'owner',
    sections: [
      { id: 'overdue', label: 'Прострочені рахунки', on: true },
      { id: 'waiting', label: 'Клієнти чекають відповіді', on: true },
      { id: 'deadlines', label: 'Дедлайни сьогодні/завтра', on: true },
      { id: 'newleads', label: 'Нові ліди', on: true },
      { id: 'capacity', label: 'Перевантажені виконавці', on: false },
      { id: 'payments', label: 'Отримані оплати', on: true },
    ],
  };

  // Reply-wait thresholds (07-Б)
  const WAIT_THRESHOLDS = {
    remindAfter: 4, escalateAfter: 12, escalateTo: 'owner',
    workHoursOnly: true,
  };

  // Notification matrix (13-Б) — event × channel
  const NOTIFY_MATRIX = [
    { id: 'new_order',   label: 'Нове замовлення',              area: 'Замовлення', email: true,  telegram: true,  inapp: true },
    { id: 'new_comment', label: 'Новий коментар у чаті',         area: 'Замовлення', email: false, telegram: true,  inapp: true },
    { id: 'mention',     label: '@згадка',                       area: 'Замовлення', email: true,  telegram: true,  inapp: true },
    { id: 'invoice_due', label: 'Рахунок наближається/прострочено', area: 'Білінг',  email: true,  telegram: true,  inapp: true },
    { id: 'payment',     label: 'Отримано оплату',               area: 'Білінг',     email: true,  telegram: false, inapp: true },
    { id: 'new_lead',    label: 'Новий лід',                     area: 'CRM',        email: false, telegram: true,  inapp: true },
    { id: 'leave_req',   label: 'Запит на відсутність',          area: 'Команда',    email: true,  telegram: false, inapp: true },
    { id: 'cron_fail',   label: 'Збій фонової задачі',           area: 'Система',    email: true,  telegram: true,  inapp: true },
  ];

  window.WF_NOTIFY = { LOYALTY_TIERS, LOYALTY_CONFIG, ANNOUNCEMENTS, DIGEST, WAIT_THRESHOLDS, NOTIFY_MATRIX };
})();
