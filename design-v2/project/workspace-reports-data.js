// workspace-reports-data.js — Reports v1 (19-А/Б/Д) + cash-flow (22-Г).

(function () {
  const REP = {
    months: ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер'],
    // 1) Revenue
    revenueByMonth: [18200, 19800, 21400, 20600, 23800, 25100],
    revenueByClient: [
      { client: 'Brunky', value: 9200 }, { client: 'EduForge', value: 6400 },
      { client: 'Tably', value: 4800 }, { client: 'NordStream', value: 2900 },
      { client: 'Florèal', value: 1800 },
    ],
    // 2) Margin
    marginByClient: [
      { name: 'Brunky', revenue: 9200, cost: 3400, margin: 63 },
      { name: 'EduForge', revenue: 6400, cost: 2700, margin: 58 },
      { name: 'Tably', revenue: 4800, cost: 1630, margin: 66 },
      { name: 'NordStream', revenue: 2900, cost: 1160, margin: 60 },
    ],
    marginByProject: [
      { name: 'PRJ-118 · Підтримка', revenue: 3200, cost: 1180, margin: 63 },
      { name: 'PRJ-121 · Інтеграція 1С', revenue: 1260, cost: 454, margin: 64 },
      { name: 'PRJ-109 · LMS', revenue: 2800, cost: 1176, margin: 58 },
      { name: 'PRJ-112 · API', revenue: 1700, cost: 578, margin: 66 },
    ],
    // 3) Debtors with overdue
    debtors: [
      { client: 'Brunky', invoice: 'INV-2025-0418', debt: 1800, overdue: 6 },
      { client: 'EduForge', invoice: 'INV-2025-0410', debt: 1260, overdue: 2 },
      { client: 'NordStream', invoice: 'INV-2025-0395', debt: 880, overdue: 18 },
    ],
    // 4) Utilization
    utilization: [
      { name: 'Андрій Левченко', util: 92 }, { name: 'Марія Слюсар', util: 74 },
      { name: 'Ігор Бондар', util: 88 }, { name: 'Ілля Васюленко', util: 50 },
    ],
    // 5) New clients / registrations
    newClients: [
      { month: 'Січ', clients: 2, regs: 5 }, { month: 'Лют', clients: 1, regs: 4 },
      { month: 'Бер', clients: 3, regs: 7 }, { month: 'Кві', clients: 2, regs: 6 },
      { month: 'Тра', clients: 4, regs: 9 }, { month: 'Чер', clients: 2, regs: 8 },
    ],
  };

  // MoM deltas (19-Д)
  const MOM = [
    { k: 'Виручка', v: '$25 100', delta: +5.5 },
    { k: 'Маржа сер.', v: '62%', delta: +1.2 },
    { k: 'Дебіторка', v: '$3 940', delta: -8.0, inverse: true },
    { k: 'Нові клієнти', v: '2', delta: -50.0 },
  ];

  // Cash-flow forecast (22-Г) — 3 months
  const CASHFLOW = {
    opening: 8400,
    months: ['Липень', 'Серпень', 'Вересень'],
    inflow: [22600, 24100, 23400],   // нарахування + payment terms timing
    outflow: [14200, 13800, 15100],  // витрати + payroll
    breakdownIn: [
      { label: 'Абонплати (fixed)', value: 11200 },
      { label: 'Погодинні (postpaid)', value: 7400 },
      { label: 'Передоплати', value: 4000 },
    ],
    breakdownOut: [
      { label: 'Payroll', value: 8600 },
      { label: 'Інфраструктура / SaaS', value: 2100 },
      { label: 'Маркетинг', value: 1800 },
      { label: 'Інше', value: 1700 },
    ],
  };

  window.WF_REPORTS = { REP, MOM, CASHFLOW };
})();
