// landing-pages.js — content for the new public-site surfaces:
// Blog (G2), Pricing + Legal (G3). UA primary, EN where it reads naturally.
// Picked with the same `obj[lang] || obj.ua` convention as WF_CONTENT.

window.WF_BLOG = {
  // Listing tags (filter chips)
  tags: ['усі', 'automation', 'ai-agents', 'integrations', 'process', 'telegram'],

  posts: [
    {
      slug: 'excel-to-crm-without-pain',
      featured: true,
      date: '2026-05-18',
      reading: { ua: '8 хв', en: '8 min' },
      tags: ['process', 'automation'],
      title: {
        ua: 'Як вибратись з Excel у CRM і нічого не зламати',
        en: 'Moving off Excel into a CRM without breaking everything',
      },
      excerpt: {
        ua: 'Команда виросла, таблиця на 14 вкладок тріщить по швах. Розбираю покроковий шлях міграції без зупинки роботи — від аудиту полів до паралельного запуску.',
        en: 'The team grew and the 14-tab sheet is bursting. A step-by-step migration path with zero downtime — from field audit to parallel run.',
      },
      // Long-read body — array of typed blocks
      body: {
        ua: [
          { t: 'p', v: 'Excel не ворог. Він чесно тримав ваш бізнес перші роки — і це нормально. Проблема починається, коли таблицю одночасно редагують пʼятеро, формули посилаються на видалені рядки, а «єдине джерело правди» існує у трьох версіях у різних чатах.' },
          { t: 'h2', v: 'коли саме час мігрувати' },
          { t: 'p', v: 'Не тоді, коли «таблиця незручна», а коли помилки в ній починають коштувати грошей: загублене замовлення, подвійна оплата, забутий дедлайн. Якщо це стається раз на тиждень — рахунок уже виставлений, просто ви його ще не бачите.' },
          { t: 'ul', v: ['5+ людей редагують одну таблицю щодня', 'є процеси, які повторюються 1-в-1 (онбординг, рахунок, нагадування)', 'дані потрібні на телефоні, а не лише на ноуті', 'ви боїтесь видалити «той самий рядок»'] },
          { t: 'callout', k: 'правило', v: 'Міграція — це не «перенести таблицю в нову програму». Це нагода викинути 30% полів, якими ви не користуєтесь, і назвати решту по-людськи.' },
          { t: 'h2', v: 'крок 1 — аудит полів' },
          { t: 'p', v: 'Виписуємо КОЖНУ колонку і питаємо: хто це заповнює, хто читає, що зламається якщо її прибрати. Половина відповідей буде «не памʼятаю». Це і є кандидати на викидання.' },
          { t: 'code', lang: 'bash', v: '$ wc -l orders.csv\n  2417 orders.csv\n$ # 2417 рядків · 38 колонок · 14 реально потрібних' },
          { t: 'h2', v: 'крок 2 — паралельний запуск' },
          { t: 'p', v: 'Найбезпечніший спосіб — два тижні CRM і Excel працюють разом. Дані пишуться в обидва місця (це автоматизується), команда звикає, а ви звіряєте розбіжності. Жодного «з понеділка всі в новій системі» — так втрачають дані й довіру.' },
          { t: 'quote', v: 'Перенесли 4 роки замовлень за вихідні. У понеділок ніхто навіть не помітив, що Excel більше немає — і це найкращий комплімент.', author: 'Олена · Brunky' },
          { t: 'h2', v: 'що в підсумку' },
          { t: 'p', v: 'CRM не робить команду продуктивнішою сама по собі. Її робить такою прибрана структура даних і автоматизовані рутини поверх. Excel був тренуванням — тепер ви точно знаєте, які поля вам справді потрібні.' },
        ],
        en: [
          { t: 'p', v: 'Excel is not the enemy. It honestly held your business together for the first few years. The trouble starts when five people edit it at once, formulas point at deleted rows, and the “single source of truth” lives in three versions across different chats.' },
          { t: 'h2', v: 'when it is actually time' },
          { t: 'p', v: 'Not when “the sheet is annoying”, but when its mistakes start costing money: a lost order, a double payment, a missed deadline. If that happens weekly, the invoice is already issued — you just have not seen it yet.' },
          { t: 'ul', v: ['5+ people edit one sheet daily', 'repeatable 1-to-1 processes exist (onboarding, invoice, reminder)', 'you need data on the phone, not only the laptop', 'you are scared to delete “that one row”'] },
          { t: 'callout', k: 'rule', v: 'Migration is not “move the sheet into new software”. It is the chance to drop 30% of fields you never use and name the rest like a human.' },
          { t: 'h2', v: 'step 1 — field audit' },
          { t: 'p', v: 'List EVERY column and ask: who fills it, who reads it, what breaks if it is gone. Half the answers will be “don’t remember”. Those are your deletion candidates.' },
          { t: 'code', lang: 'bash', v: '$ wc -l orders.csv\n  2417 orders.csv\n$ # 2417 rows · 38 cols · 14 actually needed' },
          { t: 'h2', v: 'step 2 — parallel run' },
          { t: 'p', v: 'The safest path: two weeks of CRM and Excel running together. Data is written to both (this is automated), the team adapts, and you reconcile differences. No “everyone on the new system from Monday” — that is how you lose data and trust.' },
          { t: 'quote', v: 'We moved 4 years of orders over a weekend. On Monday nobody even noticed Excel was gone — and that is the best compliment.', author: 'Olena · Brunky' },
          { t: 'h2', v: 'the takeaway' },
          { t: 'p', v: 'A CRM does not make a team more productive on its own. Clean data structure and automated routines on top of it do. Excel was the training — now you know exactly which fields you truly need.' },
        ],
      },
      related: ['telegram-bot-for-drivers', 'ai-agent-first-line-support'],
    },
    {
      slug: 'telegram-bot-for-drivers',
      date: '2026-04-30',
      reading: { ua: '6 хв', en: '6 min' },
      tags: ['telegram', 'automation'],
      title: { ua: 'Telegram-бот для водіїв замість дзвінків диспетчера', en: 'A Telegram bot for drivers instead of dispatcher calls' },
      excerpt: { ua: 'Диспетчер витрачав 4 години на день на дзвінки «де ти / прийняв / здав». Бот забрав цю рутину і повернув дані в 1С самі.', en: 'The dispatcher spent 4 hours a day on “where are you / accepted / delivered” calls. The bot took the routine and pushed data back into 1C by itself.' },
      related: ['excel-to-crm-without-pain'],
    },
    {
      slug: 'ai-agent-first-line-support',
      date: '2026-04-12',
      reading: { ua: '7 хв', en: '7 min' },
      tags: ['ai-agents', 'process'],
      title: { ua: 'AI-агент на першій лінії підтримки: що працює, а що ні', en: 'An AI agent on first-line support: what works and what doesn’t' },
      excerpt: { ua: 'Агент закриває 60% звернень без людини. Розповідаю, де він блищить, а де його треба тримати на короткому повідку.', en: 'The agent closes 60% of tickets without a human. Where it shines, and where you keep it on a short leash.' },
      related: ['excel-to-crm-without-pain'],
    },
    {
      slug: 'integrations-that-dont-break',
      date: '2026-03-20',
      reading: { ua: '5 хв', en: '5 min' },
      tags: ['integrations'],
      title: { ua: 'Інтеграції, які не падають о третій ночі', en: 'Integrations that don’t fall over at 3am' },
      excerpt: { ua: 'Idempotency, черги, retry з backoff і людський алерт. Нудні слова, через які ви спите спокійно.', en: 'Idempotency, queues, retry with backoff and a human alert. Boring words that let you sleep.' },
      related: ['telegram-bot-for-drivers'],
    },
    {
      slug: 'automate-the-right-thing',
      date: '2026-02-28',
      reading: { ua: '4 хв', en: '4 min' },
      tags: ['process', 'automation'],
      title: { ua: 'Автоматизуйте правильну річ, а не першу-ліпшу', en: 'Automate the right thing, not the first thing' },
      excerpt: { ua: 'Найдорожча автоматизація — та, що ідеально робить непотрібний процес. Як знайти, що варто чіпати.', en: 'The most expensive automation is the one that perfectly does a useless process. How to find what’s worth touching.' },
      related: ['ai-agent-first-line-support'],
    },
  ],
};

