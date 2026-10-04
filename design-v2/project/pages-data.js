// pages-data.js — companies + project detail pages (full case studies)
// Adds depth to the landing for SEO weight: each project and company gets
// its own page-equivalent of content, ~500-800 words per project.

window.WF_COMPANIES = [
  {
    slug: 'brunky',
    name: 'Brunky',
    industry: { ua: 'Мережа кав\'ярень', en: 'Café network' },
    location: 'Lutsk, UA',
    size: { ua: '12 співробітників · 4 точки', en: '12 employees · 4 locations' },
    since: '2024',
    status: 'active',
    accent: '#a36b3c',
    logo_glyph: 'B/',
    links: {
      website: { url: 'https://brunky.cafe', label: 'brunky.cafe' },
      instagram: { url: 'https://instagram.com/brunky.cafe', label: '@brunky.cafe' },
      tiktok: { url: 'https://tiktok.com/@brunky', label: '@brunky' },
    },
    bio: {
      ua: [
        'Brunky — це локальна мережа з чотирьох кав\'ярень у Луцьку, заснована у 2021. Спеціалізуються на specialty каві, домашній випічці та доставці на робочі місця у бізнес-центри міста.',
        'Команда — близько 12 співробітників, з яких 50 контрактних водіїв на доставку. Працюємо разом з кінця 2024 — спочатку зробили один інтеграційний проєкт, після нього розпочали QR-програму лояльності.',
      ],
      en: [
        'Brunky operates four cafés in Lutsk since 2021. They specialize in specialty coffee, in-house baking, and delivery to local business centres.',
        'About 12 employees, plus 50 contractor delivery drivers. We started working together late 2024 — first the 1C integration, then the QR loyalty programme.',
      ],
    },
    testimonial: {
      ua: 'Ілля зрозумів, що нам потрібен не просто бот, а нова схема комунікації з водіями. За шість тижнів ми перейшли з ручної координації на повністю автоматичний цикл — і це вже не повернеться назад.',
      en: 'Illia understood we needed not just a bot but a new communication flow with our drivers. In six weeks we moved from manual coordination to a fully automated cycle — and we are not going back.',
      author: 'Olena B., COO Brunky',
    },
    projects: ['retail-1c-integration', 'qr-loyalty'],
  },
  {
    slug: 'eduforge',
    name: 'EduForge',
    industry: { ua: 'Онлайн-курси · інфобізнес', en: 'Online courses · infoproduct' },
    location: 'Kyiv, UA',
    size: { ua: '8 співробітників · 6 курсів', en: '8 employees · 6 courses' },
    since: '2024',
    status: 'active',
    accent: '#5a7db5',
    logo_glyph: 'ef',
    links: {
      website: { url: 'https://eduforge.io', label: 'eduforge.io' },
      instagram: { url: 'https://instagram.com/eduforge', label: '@eduforge' },
      tiktok: { url: 'https://tiktok.com/@eduforge.io', label: '@eduforge.io' },
      youtube: { url: 'https://youtube.com/@eduforge', label: '@eduforge' },
    },
    bio: {
      ua: [
        'EduForge — інфобізнес з шести онлайн-курсів про дизайн, продукт-менеджмент і програмування. Аудиторія ~2400 активних студентів. Сильна спільнота, але менеджери захлинались у Telegram-чаті.',
        'Працюємо з 2024 — зробив AI-консультанта, який знімає 80% повторюваних питань про курси, дедлайни і оплату.',
      ],
      en: [
        'EduForge runs six online courses on design, product, and engineering. ~2,400 active students. Strong community, but managers were drowning in the Telegram chat.',
        'Working together since 2024 — built an AI consultant that handles 80% of repeat questions about courses, deadlines, and billing.',
      ],
    },
    testimonial: {
      ua: 'Серйозно думав, що бот — це чат-вікно з кнопочками. Виявилось, він закриває заперечення краще за нашого джуніора-сейлза. Через місяць після релізу команда забула, як це — відповідати на одне й те саме у 22 діалогах.',
      en: 'I genuinely thought a bot was a window with buttons. Turns out it handles objections better than our junior salesperson. A month after launch the team forgot what it was like to answer the same thing in 22 chats.',
      author: 'Oleksii K., Co-founder EduForge',
    },
    projects: ['ai-support-agent'],
  },
  {
    slug: 'trasa-logistics',
    name: 'Trasa Logistics',
    industry: { ua: 'Логістика · 3PL', en: 'Logistics · 3PL' },
    location: 'Lviv, UA',
    size: { ua: '~80 співробітників · 300 одиниць техніки', en: '~80 employees · 300 vehicles' },
    since: '2025',
    status: 'active',
    accent: '#3c7d5a',
    logo_glyph: 't//',
    links: {
      website: { url: 'https://trasa.com', label: 'trasa.com' },
      linkedin: { url: 'https://linkedin.com/company/trasa-logistics', label: 'trasa-logistics' },
      instagram: { url: 'https://instagram.com/trasalogistics', label: '@trasalogistics' },
    },
    bio: {
      ua: [
        'Trasa Logistics — оператор вантажних перевезень з Львова, працює переважно на маршрутах Україна-ЄС. 300 одиниць техніки, ~80 співробітників. Великий обсяг паперової роботи, три не пов\'язані системи (склад, доставка, фінанси).',
        'Влітку 2025 запустили кастомний CRM-портал, що замінив трирічну спадщину Excel-файлів.',
      ],
      en: [
        'Trasa Logistics is a freight operator from Lviv, primarily on UA-EU routes. 300 vehicles, ~80 employees. Heavy paperwork, three disconnected systems (warehouse, delivery, finance).',
        'In summer 2025 we shipped a custom CRM portal that replaced three years of Excel legacy.',
      ],
    },
    testimonial: {
      ua: 'За три роки ми накопичили шар Excel-файлів, у які боялися полізти. Ілля не просто переніс це в БД — він поговорив з командою і зрозумів, які дані ми насправді використовуємо щодня, а які ховаємо «про всяк випадок».',
      en: 'Over three years we built layers of Excel files we were scared to touch. Illia did not just move it into a database — he talked to the team and understood which data we actually use daily versus what we keep "just in case".',
      author: 'Andriy V., Head of Operations Trasa',
    },
    projects: ['custom-crm-logistics'],
  },
  {
    slug: 'nordstream',
    name: 'Nordstream Agency',
    industry: { ua: 'Маркетинг-агенція', en: 'Marketing agency' },
    location: 'Kyiv, UA',
    size: { ua: '24 співробітники · B2B клієнти', en: '24 employees · B2B clients' },
    since: '2024',
    status: 'active',
    accent: '#8b5fbf',
    logo_glyph: 'N→',
    links: {
      website: { url: 'https://nordstream.agency', label: 'nordstream.agency' },
      linkedin: { url: 'https://linkedin.com/company/nordstream', label: 'nordstream' },
      instagram: { url: 'https://instagram.com/nordstream', label: '@nordstream' },
      tiktok: { url: 'https://tiktok.com/@nordstream.agency', label: '@nordstream.agency' },
    },
    bio: {
      ua: [
        'Nordstream — performance-маркетингова агенція з Києва. 24 співробітники, переважно B2B клієнти у IT та fintech. Стабільний потік лідів через холодні кампанії, але слабкий conversion через відсутність кваліфікації.',
        'Працюємо з 2024 — спочатку bot-кваліфікатор, потім парсер ринкових даних для робочих звітів.',
      ],
      en: [
        'Nordstream is a performance marketing agency from Kyiv. 24 employees, mostly B2B clients in IT and fintech. Steady lead flow from cold campaigns but weak conversion due to no qualification.',
        'Working together since 2024 — first a qualifier bot, then a market data parser for client reports.',
      ],
    },
    testimonial: {
      ua: 'Ділова комунікація, чіткі дедлайни, фіксована ціна. Рідкість на українському ринку. Бот-кваліфікатор окупився за 6 тижнів — і це з урахуванням нашого scепsis на старті.',
      en: 'Clear communication, fixed deadlines, fixed price. Rare on this market. The qualifier bot paid for itself in 6 weeks — and that includes our scepticism going in.',
      author: 'Dmytro B., CMO Nordstream',
    },
    projects: ['lead-qualifier', 'market-parser'],
  },
  {
    slug: 'tably',
    name: 'Tably',
    industry: { ua: 'B2B SaaS · бронювання послуг', en: 'B2B SaaS · service booking' },
    location: 'Berlin, DE',
    size: { ua: '~30 співробітників · 8000+ користувачів', en: '~30 employees · 8000+ users' },
    since: '2025',
    status: 'active',
    accent: '#d97a4a',
    logo_glyph: '/t',
    links: {
      website: { url: 'https://tably.app', label: 'tably.app' },
      linkedin: { url: 'https://linkedin.com/company/tably', label: 'tably' },
      instagram: { url: 'https://instagram.com/tably', label: '@tably' },
      x: { url: 'https://x.com/tably_app', label: '@tably_app' },
    },
    bio: {
      ua: [
        'Tably — SaaS-платформа для салонів краси, барбершопів та аналогічних бізнесів. Управління записами, фінанси, лояльність. 8000+ активних користувачів у трьох країнах.',
        'У 2025 зробив для них tier-1 саппорт-агент з пам\'яттю про тікети — first-response впав з 14 годин до миттєвої відповіді.',
      ],
      en: [
        'Tably is a SaaS for salons, barbershops, and similar service businesses. Bookings, finance, loyalty. 8000+ active users across three countries.',
        'In 2025 built them a tier-1 support agent with ticket memory — first-response dropped from 14 hours to instant.',
      ],
    },
    testimonial: {
      ua: 'Ми міряли saving у годинах і доларах — кожен з нас тепер економить 4 години на тиждень. Команда зробила більше за квартал, ніж за попередні два. І це попри те, що ми скоротили дві позиції в саппорті.',
      en: 'We measured savings in hours and dollars — each of us now saves 4 hours per week. The team shipped more in one quarter than in the two before. And that is after we eliminated two support positions.',
      author: 'Maria S., Head of Operations Tably',
    },
    projects: ['ai-tier1-agent'],
  },
];

