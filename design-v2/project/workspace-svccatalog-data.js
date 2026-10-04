// workspace-svccatalog-data.js — Каталог послуг (billable services library).
// A service carries TWO independent economics axes the owner sets flexibly:
//   cost (собівартість): in hours, in money, or none
//   bill (клієнту):      in hours (списуються з включених) OR in money (додаються до суми)
// When a retainer (абонплата) includes a service, the system can auto-generate
// the executor's recurring task from it (makesTask + cadence + assignee).

(function () {
  // person pool reuse
  const A = {
    andriy: 'Андрій Левченко', igor: 'Ігор Бондар', maria: 'Марія Слюсар',
    olena: 'Олена Кравець', illia: 'Ілля Васюленко', taras: 'Тарас Мельник',
  };

  const CATEGORIES = ['Підтримка', 'Інфраструктура', 'Контент', 'Консалтинг', 'QA'];

  // kind: how the service behaves
  //  work     — праця команди (собівартість у годинах)
  //  resource — зовнішній ресурс (оренда сервера/домен — собівартість у грошах)
  //  fixed    — фіксований пакет/консультація (ціна, собівартість опційна)
  const CATALOG = [
    {
      id: 'sv-support', code: 'SVC-01', name: 'Підтримка та хотфікси', category: 'Підтримка', kind: 'work',
      cost: { mode: 'hours', hours: 0, money: 0 },           // фактичні години списуються по факту
      bill: { mode: 'hours', hours: 0, price: 0 },           // списуються з включених годин по факту
      variable: true,                                         // обсяг плаваючий (по факту, не фікс)
      recurring: null, makesTask: false, assignee: 'igor',
      desc: 'Усунення інцидентів і дрібні правки в межах включених годин. Списується за фактом.', usedIn: 3,
    },
    {
      id: 'sv-monitor', code: 'SVC-02', name: 'Моніторинг аптайму 24/7', category: 'Інфраструктура', kind: 'work',
      cost: { mode: 'hours', hours: 1, money: 0 },
      bill: { mode: 'hours', hours: 2, price: 0 },
      recurring: 'monthly', makesTask: true, assignee: 'igor', taskDay: '1-е число',
      desc: 'Налаштування алертів, щомісячна перевірка. Показуємо клієнту 2 год, фактично ~1 год.', usedIn: 2,
    },
    {
      id: 'sv-backup', code: 'SVC-03', name: 'Бекап + перевірка відновлення', category: 'Інфраструктура', kind: 'work',
      cost: { mode: 'hours', hours: 1, money: 0 },
      bill: { mode: 'hours', hours: 1, price: 0 },
      recurring: 'weekly', makesTask: true, assignee: 'igor', taskDay: 'Пн 09:00',
      desc: 'Щотижневий бекап і тест-відновлення. Падає виконавцю автоматично.', usedIn: 2,
    },
    {
      id: 'sv-report', code: 'SVC-04', name: 'Щомісячний звіт', category: 'Підтримка', kind: 'work',
      cost: { mode: 'hours', hours: 2, money: 0 },
      bill: { mode: 'hours', hours: 3, price: 0 },
      recurring: 'monthly', makesTask: true, assignee: 'andriy', taskDay: '1-е число',
      desc: 'Звіт по витрачених годинах, аптайму та рекомендаціях. Авто-задача на PM.', usedIn: 2,
    },
    {
      id: 'sv-server', code: 'SVC-05', name: 'Оренда сервера (prod)', category: 'Інфраструктура', kind: 'resource',
      cost: { mode: 'money', hours: 0, money: 10 },          // ми платимо $10
      bill: { mode: 'money', hours: 0, price: 20 },          // клієнт платить $20 (в сумі абонплати)
      recurring: 'monthly', makesTask: false, assignee: 'igor',
      desc: 'Орендуємо VPS за $10, у абонплату закладаємо $20. Задача не створюється — лише білінг.', usedIn: 2,
    },
    {
      id: 'sv-ssl', code: 'SVC-06', name: 'SSL + домен', category: 'Інфраструктура', kind: 'resource',
      cost: { mode: 'money', hours: 0, money: 2 },
      bill: { mode: 'money', hours: 0, price: 5 },
      recurring: 'monthly', makesTask: false, assignee: 'igor',
      desc: 'Сертифікат і домен. Собівартість $2, клієнту $5.', usedIn: 1,
    },
    {
      id: 'sv-deps', code: 'SVC-07', name: 'Оновлення залежностей + аудит', category: 'QA', kind: 'work',
      cost: { mode: 'hours', hours: 2, money: 0 },
      bill: { mode: 'hours', hours: 2, price: 0 },
      recurring: 'monthly', makesTask: true, assignee: 'igor', taskDay: '15-е число',
      desc: 'Оновлення пакетів і security-аудит. Авто-задача.', usedIn: 1,
    },
    {
      id: 'sv-sync', code: 'SVC-08', name: 'Sync-дзвінок із клієнтом', category: 'Консалтинг', kind: 'work',
      cost: { mode: 'hours', hours: 1, money: 0 },
      bill: { mode: 'hours', hours: 1, price: 0 },
      recurring: 'biweekly', makesTask: true, assignee: 'illia', taskDay: 'Чт 15:00',
      desc: 'Регулярна синхронізація. Падає PM кожні 2 тижні.', usedIn: 1,
    },
    {
      id: 'sv-arch', code: 'SVC-09', name: 'Консультація з архітектури', category: 'Консалтинг', kind: 'fixed',
      cost: { mode: 'none', hours: 0, money: 0 },            // собівартість не рахуємо
      bill: { mode: 'money', hours: 0, price: 200 },         // просто ціна, без собівартості
      recurring: null, makesTask: true, assignee: 'andriy',
      desc: 'Фіксований пакет консультації. Вказуємо лише ціну — собівартість не вираховуємо.', usedIn: 0,
    },
    {
      id: 'sv-content', code: 'SVC-10', name: 'Контент-оновлення (до 4 модулів)', category: 'Контент', kind: 'work',
      cost: { mode: 'hours', hours: 6, money: 0 },
      bill: { mode: 'hours', hours: 8, price: 0 },
      recurring: 'monthly', makesTask: true, assignee: 'maria', taskDay: '10-е число',
      desc: 'Оновлення навчальних модулів. Показуємо 8 год, фактично ~6.', usedIn: 1,
    },
  ];

  const CADENCE = {
    weekly:   { label: 'Щотижня',        short: 'тижд' },
    biweekly: { label: 'Раз на 2 тижні', short: '2 тижд' },
    monthly:  { label: 'Щомісяця',       short: 'міс' },
    once:     { label: 'Разово',         short: '1×' },
  };

  const KIND = {
    work:     { label: 'Робота', tone: 'accent', desc: 'праця команди · собівартість у годинах' },
    resource: { label: 'Ресурс', tone: 'warn',   desc: 'зовнішній ресурс · собівартість у грошах' },
    fixed:    { label: 'Фікс',   tone: 'muted',  desc: 'фіксований пакет · ціна, собівартість опційна' },
  };

  function money(n, cur) {
    if (window.WF_C360 && window.WF_C360.money) return window.WF_C360.money(n || 0, cur || 'USD');
    return '$' + (n || 0).toLocaleString('en-US');
  }

  // margin only meaningful when both sides are money
  function svcMargin(s) {
    if (s.bill.mode === 'money' && s.cost.mode === 'money' && s.bill.price > 0) {
      return Math.round(((s.bill.price - s.cost.money) / s.bill.price) * 100);
    }
    return null;
  }

  window.WF_SVC = { CATALOG, CATEGORIES, CADENCE, KIND, A, money, svcMargin };
})();
