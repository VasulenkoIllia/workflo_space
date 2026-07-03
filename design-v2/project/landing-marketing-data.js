// landing-marketing-data.js — content for the standalone landing routes that
// were only homepage sections before: /services (+ :slug), /about, /contact.
// Mirrors the brand voice from data.js (WF_CONTENT.services) and the terminal
// aesthetic. UA + EN.

window.WF_SERVICES = {
  intro: {
    ua: 'Чотири типи робіт. Не «розробка під ключ узагалі» — а конкретні задачі, які найчастіше приносять бізнеси. Клік на послугу — деталі, процес і приклади.',
    en: 'Four kinds of work. Not “software, broadly” — the concrete problems businesses bring most often. Click a service for details, process and examples.',
  },
  items: [
    {
      slug: 'integrations',
      num: '01',
      glyph: '⇄',
      name: { ua: 'Інтеграції та API', en: 'Integrations & API' },
      line: { ua: 'Коли дві системи не розмовляють між собою.', en: 'When two systems don’t talk to each other.' },
      summary: {
        ua: 'Зʼєднуємо те, що у вас вже є, щоб дані текли самі. CRM ↔ 1С, форми → база, Telegram ↔ Notion — без ручного перенесення.',
        en: 'We connect what you already run so data flows by itself. CRM ↔ 1C, forms → DB, Telegram ↔ Notion — no manual copy-paste.',
      },
      problem: {
        ua: ['Менеджери вручну переносять дані з однієї системи в іншу.', 'Замовлення губляться між формою, поштою й таблицею.', 'Кожна нова інтеграція через Zapier коштує більше, ніж власний конектор.'],
        en: ['Staff move data between systems by hand.', 'Orders get lost between a form, an inbox and a sheet.', 'Each new Zapier integration costs more than a custom connector.'],
      },
      deliverables: {
        ua: ['Двосторонній обмін між системами', 'Webhook-обробники з ретраями й чергою', 'Мапінг полів + валідація даних', 'Лог і моніторинг збоїв', 'Документація та доступи — ваші'],
        en: ['Two-way sync between systems', 'Webhook handlers with retries and a queue', 'Field mapping + data validation', 'Failure logging and monitoring', 'Docs and access — yours'],
      },
      stack: ['TypeScript', 'Node', 'Python', 'REST', 'webhooks', 'queues'],
      examples: { ua: 'CRM ↔ 1С · Notion ↔ Telegram · форми → БД · GoogleSheets → email-розсилка з тригером.', en: 'CRM ↔ 1C · Notion ↔ Telegram · forms → DB · Google Sheets → triggered email.' },
      relatedCase: 'brunky-crm-1c',
      typical: { ua: 'від 1–3 тижні', en: '1–3 weeks typical' },
    },
    {
      slug: 'ai-agents',
      num: '02',
      glyph: '✦',
      name: { ua: 'AI-агенти та workflow', en: 'AI agents & workflow' },
      line: { ua: 'Коли потрібен агент, який щось робить, а не просто чатить.', en: 'When you need an agent that does things, not just chats.' },
      summary: {
        ua: 'Агенти на ваших даних: саппорт з контекстом, аналітик звітів, генератор пропозицій. З гардами, ескалацією й вимірюваним результатом.',
        en: 'Agents grounded in your data: context-aware support, report analyst, proposal generator. With guards, escalation and measurable output.',
      },
      problem: {
        ua: ['Перша лінія підтримки тоне в однотипних питаннях.', 'Звіти й пропозиції готуються руками годинами.', '«AI» з коробки не знає ваших даних і вигадує.'],
        en: ['First-line support drowns in repetitive questions.', 'Reports and proposals take hours by hand.', 'Off-the-shelf “AI” doesn’t know your data and hallucinates.'],
      },
      deliverables: {
        ua: ['Агент на вашій базі знань (RAG)', 'Чіткі гарди + ескалація до людини', 'Інтеграція в Telegram / портал / сайт', 'Метрики: % автозакриття, точність', 'Контроль вартості токенів'],
        en: ['Agent over your knowledge base (RAG)', 'Clear guards + human escalation', 'Telegram / portal / site integration', 'Metrics: auto-resolution %, accuracy', 'Token-cost control'],
      },
      stack: ['OpenAI', 'Anthropic', 'LangChain', 'RAG', 'vector DBs'],
      examples: { ua: 'Бот саппорту з контекстом · агент-аналітик · генератор пропозицій з CRM · processor документів.', en: 'Context support bot · analyst agent · CRM proposal generator · document processor.' },
      relatedCase: 'tably-ai-support',
      typical: { ua: 'від 2–4 тижні', en: '2–4 weeks typical' },
    },
    {
      slug: 'portals',
      num: '03',
      glyph: '▦',
      name: { ua: 'Внутрішні портали та CRM', en: 'Internal portals & CRM' },
      line: { ua: 'Коли готові SaaS не покривають ваші процеси.', en: 'When off-the-shelf SaaS doesn’t fit your process.' },
      summary: {
        ua: 'Кастомний інструмент під ваш процес: портал замовлень, CRM під специфіку, real-time дашборд. Рівно те, що треба, без зайвого.',
        en: 'A custom tool for your process: order portal, CRM that fits, real-time dashboard. Exactly what you need, nothing extra.',
      },
      problem: {
        ua: ['Платите за 5 SaaS, а процес усе одно в Excel.', 'Команда воює з інструментом замість роботи.', 'Даних багато, але немає єдиної картини в реальному часі.'],
        en: ['You pay for 5 SaaS and the process still lives in Excel.', 'The team fights the tool instead of working.', 'Lots of data, but no single real-time picture.'],
      },
      deliverables: {
        ua: ['Портал/CRM під ваш реальний процес', 'Ролі та права (owner / member / executor)', 'Real-time дашборд ключових метрик', 'Мобільний-first, light + dark', 'Хостинг і передача коду'],
        en: ['Portal/CRM matching your real process', 'Roles and permissions (owner / member / executor)', 'Real-time dashboard of key metrics', 'Mobile-first, light + dark', 'Hosting and code handover'],
      },
      stack: ['Next.js', 'React', 'Postgres', 'Prisma'],
      examples: { ua: 'Портал замовлень для клієнтів · кастомний CRM · dashboard з real-time даних.', en: 'Client order portal · custom CRM · real-time dashboard.' },
      relatedCase: 'nordstream-track',
      typical: { ua: 'від 3–6 тижнів', en: '3–6 weeks typical' },
    },
    {
      slug: 'automation',
      num: '04',
      glyph: '⟳',
      name: { ua: 'Автоматизація рутини', en: 'Routine automation' },
      line: { ua: 'Коли людина робить те, що має робити скрипт.', en: 'When a person does what a script should.' },
      summary: {
        ua: 'Парсинг, генерація документів, заплановані звіти, монітори. Забираємо повторювану рутину — звільняємо години щотижня.',
        en: 'Parsing, document generation, scheduled reports, monitors. We take the repetitive routine — freeing hours every week.',
      },
      problem: {
        ua: ['Хтось щодня копіює дані з сайтів у таблицю.', 'Документи збираються вручну з шаблонів.', 'Звіти готуються в кінці місяця «на колінці».'],
        en: ['Someone copies data from sites into a sheet daily.', 'Documents are assembled from templates by hand.', 'Reports are cobbled together at month-end.'],
      },
      deliverables: {
        ua: ['Скрипти парсингу з розкладом', 'Генерація документів із шаблонів', 'Заплановані звіти в Telegram / пошту', 'Монітори й алерти на збої', 'Прозорий лог запусків'],
        en: ['Scheduled parsing scripts', 'Document generation from templates', 'Scheduled reports to Telegram / email', 'Monitors and failure alerts', 'Transparent run log'],
      },
      stack: ['Python', 'n8n', 'Make', 'GitHub Actions'],
      examples: { ua: 'Парсинг сайтів · генерація документів · заплановані звіти · scrapers · монітори.', en: 'Site scraping · document generation · scheduled reports · scrapers · monitors.' },
      relatedCase: 'brunky-crm-1c',
      typical: { ua: 'від кількох днів', en: 'from a few days' },
    },
  ],
};

