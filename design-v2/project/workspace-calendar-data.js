// workspace-calendar-data.js — G7 · Calendar / Meetings (module 24).
// Internal + client meetings, RSVP, read-only projections of deadlines + leaves.

window.WFP_CALENDAR = {
  monthLabel: 'Травень 2026',
  weekStart: 'Пн',
  // month grid: 5 weeks × 7, day number + events. (Травень 2026 starts Fri)
  // we lay out a representative grid; "today" = 29
  today: 29,
  // events keyed by day-of-month
  events: {
    5:  [{ t: 'Демо · Brunky', type: 'client', time: '11:00' }],
    6:  [{ t: 'Планерка', type: 'internal', time: '10:00' }],
    8:  [{ t: 'Дедлайн ORD-2411', type: 'deadline', time: '' }],
    12: [{ t: 'Дзвінок NordStream', type: 'client', time: '15:00' }, { t: 'Код-рев’ю', type: 'internal', time: '17:00' }],
    13: [{ t: 'Планерка', type: 'internal', time: '10:00' }],
    15: [{ t: 'Відпустка · Олег', type: 'leave', time: '' }],
    18: [{ t: 'Demo day', type: 'client', time: '14:00' }],
    20: [{ t: 'Планерка', type: 'internal', time: '10:00' }],
    22: [{ t: 'Discovery · Tably', type: 'client', time: '12:00' }],
    26: [{ t: 'Дедлайн ORD-2412', type: 'deadline', time: '' }, { t: 'Ретро', type: 'internal', time: '18:00' }],
    27: [{ t: 'Планерка', type: 'internal', time: '10:00' }],
    29: [{ t: 'Демо · Brunky', type: 'client', time: '11:00' }, { t: 'Дзвінок · EduForge', type: 'client', time: '16:00' }, { t: '1:1 Павло', type: 'internal', time: '17:30' }],
  },
  // week view (Пн–Нд of the current week), events with start/end hour
  week: {
    days: [
      { label: 'Пн 25', today: false },
      { label: 'Вт 26', today: false },
      { label: 'Ср 27', today: false },
      { label: 'Чт 28', today: false },
      { label: 'Пт 29', today: true },
      { label: 'Сб 30', today: false },
      { label: 'Нд 31', today: false },
    ],
    // events: {dayIdx, start, end, title, type}
    blocks: [
      { day: 0, start: 14, end: 15, title: 'Demo day', type: 'client' },
      { day: 1, start: 18, end: 19, title: 'Ретро', type: 'internal' },
      { day: 2, start: 10, end: 11, title: 'Планерка', type: 'internal' },
      { day: 4, start: 11, end: 12, title: 'Демо · Brunky', type: 'client' },
      { day: 4, start: 16, end: 17, title: 'EduForge', type: 'client' },
      { day: 4, start: 17.5, end: 18, title: '1:1 Павло', type: 'internal' },
      { day: 3, start: 12, end: 13.5, title: 'Discovery · Tably', type: 'client' },
    ],
  },
  // day view (Fri 29)
  day: {
    label: 'Пʼятниця, 29 травня',
    items: [
      { start: 11, end: 12, title: 'Демо · Brunky', type: 'client', loc: 'Google Meet', who: ['illia', 'oleh'] },
      { start: 13, end: 13.5, title: 'Обід', type: 'internal', loc: '', who: [] },
      { start: 16, end: 17, title: 'Дзвінок · EduForge', type: 'client', loc: 'Zoom', who: ['illia'] },
      { start: 17.5, end: 18, title: '1:1 Павло', type: 'internal', loc: 'офіс', who: ['illia', 'pavlo'] },
    ],
    selected: 0,
  },
  // aggregated read-only legend
  legend: [
    { type: 'internal', label: 'Внутрішні' },
    { type: 'client', label: 'Клієнтські' },
    { type: 'deadline', label: 'Дедлайни (з kanban)' },
    { type: 'leave', label: 'Відпустки' },
  ],
  // create-event form defaults
  eventForm: {
    title: 'Демо результатів · Brunky',
    type: 'client',
    date: '29.05.2026',
    start: '11:00',
    end: '12:00',
    tz: 'Europe/Kyiv',
    location: 'Google Meet',
    url: 'meet.google.com/abc-defg-hij',
    attendees: ['illia', 'oleh'],
    extEmail: 'olena@brunky.ua',
    reminders: ['1 год', '1 день'],
  },
  rsvp: {
    title: 'Демо результатів · Brunky',
    when: '29 травня · 11:00–12:00 (EET)',
    where: 'Google Meet',
    organizer: 'Ілля',
    attendees: [
      { id: 'illia', status: 'yes' },
      { id: 'oleh', status: 'yes' },
      { id: 'client', name: 'Олена · Brunky', status: 'pending' },
    ],
  },
};
