// workspace-wallet-data.js — G8 · Client Wallet (module 25).
// Bonus balance (referral/manual) + money balance (AR: invoices vs payments).
// Portal: client-facing. Workspace: owner admin + referral tier settings.

window.WFP_WALLET = {
  // portal — active company wallet
  balance: { bonus: 180, money: -2200, moneyState: 'owes' }, // money<0 = owes
  transactions: [
    { id: 'w1', date: '29.05', kind: 'payment', title: 'Оплата INV-2025-0418', amount: 4200, run: -2200, alloc: 'покрив INV-0418' },
    { id: 'w2', date: '28.05', kind: 'charge',  title: 'Рахунок INV-2025-0418', amount: -4200, run: -6400, alloc: 'ORD-2412' },
    { id: 'w3', date: '22.05', kind: 'bonus',   title: 'Реферальний бонус · NordStream', amount: 80, run: 180, alloc: 'tier Regular 4%' },
    { id: 'w4', date: '18.05', kind: 'charge',  title: 'Рахунок INV-2025-0414', amount: -2200, run: -2200, alloc: 'ORD-2408' },
    { id: 'w5', date: '12.05', kind: 'bonus',   title: 'Бонус за відгук', amount: 50, run: 100, alloc: 'manual' },
    { id: 'w6', date: '02.05', kind: 'bonus',   title: 'Вітальний бонус', amount: 50, run: 50, alloc: 'welcome' },
  ],
  // unified statement timeline
  statement: [
    { date: '29.05', kind: 'payment', title: 'Платіж отримано', amount: 4200, note: 'банк · покрив INV-0418' },
    { date: '28.05', kind: 'charge',  title: 'INV-2025-0418 виставлено', amount: -4200, note: 'ORD-2412 · етап 1' },
    { date: '22.05', kind: 'bonus',   title: 'Реферальний бонус', amount: 80, note: 'NordStream → ви · 4%' },
    { date: '18.05', kind: 'charge',  title: 'INV-2025-0414 виставлено', amount: -2200, note: 'ORD-2408 · прострочено' },
  ],
  rules: [
    ['Бонуси', 'Нараховуються за рефералів і вручну. Можна застосувати до будь-якого рахунку.'],
    ['Грошовий баланс', 'Різниця між виставленими рахунками й оплатами. Відʼємний = є борг.'],
    ['Застосування бонусів', 'При оплаті рахунку можна списати бонуси як знижку (до 50% суми).'],
    ['Виведення', 'Бонуси не виводяться грошима — лише знижка на послуги.'],
  ],
};

window.WFP_WALLET_ADMIN = {
  summary: { ar: 8400, bonusLiability: 540, companies: 6, overdue: 2 },
  companies: [
    { slug: 'brunky',     name: 'Brunky',              industry: 'food',      bonus: 180, money: -2200, last: '29.05' },
    { slug: 'nordstream', name: 'NordStream Logistics', industry: 'logistics', bonus: 0,   money: -3200, last: '27.05' },
    { slug: 'tably',      name: 'Tably',                industry: 'saas',      bonus: 220, money: 600,    last: '28.05' },
    { slug: 'eduforge',   name: 'EduForge',             industry: 'education', bonus: 40,  money: -1400, last: '25.05' },
    { slug: 'aqualife',   name: 'AquaLife',             industry: 'retail',    bonus: 100, money: 0,      last: '20.05' },
    { slug: 'trasa',      name: 'Trasa',                industry: 'logistics', bonus: 0,   money: -1600, last: '19.05' },
  ],
};

window.WFP_REFERRAL_TIERS = {
  enabled: true,
  tiers: [
    { id: 'new',     name: 'New',     minEarned: 0,     percent: 0,  bonus: 'вітальний $50' },
    { id: 'regular', name: 'Regular', minEarned: 1000,  percent: 4,  bonus: '4% від реферала' },
    { id: 'partner', name: 'Partner', minEarned: 5000,  percent: 7,  bonus: '7% + пріоритет' },
    { id: 'vip',     name: 'VIP',     minEarned: 15000, percent: 10, bonus: '10% + персональний менеджер' },
  ],
  formula: { earned: 1000, percent: 5, bonus: 50 },
};