window.WF_TEAM = {
  intro: {
    ua: 'Маленька команда, яка робить руками. Без прошарку менеджерів між вами й тим, хто пише код. Ви говорите з людьми, що відповідають за результат.',
    en: 'A small team that builds hands-on. No layer of managers between you and whoever writes the code. You talk to the people who own the outcome.',
  },
  founder: {
    name: 'Ілля Васюленко',
    role: { ua: 'Засновник · fullstack', en: 'Founder · fullstack' },
    avatar: 'developer',
    bio: {
      ua: ['8 років роблю інтеграції, портали й автоматизацію для малого та середнього бізнесу. Починав фрілансером, зараз — невелика команда під замовлення.', 'Принцип простий: беремо задачу, де автоматизація реально економить гроші, і доводимо до робочого результату. Без vendor lock-in — увесь код і доступи ваші.'],
      en: ['8 years building integrations, portals and automation for SMBs. Started as a freelancer, now a small team working to order.', 'The principle is simple: take a task where automation actually saves money and ship a working result. No vendor lock-in — all code and access are yours.'],
    },
    stats: [
      { v: '8', k: { ua: 'років досвіду', en: 'years experience' } },
      { v: '40+', k: { ua: 'проєктів', en: 'projects' } },
      { v: '12', k: { ua: 'активних клієнтів', en: 'active clients' } },
    ],
  },
  members: [
    { name: 'Олег Шевчук', avatar: 'designer', role: { ua: 'Product · дизайн', en: 'Product · design' }, focus: { ua: 'UX порталів, дизайн-система, фронт', en: 'Portal UX, design system, frontend' } },
    { name: 'Павло Кравець', avatar: 'devops', role: { ua: 'DevOps · інфра', en: 'DevOps · infra' }, focus: { ua: 'Деплой, моніторинг, надійність інтеграцій', en: 'Deploy, monitoring, integration reliability' } },
    { name: 'Денис Бойко', avatar: 'developer', role: { ua: 'Backend · інтеграції', en: 'Backend · integrations' }, focus: { ua: '1С, REST, черги, обробка даних', en: '1C, REST, queues, data processing' } },
    { name: 'Анна Левченко', avatar: 'copywriter', role: { ua: 'Контент · комунікація', en: 'Content · comms' }, focus: { ua: 'Кейси, блог, листування з клієнтами', en: 'Cases, blog, client comms' } },
  ],
  principles: {
    ua: [
      ['Робимо, що економить гроші', 'Не автоматизуємо заради автоматизації. Якщо задача не повертає вкладене — кажемо прямо.'],
      ['Код і доступи — ваші', 'Жодного lock-in. Усе передаємо повністю: репозиторій, документацію, паролі.'],
      ['Видимість процесу', 'Ви бачите статус, години й рахунки в порталі. Без «зробимо колись».'],
      ['Людська мова', 'Пояснюємо технічне нормальними словами. Без жаргону й маркетингового шуму.'],
    ],
    en: [
      ['We build what saves money', 'No automation for its own sake. If a task doesn’t return the investment, we say so.'],
      ['Code and access are yours', 'No lock-in. Full handover: repo, docs, credentials.'],
      ['Process visibility', 'You see status, hours and invoices in the portal. No “someday”.'],
      ['Human language', 'We explain the technical in normal words. No jargon or marketing noise.'],
    ],
  },
};