window.WF_PROJECTS = [
  {
    slug: 'retail-1c-integration',
    company: 'brunky',
    name: { ua: 'Інтеграція 1С ↔ Telegram', en: '1C ↔ Telegram integration' },
    role: { ua: 'Архітектор + розробник', en: 'Architect + developer' },
    year: 2025,
    quarter: 'Q3',
    duration: { ua: '6 тижнів', en: '6 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: '50 водіїв скидали накладні в чат вручну. Менеджер витрачав 6 годин/день на підтвердження замовлень. За шість тижнів зробив бота, який синхронізується з 1С автоматично — менеджер тепер тратить 15 хвилин.',
      en: '50 drivers dropped invoices in chat manually. The manager spent 6 hours/day confirming orders. In six weeks I built a bot that syncs to 1C automatically — the manager now spends 15 minutes.',
    },
    problem: {
      ua: [
        'Brunky — мережа з чотирьох кав\'ярень у Луцьку, що працює з 50 контрактними водіями на доставку. До початку проєкту кожен водій надсилав накладну вільним текстом у спільний Telegram-канал — фото, голосове, інколи просто «привезу о 14».',
        'Менеджер з кожної точки вручну вводив ці дані у 1С, шукав замовлення у системі, підтверджував статус. На це йшло ~6 годин/день. До 300 повідомлень на день — 30% мали помилки або неповні дані.',
        'Координація між точками вручну через груповий чат. Помилки в обліку накопичувались — наприкінці місяця 2-3 дні бухгалтерія підтверджувала «що насправді привезли».',
      ],
      en: [
        'Brunky operates four cafés in Lutsk with 50 contractor delivery drivers. Before the project, each driver dropped an invoice as free text in a shared Telegram channel — photo, voice note, sometimes just "delivering at 14".',
        'A manager at each location manually entered this data into 1C, looked up the order, confirmed the status. It took ~6 hours/day. Up to 300 messages/day with 30% having errors or incomplete data.',
        'Cross-location coordination was manual via group chat. Bookkeeping errors accumulated — at month-end 2-3 days were spent reconciling "what was actually delivered".',
      ],
    },
    solution: {
      ua: [
        'Спочатку зробив структурований формат повідомлень з тегами `#order N123` `#weight 4kg` `#location west` — водії могли відправити голосове, і LLM-парсер витягував поля автоматично. Якщо формат неповний — бот ставив уточнююче питання у тому ж чаті.',
        'Кожне підтверджене повідомлення йшло у 1С через REST-обгортку, яку я написав поверх її SOAP API. Бот шле клієнту push зі статусом готовності замовлення — це знизило кількість «коли приїде?» питань на 60%.',
        'Менеджер тепер бачить тільки відхилення — повідомлення, де парсер не впевнений, плюс щоденне summary. Решта йде в систему без його участі.',
      ],
      en: [
        'First, established a structured message format with tags `#order N123` `#weight 4kg` `#location west` — drivers can send voice and an LLM parser extracts the fields. If the format is incomplete, the bot asks a clarifying question in the same chat.',
        'Each confirmed message is sent to 1C via a REST wrapper I built on top of its SOAP API. The bot sends the customer a push with order-ready status — this dropped "when will it arrive?" inquiries by 60%.',
        'The manager now only sees exceptions — messages where the parser is unsure — plus a daily summary. The rest flows into the system without their involvement.',
      ],
    },
    approach: [
      { week: { ua: 'тиждень 1', en: 'week 1' }, name: { ua: 'discovery + інтерв\'ю з 5 водіями', en: 'discovery + 5 driver interviews' }, pct: 100 },
      { week: { ua: 'тиждень 2-3', en: 'week 2-3' }, name: { ua: 'arch + 1С API wrapper', en: 'arch + 1C API wrapper' }, pct: 100 },
      { week: { ua: 'тиждень 4-5', en: 'week 4-5' }, name: { ua: 'bot + LLM-парсер + тестування на 5 водіях', en: 'bot + LLM parser + tested with 5 drivers' }, pct: 100 },
      { week: { ua: 'тиждень 6', en: 'week 6' }, name: { ua: 'rollout на 50 водіїв + 2 тижні підтримки', en: 'rollout to 50 drivers + 2 weeks support' }, pct: 100 },
    ],
    metrics: [
      { value: '−87%', label: { ua: 'часу на обробку замовлень', en: 'order processing time' } },
      { value: '+€12k', label: { ua: 'додаткового MRR з cross-sell', en: 'additional MRR from cross-sell' } },
      { value: '4 → 1', label: { ua: 'системи зведено в один потік', en: 'systems unified in one flow' } },
      { value: '−60%', label: { ua: '«коли привезете?» питань', en: '"when will it arrive?" inquiries' } },
    ],
    before_after: {
      ua: {
        before: '6 годин/день ручне підтвердження · 30% повідомлень з помилками · 2-3 дні бухгалтерії наприкінці місяця',
        after: '15 хвилин/день review винятків · 0 помилок копіювання · щоденний автозвіт',
      },
      en: {
        before: '6 hours/day manual confirmation · 30% messages with errors · 2-3 days bookkeeping at month-end',
        after: '15 min/day exception review · 0 copy errors · daily auto-report',
      },
    },
    stack: ['Next.js', 'TypeScript', 'Postgres', 'Prisma', '1C REST wrapper', 'Telegram Bot API', 'Anthropic Claude (parsing)', 'Vercel', 'Sentry'],
    testimonial: {
      ua: 'Ілля зрозумів, що нам потрібен не просто бот, а нова схема комунікації з водіями. За шість тижнів ми перейшли з ручної координації на повністю автоматичний цикл.',
      en: 'Illia understood we needed not just a bot but a new communication flow with our drivers. In six weeks we went from manual coordination to a fully automated cycle.',
      author: 'Olena B., COO Brunky',
    },
    related: ['ai-support-agent', 'custom-crm-logistics'],
  },

  {
    slug: 'ai-support-agent',
    company: 'eduforge',
    name: { ua: 'AI-консультант для онлайн-курсів', en: 'AI consultant for online courses' },
    role: { ua: 'Lead engineer · повний цикл', en: 'Lead engineer · full cycle' },
    year: 2024,
    quarter: 'Q4',
    duration: { ua: '4 тижні', en: '4 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: 'Менеджери EduForge відповідали на одні й ті ж 22 питання у середньому 14 годин/день. Зробив AI-агента з RAG над матеріалами курсів — 68% запитів закриваються без людини, апсейл преміум-тарифу зріс на 22%.',
      en: 'EduForge managers answered the same 22 questions ~14 hours/day. I built an AI agent with RAG over course materials — 68% of requests resolve without a human, premium-tier upsell up 22%.',
    },
    problem: {
      ua: [
        'EduForge — інфобізнес з шести онлайн-курсів. Студенти пишуть у Telegram-чат: «коли наступний модуль?», «що відрізняє преміум від базового?», «як змінити email?». Менеджери відповідають вручну.',
        'Дані не персистентні — той самий студент задавав одне й те саме питання трьом різним менеджерам за тиждень. Це створювало враження «у вас же ніби нічого не змінилось».',
        'Конверсія у premium залежала від того, хто з менеджерів зловив гарячий запит. Чотири менеджери — чотири різні conversion rate.',
      ],
      en: [
        'EduForge runs six online courses. Students chat in Telegram: "when is the next module?", "what makes premium different?", "how do I change my email?". Managers answer manually.',
        'Data was not persisted — the same student would ask the same thing of three different managers in a week. It felt like "but nothing has changed on your side".',
        'Premium conversion depended on which manager caught a hot inquiry. Four managers, four different conversion rates.',
      ],
    },
    solution: {
      ua: [
        'AI-агент на Anthropic Claude з RAG над матеріалами курсів і базою знань. Знає програму, дедлайни, ціни, особливості преміум-тарифу. Пам\'ятає кожен діалог — повертається до контексту через тиждень.',
        'Окрема agentic-логіка для апсейлу: якщо студент згадав про «складно» або «не встигаю», агент розпізнає це і м\'яко переводить на преміум (з ментором). Текст підбирається з 12 заготовлених варіантів по emotional tone.',
        'Менеджери бачать тільки складні випадки — `<conf:0.7` йдуть до людини. Дашборд показує конверсію по типах запитів. За перші 6 тижнів — 68% автоматизація, апсейл +22%.',
      ],
      en: [
        'An AI agent on Anthropic Claude with RAG over course materials and a knowledge base. It knows the syllabus, deadlines, prices, and what makes premium different. It remembers every conversation — returns to context a week later.',
        'Separate agentic logic for upsell: if a student mentions "hard" or "falling behind", the agent recognises this and gently moves them to premium (with mentor). The copy is picked from 12 pre-written variants by emotional tone.',
        'Managers only see hard cases — `<conf:0.7` is escalated to a human. A dashboard shows conversion by request type. First 6 weeks: 68% automation, +22% upsell.',
      ],
    },
    approach: [
      { week: { ua: 'тиждень 1', en: 'week 1' }, name: { ua: 'discovery · аналіз 200 діалогів · карта запитів', en: 'discovery · 200 chat analysis · question map' }, pct: 100 },
      { week: { ua: 'тиждень 2', en: 'week 2' }, name: { ua: 'RAG-індекс · prompts · agentic flow', en: 'RAG index · prompts · agentic flow' }, pct: 100 },
      { week: { ua: 'тиждень 3', en: 'week 3' }, name: { ua: 'soft-launch на 10% трафіку · калібрування', en: 'soft-launch 10% traffic · calibration' }, pct: 100 },
      { week: { ua: 'тиждень 4', en: 'week 4' }, name: { ua: 'rollout 100% · документація · навчання', en: 'rollout 100% · documentation · training' }, pct: 100 },
    ],
    metrics: [
      { value: '−68%', label: { ua: 'ручних відповідей', en: 'manual replies' } },
      { value: '+22%', label: { ua: 'апсейл преміум', en: 'premium upsell' } },
      { value: '+24%', label: { ua: 'CSAT', en: 'CSAT' } },
      { value: '$3.2k', label: { ua: 'економія/міс', en: 'saved per month' } },
    ],
    before_after: {
      ua: {
        before: '14 годин/день · 4 менеджери · ~22 повторюваних питання · різна конверсія в premium у кожного',
        after: '~5 годин/день review винятків · агент тримає tone of voice · стабільні 38% premium conversion',
      },
      en: {
        before: '14 hours/day · 4 managers · ~22 repeat questions · different premium conversion per manager',
        after: '~5 hours/day exception review · agent holds tone of voice · stable 38% premium conversion',
      },
    },
    stack: ['Anthropic Claude', 'Python', 'Pinecone (vectors)', 'LangChain', 'Telegram Bot API', 'Supabase', 'Sentry'],
    testimonial: {
      ua: 'Серйозно думав, що бот — це чат-вікно з кнопочками. Виявилось, він закриває заперечення краще за нашого джуніора-сейлза.',
      en: 'I genuinely thought a bot was a window with buttons. Turns out it handles objections better than our junior salesperson.',
      author: 'Oleksii K., Co-founder EduForge',
    },
    related: ['ai-tier1-agent', 'lead-qualifier'],
  },

  {
    slug: 'custom-crm-logistics',
    company: 'trasa-logistics',
    name: { ua: 'Кастомний CRM для логістики', en: 'Custom CRM for logistics' },
    role: { ua: 'Архітектор + повний стек', en: 'Architect + full stack' },
    year: 2025,
    quarter: 'Q2',
    duration: { ua: '8 тижнів', en: '8 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: 'Trasa Logistics жили у трьох розрізнених системах (склад, доставка, фінанси) + 87 Excel-файлів. Зробив єдиний портал з реальним часом — 400 годин/міс економії, нічна синхронізація скасована.',
      en: 'Trasa Logistics lived in three disconnected systems (warehouse, delivery, finance) plus 87 Excel files. I built a unified real-time portal — 400 hrs/mo saved, nightly sync killed.',
    },
    problem: {
      ua: [
        'Trasa — 300 одиниць техніки, ~80 співробітників. Три не пов\'язані системи: WMS на складі, окремий tracker доставок, бухгалтерія в 1С. Дані ходили через 87 Excel-файлів і нічну ETL-задачу, яку «писав хтось у 2022, точно не пам\'ятаємо».',
        'Запит «де зараз вантаж X?» — це 3-4 запити до різних людей, час відповіді 20-40 хвилин. Це блокувало sales-команду, яка не могла дати клієнту обіцянку без перевірки.',
      ],
      en: [
        'Trasa runs 300 vehicles and ~80 employees. Three disconnected systems: a WMS at the warehouse, a separate delivery tracker, and accounting in 1C. Data flowed through 87 Excel files and a nightly ETL job "written by someone in 2022, do not really remember".',
        '"Where is shipment X?" was 3-4 enquiries to different people, 20-40 min answer time. This blocked the sales team — they could not promise anything to a client without a check.',
      ],
    },
    solution: {
      ua: [
        'Зробив єдиний портал на Next.js + Postgres з real-time tracking. Підтягує дані з WMS, tracker\'а доставки та 1С через коннектори (REST + два legacy SOAP).',
        'Розділив права доступу за ролями: водій бачить свій маршрут, диспетчер — всі активні маршрути, фінансист — фінансовий рейтинг по маршрутах. Все на одній сторінці без перемикань між програмами.',
        'Нічна синхронізація замінена на event-driven sync через Redis pubsub. Дані appear у портал за ~3 секунди після зміни в WMS.',
      ],
      en: [
        'Built a unified portal on Next.js + Postgres with real-time tracking. Pulls data from the WMS, delivery tracker, and 1C through connectors (REST + two legacy SOAP).',
        'Role-based access: driver sees their route, dispatcher sees all active routes, finance sees the financial picture per route. All on one page with no app-switching.',
        'Nightly sync replaced with event-driven sync via Redis pubsub. Data appears in the portal ~3 seconds after a WMS change.',
      ],
    },
    approach: [
      { week: { ua: 'тиждень 1-2', en: 'week 1-2' }, name: { ua: 'discovery · інтерв\'ю з диспетчерами, водіями, фінансами', en: 'discovery · dispatch + drivers + finance interviews' }, pct: 100 },
      { week: { ua: 'тиждень 3-4', en: 'week 3-4' }, name: { ua: 'schema · connectors · auth', en: 'schema · connectors · auth' }, pct: 100 },
      { week: { ua: 'тиждень 5-6', en: 'week 5-6' }, name: { ua: 'UI portal · реал-тайм · ролі', en: 'UI portal · real-time · roles' }, pct: 100 },
      { week: { ua: 'тиждень 7-8', en: 'week 7-8' }, name: { ua: 'миграція з Excel · QA · навчання', en: 'Excel migration · QA · training' }, pct: 100 },
    ],
    metrics: [
      { value: '400 год', label: { ua: 'економія/міс', en: 'saved/mo' } },
      { value: '3 → 1', label: { ua: 'систему зведено', en: 'systems unified' } },
      { value: 'real-time', label: { ua: 'tracking замість 24h ETL', en: 'tracking, not 24h ETL' } },
      { value: '87 → 0', label: { ua: 'Excel-файлів', en: 'Excel files' } },
    ],
    before_after: {
      ua: {
        before: '20-40 хв на запит «де вантаж?» · 3 системи · 87 Excel · нічна ETL',
        after: '<3 секунд real-time у порталі · 1 система · ролі за ACL · подієва синхронізація',
      },
      en: {
        before: '20-40 min per "where is shipment?" · 3 systems · 87 Excel · nightly ETL',
        after: '<3 sec real-time in portal · 1 system · role-based ACL · event-driven sync',
      },
    },
    stack: ['Next.js', 'React', 'TypeScript', 'Postgres', 'Prisma', 'Redis pubsub', 'Mapbox', 'NextAuth', 'Vercel'],
    testimonial: {
      ua: 'За три роки ми накопичили шар Excel-файлів, у які боялися полізти. Ілля не просто переніс це в БД — він поговорив з командою і зрозумів, які дані ми насправді використовуємо щодня.',
      en: 'Over three years we built layers of Excel files we were scared to touch. Illia did not just move it into a database — he talked to the team and understood which data we actually use daily.',
      author: 'Andriy V., Head of Operations Trasa',
    },
    related: ['retail-1c-integration', 'lead-qualifier'],
  },

  {
    slug: 'lead-qualifier',
    company: 'nordstream',
    name: { ua: 'Bot-кваліфікатор лідів', en: 'Lead qualifier bot' },
    role: { ua: 'Розробник', en: 'Developer' },
    year: 2024,
    quarter: 'Q4',
    duration: { ua: '2 тижні', en: '2 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: 'Холодні ліди гасли, поки sales-команда передзвонювала. Bot ставить 5 структурованих питань, скорінгує за BANT і автобукить дзвінок у Calendly — 4× швидкість воронки.',
      en: 'Cold leads went cold while sales returned calls. The bot asks 5 structured questions, scores against BANT, and auto-books a Calendly slot — 4× funnel velocity.',
    },
    problem: {
      ua: [
        'Nordstream має стабільний приток холодних лідів через outreach. Sales-команда передзвонювала вручну — від моменту заявки до першого діалогу проходило 4-12 годин. До 35% лідів за цей час «остигало».',
        'Ще проблема — нерелевантні ліди. Сейлзи витрачали години на дзвінки до тих, у кого не було бюджету або повноважень. Не було чіткої системи кваліфікації.',
      ],
      en: [
        'Nordstream has a steady inbound from cold outreach. The sales team called back manually — 4-12 hours from a request to first conversation. Up to 35% of leads went cold in that window.',
        'Another issue: irrelevant leads. Salespeople spent hours calling people with no budget or authority. No clear qualification system.',
      ],
    },
    solution: {
      ua: [
        'Бот у Telegram ставить 5 структурованих питань після заявки: розмір команди, бюджет, поточне рішення, тривалість виборного процесу, час прийняття рішення. Кожна відповідь — натиснення кнопки.',
        'Скорінг за BANT (Budget, Authority, Need, Timeline) — бал від 0 до 100. Тільки ліди >65 автобукяться в Calendly. <65 йдуть у nurture-послідовність.',
        'Sales-команда дзвонить тільки кваліфікованим лідам. Час від заявки до бронювання — 3 хвилини замість 4-12 годин.',
      ],
      en: [
        'A Telegram bot asks 5 structured questions after a request: team size, budget, current solution, decision process length, decision timeline. Each answer is a button tap.',
        'BANT scoring (Budget, Authority, Need, Timeline) — score 0-100. Only leads >65 are auto-booked into Calendly. <65 go into nurture sequence.',
        'Sales only calls qualified leads. Time from request to booking — 3 minutes instead of 4-12 hours.',
      ],
    },
    approach: [
      { week: { ua: 'тиждень 1', en: 'week 1' }, name: { ua: 'BANT-скорінг логіка + Calendly API', en: 'BANT scoring + Calendly API' }, pct: 100 },
      { week: { ua: 'тиждень 2', en: 'week 2' }, name: { ua: 'бот + flow + soft-launch', en: 'bot + flow + soft-launch' }, pct: 100 },
    ],
    metrics: [
      { value: '4.1×', label: { ua: 'швидкість воронки', en: 'funnel velocity' } },
      { value: '−35%', label: { ua: 'cold leakage', en: 'cold leakage' } },
      { value: '+18%', label: { ua: 'conversion qualified→deal', en: 'qualified→deal' } },
    ],
    before_after: {
      ua: {
        before: '4-12 годин до першого діалогу · ручна кваліфікація · 35% cold leakage',
        after: '3 хв від заявки до booking · автоматичний BANT · nurture для <65',
      },
      en: {
        before: '4-12 hours to first conversation · manual qualification · 35% cold leakage',
        after: '3 min from request to booking · automatic BANT · nurture for <65',
      },
    },
    stack: ['Node', 'TypeScript', 'Telegram Bot API', 'Calendly API', 'Airtable', 'Sentry'],
    testimonial: {
      ua: 'Бот-кваліфікатор окупився за 6 тижнів — і це з урахуванням нашого скепсису на старті.',
      en: 'The qualifier bot paid for itself in 6 weeks — and that includes our scepticism going in.',
      author: 'Dmytro B., CMO Nordstream',
    },
    related: ['market-parser', 'ai-support-agent'],
  },

  {
    slug: 'market-parser',
    company: 'nordstream',
    name: { ua: 'Парсер ринкових даних', en: 'Market data parser' },
    role: { ua: 'Розробник', en: 'Developer' },
    year: 2024,
    quarter: 'Q3',
    duration: { ua: '2 тижні', en: '2 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: 'Аналітик витрачав 18 годин/тиждень на ручний збір даних з 12 джерел. Зробив парсер на Playwright + GitHub Actions — 12 хвилин/день, +200% частота звітів.',
      en: 'An analyst spent 18 hours/week manually collecting data from 12 sources. Built a Playwright + GitHub Actions parser — 12 min/day, +200% report frequency.',
    },
    problem: {
      ua: ['Nordstream готує тижневі звіти для клієнтів. Аналітик заходив на 12 сайтів (соцмережі, ринкові дашборди, ціни конкурентів), копіював дані в Google Sheets, форматував — 18 годин/тиждень.'],
      en: ['Nordstream produces weekly client reports. The analyst went to 12 sites (social, market dashboards, competitor prices), copy-pasted data into Sheets, and formatted — 18 hours/week.'],
    },
    solution: {
      ua: ['Playwright-парсер обходить 12 джерел щодня в 8 ранку. Дані пишуться в Google Sheets через API. GitHub Actions виконує і шле звіт у Slack-канал команди. Кожна неділя — автоматичний summary.'],
      en: ['A Playwright parser hits 12 sources daily at 8 AM. Data is written to Google Sheets via the API. GitHub Actions runs it and posts a report to the team Slack. Every Sunday — automatic summary.'],
    },
    approach: [
      { week: { ua: 'тиждень 1-2', en: 'week 1-2' }, name: { ua: 'парсери для 12 джерел + scheduling', en: '12 source parsers + scheduling' }, pct: 100 },
    ],
    metrics: [
      { value: '18h → 12m', label: { ua: 'щоденне завдання', en: 'daily task' } },
      { value: '+200%', label: { ua: 'частота звітів', en: 'report frequency' } },
      { value: '0', label: { ua: 'помилок копіювання', en: 'copy errors' } },
    ],
    before_after: {
      ua: { before: '18 годин/тиждень ручного збору · копіпаст · тижневі звіти', after: '12 хв/день review · щоденні звіти · 0 копіпаст-помилок' },
      en: { before: '18 hours/week manual collection · copy-paste · weekly reports', after: '12 min/day review · daily reports · 0 copy errors' },
    },
    stack: ['Python', 'Playwright', 'GitHub Actions', 'Google Sheets API', 'Slack API'],
    testimonial: {
      ua: 'Простий, але змінив наш робочий цикл — звіти тепер щоденні, без додаткових витрат.',
      en: 'Simple, but it changed our cycle — reports are daily now, with no extra cost.',
      author: 'Yulia P., Analyst Nordstream',
    },
    related: ['lead-qualifier', 'custom-crm-logistics'],
  },

  {
    slug: 'ai-tier1-agent',
    company: 'tably',
    name: { ua: 'AI tier-1 саппорт з пам\'яттю', en: 'AI tier-1 support with memory' },
    role: { ua: 'Lead engineer', en: 'Lead engineer' },
    year: 2025,
    quarter: 'Q1',
    duration: { ua: '5 тижнів', en: '5 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: 'First-response 14 годин, churn на новачках. Зробив tier-1 агента з пам\'яттю про тікети — 92% першої відповіді автоматично, churn − 18%.',
      en: 'First-response 14 hours, churn on new users. Built a tier-1 agent with ticket memory — 92% first-response automated, churn -18%.',
    },
    problem: {
      ua: ['Tably — SaaS для салонів. 8000+ користувачів, ~30 саппорт-тікетів/день. Перший відгук займав 14 годин в середньому. Нові користувачі (перший тиждень) кидали продукт.'],
      en: ['Tably is a SaaS for salons. 8000+ users, ~30 support tickets/day. First response averaged 14 hours. New users (first week) churned out of the product.'],
    },
    solution: {
      ua: ['Tier-1 агент на Claude з RAG-індексом продуктової документації. Памʼятає тікети користувача — повертається до контексту через тиждень. Smart routing — якщо conf <0.7, передає Tier-2 з summary діалогу.'],
      en: ['Tier-1 agent on Claude with a RAG index of product docs. Remembers user tickets — returns to context a week later. Smart routing — if conf <0.7, escalates to Tier-2 with a conversation summary.'],
    },
    approach: [
      { week: { ua: 'тиждень 1-2', en: 'week 1-2' }, name: { ua: 'індекс документації + initial prompt', en: 'docs index + initial prompt' }, pct: 100 },
      { week: { ua: 'тиждень 3', en: 'week 3' }, name: { ua: 'memory + routing logic', en: 'memory + routing' }, pct: 100 },
      { week: { ua: 'тиждень 4-5', en: 'week 4-5' }, name: { ua: 'soft-launch + калібрування + rollout', en: 'soft-launch + calibration + rollout' }, pct: 100 },
    ],
    metrics: [
      { value: '92%', label: { ua: 'auto first response', en: 'auto first response' } },
      { value: '−18%', label: { ua: 'churn новачків', en: 'new-user churn' } },
      { value: '14h → 0', label: { ua: 'response time', en: 'response time' } },
      { value: '2', label: { ua: 'позиції скорочено', en: 'positions reduced' } },
    ],
    before_after: {
      ua: { before: '14h first-response · no memory · new users churned · 4 tier-1 agents', after: 'instant response · memory across tickets · stable churn · 2 tier-2 agents' },
      en: { before: '14h first-response · no memory · new users churned · 4 tier-1 agents', after: 'instant response · memory across tickets · stable churn · 2 tier-2 agents' },
    },
    stack: ['Anthropic Claude', 'Python', 'Pinecone', 'Redis (memory)', 'Intercom API', 'Sentry'],
    testimonial: {
      ua: 'Ми міряли saving у годинах і доларах — кожен з нас тепер економить 4 години на тиждень.',
      en: 'We measured savings in hours and dollars — each of us now saves 4 hours per week.',
      author: 'Maria S., Head of Operations Tably',
    },
    related: ['ai-support-agent', 'lead-qualifier'],
  },

  {
    slug: 'qr-loyalty',
    company: 'brunky',
    name: { ua: 'QR-програма лояльності', en: 'QR loyalty programme' },
    role: { ua: 'Розробник', en: 'Developer' },
    year: 2025,
    quarter: 'Q4',
    duration: { ua: '3 тижні', en: '3 weeks' },
    status: { ua: 'у продакшені', en: 'in production' },
    summary: {
      ua: 'Картки лояльності з QR замість пластикових — додаток у Telegram, без додаткової установки. Реалізував для Brunky після інтеграції з 1С — +24% повторних відвідувань.',
      en: 'QR cards instead of plastic loyalty cards — a Telegram mini-app, no extra install. Built for Brunky after the 1C integration — +24% repeat visits.',
    },
    problem: { ua: ['Brunky видавали пластикові картки лояльності, які гублять і забувають. Конверсія у friends-of-friends низька — клієнти не носили картку.'], en: ['Brunky issued plastic loyalty cards that get lost. Friends-of-friends conversion was low — customers did not carry the card.'] },
    solution: { ua: ['Telegram-mini-app з QR-кодом замість картки. Інтегрується з 1С через REST wrapper (вже існував з попереднього проєкту). Push з нарахуванням бонусів після кожного замовлення.'], en: ['Telegram mini-app with a QR code instead of a card. Integrates with 1C via the existing REST wrapper. Push notifications when bonuses are credited.'] },
    approach: [
      { week: { ua: 'тиждень 1-2', en: 'week 1-2' }, name: { ua: 'mini-app + integration', en: 'mini-app + integration' }, pct: 100 },
      { week: { ua: 'тиждень 3', en: 'week 3' }, name: { ua: 'rollout + 4 точки', en: 'rollout + 4 locations' }, pct: 100 },
    ],
    metrics: [
      { value: '+24%', label: { ua: 'повторні відвідування', en: 'repeat visits' } },
      { value: '12k', label: { ua: 'активних карток', en: 'active cards' } },
      { value: '−$800', label: { ua: 'вартість карток/міс', en: 'card costs/mo' } },
    ],
    before_after: {
      ua: { before: 'пластикові картки · ручне нарахування · $800/міс на друк', after: 'QR в Telegram · автоматичні бонуси · 0 пластик' },
      en: { before: 'plastic cards · manual credit · $800/mo printing', after: 'QR in Telegram · automatic bonuses · 0 plastic' },
    },
    stack: ['Next.js', 'Telegram Mini-App SDK', 'Postgres', '1C wrapper (reused)', 'Vercel'],
    testimonial: { ua: 'Після інтеграції з 1С QR-картки були логічним наступним кроком. Тиждень — і ми вже бачимо ріст повторних замовлень.', en: 'After the 1C integration, QR cards were the obvious next step. A week in and we already see growth in repeat orders.', author: 'Olena B., COO Brunky' },
    related: ['retail-1c-integration'],
  },
];

// Quick lookup helpers
window.WF_LOOKUPS = {
  companyBySlug: (slug) => window.WF_COMPANIES.find((c) => c.slug === slug),
  projectBySlug: (slug) => window.WF_PROJECTS.find((p) => p.slug === slug),
  projectsForCompany: (slug) => window.WF_PROJECTS.filter((p) => p.company === slug),
};