window.WF_PRICING = {
  note: { ua: 'Ціни орієнтовні · фінальна — після discovery-дзвінка. Без ПДВ (ФОП 3 гр).', en: 'Indicative pricing · final after a discovery call. VAT-free (sole proprietor).' },
  rates: { usd: '$', uah: '₴' },
  fx: 41.5, // ₴ per $ for the toggle
  tiers: [
    {
      id: 'fixed',
      name: { ua: 'Проєкт під ключ', en: 'Fixed project' },
      tagline: { ua: 'Чіткий скоуп → фіксована ціна', en: 'Clear scope → fixed price' },
      priceUsd: 'від 1 500',
      unit: { ua: '/ проєкт', en: '/ project' },
      cta: { ua: 'Обговорити проєкт', en: 'Discuss a project' },
      featured: false,
      features: {
        ua: ['Discovery + специфікація', 'Фіксований кошторис і дедлайн', 'Демо щотижня', '30 днів підтримки після здачі', 'Весь код і доступи — ваші'],
        en: ['Discovery + specification', 'Fixed estimate and deadline', 'Weekly demo', '30 days post-launch support', 'All code and access are yours'],
      },
    },
    {
      id: 'hourly',
      name: { ua: 'Погодинно', en: 'Hourly' },
      tagline: { ua: 'Гнучкий скоуп, рух ітераціями', en: 'Flexible scope, move in iterations' },
      priceUsd: '35–55',
      unit: { ua: '/ година', en: '/ hour' },
      cta: { ua: 'Почати з пілота', en: 'Start with a pilot' },
      featured: true,
      features: {
        ua: ['Прозорий тайм-лог у порталі', 'Рахунок раз на 2 тижні', 'Пріоритети змінюються будь-коли', 'Без мінімального обсягу', 'Видимість кожної години роботи'],
        en: ['Transparent time-log in the portal', 'Invoice every 2 weeks', 'Priorities change anytime', 'No minimum commitment', 'Visibility into every hour'],
      },
    },
    {
      id: 'recurring',
      name: { ua: 'Підписка / supabase', en: 'Retainer' },
      tagline: { ua: 'Постійний партнер на автоматизацію', en: 'A standing automation partner' },
      priceUsd: 'від 600',
      unit: { ua: '/ місяць', en: '/ month' },
      cta: { ua: 'Запросити деталі', en: 'Request details' },
      featured: false,
      features: {
        ua: ['Виділені години щомісяця', 'Моніторинг і підтримка інтеграцій', 'Пріоритетна черга задач', 'Квартальний звіт і roadmap', 'Знижка за рік наперед'],
        en: ['Dedicated hours each month', 'Monitoring + integration support', 'Priority task queue', 'Quarterly report and roadmap', 'Discount for annual prepay'],
      },
    },
  ],
  compare: {
    cols: { ua: ['Проєкт', 'Погодинно', 'Підписка'], en: ['Fixed', 'Hourly', 'Retainer'] },
    rows: {
      ua: [
        ['Підходить коли', 'скоуп відомий', 'скоуп змінюється', 'потрібен постійний'],
        ['Білінг', 'етапами', 'раз на 2 тижні', 'щомісяця'],
        ['Зміна пріоритетів', 'через зміну скоупу', 'будь-коли', 'будь-коли'],
        ['Підтримка', '30 днів', 'погодинно', 'включена'],
        ['Звітність', 'по етапах', 'тайм-лог', 'квартальний звіт'],
      ],
      en: [
        ['Best when', 'scope is known', 'scope shifts', 'you need it ongoing'],
        ['Billing', 'by milestone', 'every 2 weeks', 'monthly'],
        ['Priority change', 'via scope change', 'anytime', 'anytime'],
        ['Support', '30 days', 'hourly', 'included'],
        ['Reporting', 'per milestone', 'time-log', 'quarterly report'],
      ],
    },
  },
  faq: {
    ua: [
      ['Як рахується фінальна ціна?', 'Після discovery-дзвінка фіксуємо скоуп і я даю кошторис. Для погодинної моделі — оцінка діапазону годин наперед.'],
      ['Чи можна почати з малого?', 'Так — більшість починає з пілота на 10–20 годин, щоб перевірити підхід без великого бюджету.'],
      ['Кому належить код?', 'Вам. Весь код, доступи й документація передаються повністю. Жодного vendor lock-in.'],
      ['Працюєте з нашими підрядниками?', 'Так. Можу інтегруватись у вашу команду або вести проєкт самостійно — як зручніше.'],
      ['Що з оплатою?', 'ФОП 3 група, без ПДВ. Рахунок у USD з конвертацією в ₴ за курсом НБУ. USDT теж можливо.'],
      ['А якщо щось зламається після здачі?', 'Фіксовані проєкти мають 30 днів підтримки. Далі — погодинно або підписка.'],
    ],
    en: [
      ['How is the final price set?', 'After a discovery call we fix the scope and I give an estimate. For hourly, I estimate the hour range up front.'],
      ['Can we start small?', 'Yes — most start with a 10–20 hour pilot to test the approach without a big budget.'],
      ['Who owns the code?', 'You do. All code, access and docs are fully handed over. No vendor lock-in.'],
      ['Do you work with our contractors?', 'Yes. I can plug into your team or run the project solo — whatever fits.'],
      ['What about payments?', 'Sole proprietor, VAT-free. Invoice in USD converted to UAH at the NBU rate. USDT works too.'],
      ['What if something breaks after launch?', 'Fixed projects include 30 days of support. After that — hourly or a retainer.'],
    ],
  },
};