window.WF_CONTACT = {
  intro: {
    ua: 'Опишіть задачу — відповім протягом дня. Найшвидше в Telegram. Безкоштовний discovery-дзвінок на 30 хвилин, щоб зрозуміти, чи можу допомогти.',
    en: 'Describe the task — I’ll reply within a day. Fastest on Telegram. A free 30-minute discovery call to see if I can help.',
  },
  channels: [
    { kind: 'telegram', label: 'Telegram', value: '@workflo_space', href: '#', primary: true, note: { ua: 'відповідь за годину', en: 'reply within an hour' } },
    { kind: 'mail', label: 'Email', value: 'hello@workflo.space', href: 'mailto:hello@workflo.space', note: { ua: 'для деталей і документів', en: 'for details and documents' } },
    { kind: 'globe', label: 'Дзвінок', value: 'cal.com/workflo', href: '#', note: { ua: '30 хв · discovery', en: '30 min · discovery' } },
  ],
  fields: {
    ua: [
      { id: 'name', label: 'Як вас звати?', placeholder: 'Олена · Brunky', type: 'text' },
      { id: 'contact', label: 'Telegram або email', placeholder: '@olena / olena@brunky.ua', type: 'text' },
      { id: 'budget', label: 'Орієнтовний бюджет', placeholder: '', type: 'select', options: ['Ще не знаю', 'до $1 500', '$1 500 – $5 000', '$5 000+', 'Підписка / retainer'] },
      { id: 'task', label: 'Що треба зробити?', placeholder: 'Коротко: яка система, який результат хочете…', type: 'textarea' },
    ],
    en: [
      { id: 'name', label: 'Your name?', placeholder: 'Olena · Brunky', type: 'text' },
      { id: 'contact', label: 'Telegram or email', placeholder: '@olena / olena@brunky.ua', type: 'text' },
      { id: 'budget', label: 'Rough budget', placeholder: '', type: 'select', options: ['Not sure yet', 'up to $1,500', '$1,500 – $5,000', '$5,000+', 'Retainer'] },
      { id: 'task', label: 'What needs doing?', placeholder: 'Briefly: which system, the result you want…', type: 'textarea' },
    ],
  },
  reasons: {
    ua: ['Безкоштовний discovery-дзвінок', 'Відповідь у день звернення', 'Оцінка перед стартом, без сюрпризів', 'NDA за потреби'],
    en: ['Free discovery call', 'Same-day reply', 'Estimate before start, no surprises', 'NDA on request'],
  },
};
