// workspace-leave-data.js — G10 · Leave Tracking (module 23).
// executor requests → owner approve/reject → shown in calendar (G7).

window.WFP_LEAVE = {
  // executor's own requests
  my: [
    { id: 'l1', type: 'vacation', from: '10.06', to: '14.06', days: 5, reason: 'Сімейна поїздка', status: 'pending',  submitted: '28.05' },
    { id: 'l2', type: 'sick',     from: '06.05', to: '07.05', days: 2, reason: 'ГРВІ',            status: 'approved', submitted: '06.05' },
    { id: 'l3', type: 'personal', from: '22.04', to: '22.04', days: 1, reason: 'Особисті справи',  status: 'approved', submitted: '20.04' },
    { id: 'l4', type: 'unpaid',   from: '15.03', to: '18.03', days: 4, reason: 'Без причини',      status: 'rejected', submitted: '10.03', rejectReason: 'Дедлайн ORD-2399 того тижня' },
  ],
  myBalance: [
    { type: 'vacation', label: 'Відпустка', accrued: 24, used: 6,  color: 'var(--wf-success, #1F8A5B)' },
    { type: 'sick',     label: 'Лікарняні', accrued: 10, used: 2,  color: 'var(--wf-warning, #D97706)' },
    { type: 'personal', label: 'Особисті',  accrued: 5,  used: 1,  color: 'oklch(0.58 0.11 235)' },
  ],
  // owner — all requests
  all: {
    stats: { pending: 3, approvedMonth: 8, onLeaveToday: 1, team: 6 },
    rows: [
      { id: 'a1', who: 'oleh',  type: 'vacation', from: '10.06', to: '14.06', days: 5, status: 'pending',  submitted: '28.05' },
      { id: 'a2', who: 'maria', type: 'sick',     from: '29.05', to: '30.05', days: 2, status: 'pending',  submitted: '29.05' },
      { id: 'a3', who: 'denys', type: 'personal', from: '02.06', to: '02.06', days: 1, status: 'pending',  submitted: '27.05' },
      { id: 'a4', who: 'pavlo', type: 'vacation', from: '15.05', to: '17.05', days: 3, status: 'approved', submitted: '08.05' },
      { id: 'a5', who: 'anna',  type: 'unpaid',   from: '20.05', to: '21.05', days: 2, status: 'approved', submitted: '15.05' },
      { id: 'a6', who: 'oleh',  type: 'sick',     from: '06.05', to: '07.05', days: 2, status: 'approved', submitted: '06.05' },
      { id: 'a7', who: 'denys', type: 'unpaid',   from: '15.03', to: '18.03', days: 4, status: 'rejected', submitted: '10.03' },
    ],
  },
  types: {
    vacation: { label: 'Відпустка', color: 'var(--wf-success, #1F8A5B)' },
    sick:     { label: 'Лікарняний', color: 'var(--wf-warning, #D97706)' },
    unpaid:   { label: 'Без збереження', color: 'var(--wf-fg-subtle)' },
    personal: { label: 'Особистий', color: 'oklch(0.58 0.11 235)' },
  },
};