window.WF_LEGAL = {
  terms: {
    title: { ua: 'Умови надання послуг', en: 'Terms of Service' },
    updated: { ua: 'Оновлено 29 травня 2026', en: 'Updated May 29, 2026' },
    intro: {
      ua: 'Ці умови регулюють співпрацю між виконавцем (ФОП, далі — «Виконавець») та замовником щодо послуг автоматизації, розробки та інтеграцій, що надаються через workflo.space.',
      en: 'These terms govern the engagement between the contractor (sole proprietor, “Contractor”) and the client regarding automation, development and integration services delivered via workflo.space.',
    },
    sections: {
      ua: [
        ['Предмет договору', 'Виконавець надає послуги з проєктування, розробки та підтримки програмних рішень згідно зі специфікацією, погодженою сторонами для кожного замовлення окремо.'],
        ['Порядок робіт', 'Роботи виконуються етапами. Кожен етап фіксується у специфікації та підтверджується замовником у порталі до початку наступного.'],
        ['Вартість і оплата', 'Вартість визначається моделлю співпраці (фіксована / погодинна / підписка). Рахунок виставляється у USD з еквівалентом у ₴ за курсом НБУ. Оплата — протягом 7 днів з дати рахунку.'],
        ['Права на результат', 'Після повної оплати всі майнові права на створений код, документацію та доступи переходять до замовника. Виконавець не зберігає копій конфіденційних даних після завершення.'],
        ['Конфіденційність', 'Сторони зобовʼязуються не розголошувати комерційну інформацію, отриману під час співпраці. Доступи зберігаються у захищеному сейфі та відкликаються після здачі.'],
        ['Гарантія і підтримка', 'Для фіксованих проєктів діє 30 днів гарантійної підтримки виправлень. Подальша підтримка — за окремою домовленістю.'],
        ['Відповідальність', 'Виконавець не несе відповідальності за збитки, спричинені сторонніми сервісами, змінами в API третіх сторін або діями замовника поза погодженим скоупом.'],
        ['Припинення', 'Будь-яка сторона може припинити співпрацю, письмово попередивши за 14 днів. Оплачуються фактично виконані роботи.'],
      ],
      en: [
        ['Subject', 'The Contractor provides design, development and support of software solutions per a specification agreed by the parties for each order.'],
        ['Workflow', 'Work proceeds in stages. Each stage is fixed in a specification and confirmed by the client in the portal before the next begins.'],
        ['Pricing and payment', 'Pricing follows the engagement model (fixed / hourly / retainer). Invoices are issued in USD with a UAH equivalent at the NBU rate. Payment is due within 7 days.'],
        ['Ownership', 'Upon full payment, all proprietary rights to the created code, documentation and access pass to the client. The Contractor keeps no copies of confidential data afterwards.'],
        ['Confidentiality', 'The parties agree not to disclose commercial information obtained during the engagement. Credentials are stored in a secure vault and revoked after delivery.'],
        ['Warranty and support', 'Fixed projects include 30 days of warranty fixes. Further support is by separate agreement.'],
        ['Liability', 'The Contractor is not liable for damage caused by third-party services, third-party API changes, or client actions outside the agreed scope.'],
        ['Termination', 'Either party may terminate with 14 days’ written notice. Work actually performed is payable.'],
      ],
    },
  },
  privacy: {
    title: { ua: 'Політика конфіденційності', en: 'Privacy Policy' },
    updated: { ua: 'Оновлено 29 травня 2026', en: 'Updated May 29, 2026' },
    intro: {
      ua: 'Ми поважаємо вашу приватність. Ця політика пояснює, які дані збирає workflo.space, навіщо та як вони захищені.',
      en: 'We respect your privacy. This policy explains what data workflo.space collects, why, and how it is protected.',
    },
    sections: {
      ua: [
        ['Які дані ми збираємо', 'Контактні дані (імʼя, email, телефон), реквізити компанії для документів, дані замовлень і повідомлень у порталі. Технічні логи доступу для безпеки.'],
        ['Навіщо', 'Для надання послуг, виставлення документів, комунікації та виконання правових зобовʼязань. Ми не продаємо й не передаємо дані третім сторонам для маркетингу.'],
        ['Зберігання і захист', 'Доступи зберігаються у зашифрованому сейфі з масками й логом доступу. Резервні копії — у захищеному хмарному сховищі. Дані видаляються на запит після завершення співпраці.'],
        ['Файли cookie', 'Використовуємо лише функційні cookie для сесії порталу. Без рекламних трекерів.'],
        ['Ваші права', 'Ви можете запросити доступ, виправлення або видалення своїх даних у будь-який момент, написавши на контактний email.'],
        ['Сторонні сервіси', 'Деякі функції покладаються на сторонні сервіси (хостинг, email-розсилки, Telegram). Кожен обробляє дані за власною політикою.'],
        ['Зміни політики', 'Ми можемо оновлювати цю політику. Дата оновлення вказана згори; суттєві зміни анонсуються в порталі.'],
      ],
      en: [
        ['What we collect', 'Contact details (name, email, phone), company details for documents, order and message data in the portal. Technical access logs for security.'],
        ['Why', 'To deliver services, issue documents, communicate and meet legal obligations. We do not sell or share data with third parties for marketing.'],
        ['Storage and protection', 'Credentials are stored in an encrypted vault with masks and an access log. Backups live in secure cloud storage. Data is deleted on request after the engagement ends.'],
        ['Cookies', 'We use only functional cookies for the portal session. No advertising trackers.'],
        ['Your rights', 'You may request access, correction or deletion of your data at any time via the contact email.'],
        ['Third parties', 'Some features rely on third-party services (hosting, email, Telegram). Each processes data under its own policy.'],
        ['Policy changes', 'We may update this policy. The update date is shown above; material changes are announced in the portal.'],
      ],
    },
  },

  cookies: {
    title: { ua: 'Політика cookie', en: 'Cookie Policy' },
    updated: { ua: 'Оновлено 29 травня 2026', en: 'Updated May 29, 2026' },
    intro: {
      ua: 'Коротко й чесно: ми не використовуємо рекламних трекерів. Лише те, без чого портал не працюватиме.',
      en: 'Short and honest: we use no advertising trackers. Only what the portal needs to work.',
    },
    sections: {
      ua: [
        ['Що таке cookie', 'Невеликі файли, які сайт зберігає у вашому браузері. Ми використовуємо їх мінімально й тільки функційно.'],
        ['Функційні cookie', 'Тримають вашу сесію в порталі (щоб не логінитись щоразу), памʼятають вибір мови та теми (світла/темна). Без них вхід неможливий.'],
        ['Аналітика', 'Базова, знеособлена статистика відвідувань лендінгу — без профілювання й без передачі рекламним мережам. На лендінгу можна відмовитись.'],
        ['Чого ми НЕ робимо', 'Не ставимо рекламних пікселів, не продаємо дані, не відстежуємо вас по інших сайтах. Жодних Meta/Google Ads трекерів.'],
        ['Керування', 'Функційні cookie можна вимкнути в налаштуваннях браузера, але тоді портал перестане памʼятати вхід. Аналітику можна відключити банером.'],
        ['Питання', 'Будь-що щодо cookie — напишіть на контактний email, відповімо людською мовою.'],
      ],
      en: [
        ['What cookies are', 'Small files a site stores in your browser. We use them minimally and only functionally.'],
        ['Functional cookies', 'Keep your portal session (so you don’t log in every time), remember language and theme (light/dark). Login is impossible without them.'],
        ['Analytics', 'Basic, anonymised landing-page visit stats — no profiling, nothing shared with ad networks. You can opt out on the landing.'],
        ['What we do NOT do', 'No ad pixels, no selling data, no cross-site tracking. No Meta/Google Ads trackers.'],
        ['Control', 'You can disable functional cookies in your browser, but the portal will stop remembering your login. Analytics can be turned off via the banner.'],
        ['Questions', 'Anything about cookies — email us, we’ll answer in plain language.'],
      ],
    },
  },
};
window.WF_CASES = {
  cases: [
    {
      slug: 'brunky-crm-1c',
      client: 'Brunky',
      industry: 'food',
      tier: 'partner',
      tags: ['crm', '1c', 'automation'],
      title: {
        ua: 'CRM + 1С за 3 тижні замість 3 місяців',
        en: 'CRM + 1C in 3 weeks instead of 3 months',
      },
      lead: {
        ua: 'Команда з 14 людей жила в Excel-таблиці на 38 колонок. Зробили єдину CRM, інтегровану з 1С, без зупинки роботи — і прибрали 40% ручної рутини.',
        en: 'A 14-person team lived in a 38-column Excel sheet. We built one CRM integrated with 1C, with zero downtime — and cut 40% of manual routine.',
      },
      metrics: {
        ua: [
          { v: '−40%', k: 'ручної роботи' },
          { v: '3 тижні', k: 'від старту до запуску' },
          { v: '2 417', k: 'замовлень мігровано' },
          { v: '0', k: 'годин простою' },
        ],
        en: [
          { v: '−40%', k: 'manual work' },
          { v: '3 weeks', k: 'start to launch' },
          { v: '2,417', k: 'orders migrated' },
          { v: '0', k: 'downtime hours' },
        ],
      },
      facts: {
        ua: [
          ['Галузь', 'Food & HoReCa'],
          ['Команда', '14 людей'],
          ['Стек', '1С 8.3 БП · REST · Telegram'],
          ['Модель', 'Fixed · 2 етапи'],
        ],
        en: [
          ['Industry', 'Food & HoReCa'],
          ['Team', '14 people'],
          ['Stack', '1C 8.3 · REST · Telegram'],
          ['Model', 'Fixed · 2 stages'],
        ],
      },
      body: {
        ua: [
          { t: 'h2', v: 'задача' },
          { t: 'p', v: 'Brunky росли швидше за свої процеси. Замовлення, залишки й оплати жили в одній Excel-таблиці, яку одночасно редагували пʼятеро. Кожен тиждень — загублене замовлення або подвійна оплата. Потрібна була **єдина система**, яка дружить з їхньою 1С і не вимагає переучувати всю команду.' },
          { t: 'h2', v: 'що зробили' },
          { t: 'ul', v: ['Аудит 38 колонок → лишили 14, які реально працюють', 'CRM з воронками під їхній процес продажу', 'Двостороння інтеграція з 1С 8.3 БП через REST', 'Telegram-сповіщення для менеджерів', 'Паралельний запуск 2 тижні — CRM і Excel разом'] },
          { t: 'callout', k: 'ключове', v: 'Жодного «з понеділка всі в новій системі». Два тижні дані писались в обидва місця — команда звикала без стресу, ми звіряли розбіжності.' },
          { t: 'h2', v: 'результат' },
          { t: 'p', v: 'Через 3 тижні Excel зник — і ніхто цього не помітив, бо все вже працювало в CRM. Менеджери перестали вручну переносити дані між таблицею й 1С: тепер це робить інтеграція. Звільнилось приблизно **40% часу**, який раніше йшов на рутину.' },
          { t: 'quote', v: 'Перенесли 4 роки замовлень за вихідні. У понеділок ніхто навіть не помітив, що Excel більше немає — і це найкращий комплімент.', author: 'Олена · Brunky' },
        ],
        en: [
          { t: 'h2', v: 'the problem' },
          { t: 'p', v: 'Brunky grew faster than their processes. Orders, stock and payments lived in one Excel sheet edited by five people at once. Every week — a lost order or a double payment. They needed **one system** that talks to their 1C and does not force the whole team to relearn everything.' },
          { t: 'h2', v: 'what we did' },
          { t: 'ul', v: ['Audited 38 columns → kept the 14 that actually work', 'A CRM with pipelines matching their sales process', 'Two-way 1C 8.3 integration over REST', 'Telegram notifications for managers', 'Two-week parallel run — CRM and Excel together'] },
          { t: 'callout', k: 'key', v: 'No “everyone on the new system from Monday”. For two weeks data was written to both — the team adapted stress-free while we reconciled differences.' },
          { t: 'h2', v: 'the result' },
          { t: 'p', v: 'After 3 weeks Excel was gone — and nobody noticed, because everything already ran in the CRM. Managers stopped moving data between the sheet and 1C by hand: the integration does it. About **40% of time** previously lost to routine was freed up.' },
          { t: 'quote', v: 'We moved 4 years of orders over a weekend. On Monday nobody even noticed Excel was gone — the best compliment.', author: 'Olena · Brunky' },
        ],
      },
      related: ['nordstream-track'],
    },
    {
      slug: 'nordstream-track',
      client: 'NordStream Logistics',
      industry: 'logistics',
      tier: 'silver',
      tags: ['integrations', 'realtime'],
      title: {
        ua: 'Трекінг 200+ вантажів у реальному часі',
        en: 'Real-time tracking for 200+ shipments',
      },
      lead: {
        ua: 'Диспетчери дзвонили водіям, щоб дізнатись «де вантаж». Підняли real-time карту з API трекінгу — і дзвінки зникли.',
        en: 'Dispatchers called drivers to ask “where is the cargo”. We built a real-time map from the tracking API — and the calls stopped.',
      },
      metrics: {
        ua: [
          { v: '200+', k: 'авто на карті' },
          { v: '−70%', k: 'дзвінків водіям' },
          { v: '15 с', k: 'оновлення позиції' },
        ],
        en: [
          { v: '200+', k: 'vehicles on map' },
          { v: '−70%', k: 'calls to drivers' },
          { v: '15 s', k: 'position refresh' },
        ],
      },
      facts: {
        ua: [
          ['Галузь', 'Логістика'],
          ['Стек', 'WMS API · WebSocket'],
          ['Модель', 'Погодинна'],
        ],
        en: [
          ['Industry', 'Logistics'],
          ['Stack', 'WMS API · WebSocket'],
          ['Model', 'Hourly'],
        ],
      },
      body: {
        ua: [
          { t: 'h2', v: 'задача' },
          { t: 'p', v: 'Щоб дізнатись статус вантажу, диспетчер дзвонив водієві. На 200 машин це сотні дзвінків щодня й нуль історичних даних.' },
          { t: 'h2', v: 'результат' },
          { t: 'p', v: 'Real-time карта з позицією кожного авто, оновлення кожні 15 секунд. Дзвінки «де ти?» впали на **70%**.' },
        ],
        en: [
          { t: 'h2', v: 'the problem' },
          { t: 'p', v: 'To learn a shipment status, a dispatcher called the driver. For 200 trucks that is hundreds of daily calls and zero history.' },
          { t: 'h2', v: 'the result' },
          { t: 'p', v: 'A real-time map with each vehicle position, refreshing every 15 seconds. “Where are you?” calls dropped **70%**.' },
        ],
      },
      related: ['brunky-crm-1c'],
    },
  ],
};

