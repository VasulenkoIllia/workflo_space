# 🧭 ROADMAP — операційний пульт workflo.space

> **Єдине місце, яке відкриваєш щодня.** Що в роботі, що далі, у якому порядку. Кожен зріз їде по
> **Definition of Done** ([`ENGINEERING_STANDARDS.md` §8](ENGINEERING_STANDARDS.md)). Стан коду —
> істина в [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md); це — **черга дій**.
> _Звірено з кодом: 2026-07-04 (аудит r4 + drift-звірка беклогу — прибрано 3 «привиди»: notify-feed, Sentry, `/ready`)._

## 🗺️ Карта доків (щоб не плутатися, який відкривати)

| Док                                                       | Питання, на яке відповідає                | Коли відкривати                  |
| --------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| **ROADMAP.md** (цей)                                      | _Що робити далі?_                         | щодня — береш верхній зріз черги |
| [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md)                | _Що **реально** збудовано?_ (пер-екранно) | коли сумніваєшся в стані         |
| [`DESIGN_PHASE2_PLAN.md`](DESIGN_PHASE2_PLAN.md)          | _Повний беклог зрізів_                    | коли черга вичерпалась           |
| `design-v2/`                                              | _Як має виглядати?_ (візуальна ціль)      | на кроці conformance             |
| [`docs/modules/`](modules/)                               | _Який намір модуля?_ (спека)              | на кроці «бекенд спершу»         |
| [`ENGINEERING_STANDARDS.md` §8](ENGINEERING_STANDARDS.md) | _Як саме будуємо?_ (DoD)                  | на кожному зрізі                 |

## Як користуватися

- Береш **верхній** зріз із «Черги» → ведеш по DoD (§8) → мерджиш → оновлюєш рядок у `DESIGN_COVERAGE.md` → береш наступний.
- **Один вертикальний зріз у роботі за раз.** Не будуй вшир (багато напівекранів = плутанина).
- Готове → у «Готово нещодавно» (щоб не брати вдруге). Нове знайшов → у «Беклог», не в роботу одразу.

---

## 🧪 ПЕРЕД ТЕСТУВАННЯМ — стан і на що звернути увагу (2026-07-01)

> Після великої Фаза-B сесії (28 зрізів) + наскрізного 3-агентного аудиту
> ([`AUDIT_2026-07.md`](AUDIT_2026-07.md), 0 crit/high, усі знахідки виправлені). **Гілка `dev`
> зелена; CI деплоїть на `dev-*.workflo.space`.** Це чек-лист власнику на ручний прохід.

**🔧 ПЕРЕД НАСТУПНИМ ДЕПЛОЄМ — оновити server `.env` (інфра-зріз 02.07). Повний ранбук з командами: [`SERVER_UPDATE_2026-07.md`](SERVER_UPDATE_2026-07.md):**

- `SEED_OWNER_PASSWORD` (+`SEED_EXECUTOR_PASSWORD`, `SEED_CLIENT_PASSWORD`) у staging `.env` —
  сід тепер **відмовляється** сіяти дефолтний `Admin123!` на NODE_ENV=production (fail-closed;
  крок non-fatal — деплой пройде, але акаунти не засіються). Наявним акаунтам сід пароль
  НЕ перезаписує — за потреби змінити вручну.
- `CREDENTIALS_KEK_BASE64_STAGING` / `_PROD` — інакше vault 503.
- `TEAM_IPS` тепер гейтить і **dev-api + dev-portal** (не лише workspace); `/health` лишився
  публічним для CI-verify. Якщо тестуєш з нового IP — додай його в `TEAM_IPS`.
- RLS-флip (коли настане час, staging-соак першим): `DATABASE_APP_URL_STAGING` + `RLS_ENFORCED_STAGING=true`.

**✅ Готове до тесту (backend+UI, на staging):**

- **Картка клієнта 360°** `/clients/:id` — таби Огляд(стати+замовлення+«потребує уваги») · Люди
  (ростер + owner: **запросити** email-інвайтом / **скинути пароль** / роль / видалити) ·
  Проєкти · Фінанси(лояльність+override / маржа YTD) · Документи(PDF) · **Секрети** (owner:
  зашифрований vault — додати/показати/відкликати/видалити) · Реквізити(read + agency
  edit-on-behalf). Manager бачить лише Огляд. _Тест: у клієнта з ≥1 користувачем — «Запросити
  учасника» → лист-інвайт на портал; прийняти інвайт → зʼявляється в ростері як «учасник».
  «Скинути пароль» → користувач отримує лист скидання (сам задає новий, агенція його не бачить).
  «Секрети» → додати секрет → «показати» (розшифровує, авто-ховається 20с) → відкликати/видалити.
  ⚠️ потребує `CREDENTIALS_KEK_BASE64_STAGING` у server `.env` (compose прокидає в контейнер; 02.07) (`openssl rand -base64 32`), інакше reveal 503._
- **Таймер часу (T2)** — глобальний floating-bar (live HH:MM:SS, «Стоп») + «Засікти час» у
  замовленні (таб «Час»); 1 активний на виконавця; авто-стоп 8год. _Тест: старт на A, старт на
  B (A авто-стопиться), стоп — час пишеться; перевір дату логу (бізнес-день Києва)._
- **Звіти** `/reports` (owner) — план-факт годин: оцінка vs факт по замовленнях + завантаження
  по виконавцях (норма редагується в `/team`, дефолт 40 год/тиж) + CSV.
- **Глобальна «Дошка задач»** `/board` — задачі всіх замовлень, DnD між колонками, фільтр «мої».
- **Ліди** `/leads` (owner/manager) — канбан 6 стадій, DnD, «+ Лід», **конвертація → замовлення**
  (drag у «Виграно» = відкриває конвертацію). _Тест: створити → перетягти стадіями → конвертувати
  на компанію → перевір, що зʼявилось замовлення._
- **Портал клієнта** — `/projects` (умови співпраці read-only); грейсфул empty-state, якщо
  акаунт без компанії (більше не червона 500).
- **Лендінг** — homepage + /services /about /contact /blog /cases + SEO (canonical/OG/sitemap).

**⚠️ На що звернути увагу (свідомі межі, НЕ баги):**

- **Лендінг — UA лише; EN-i18n + структуру відкладено** (рішення власника — переклади/структура
  зміняться). Не тестувати EN.
- **Нові екрани — субсети дизайну** (деталі в [`AUDIT_2026-07.md`](AUDIT_2026-07.md) §Дизайн):
  Leads без detail-сторінки/пайплайн-редактора/UTM/% конверсії; Reports без 4-рівневого розрізу;
  дошка без per-team-boards. Це by-design, не дефекти.
- **Vault/Секрети (модуль 17) — MVP збудовано** (agency-side): картка 360° таб «Секрети» +
  глобальний екран `/vault` (owner-only, усі клієнти, фільтри клієнт/сервіс/пошук). CRUD +
  reveal, envelope AES-256-GCM (KEK у env). **Reveal вимагає step-up повторним паролем** (grant
  5хв, спільний для обох екранів) + **журнал доступів** на кожному секреті. Відкладено: executor
  scoped-share, нагадування про ротацію, portal self-service, типізовані шаблони, журнал клієнту.
  **Reveal/create деградують до 503 без `CREDENTIALS_KEK_BASE64`.** _Тест: «показати» → модалка
  пароля → секрет (авто-hide 20с); повторний показ у межах 5хв — без пароля; «журнал» показує
  хто/коли відкривав._
- **Фронт перевірявся type-check/lint/build** (фронт-тести не пишемо за рішенням власника) —
  ручний прохід вживу потрібен саме тут.
- **Багато екранів backend-blocked** (documents-EU-PDF, calendar, support, in-app-нотиф-feed
  rich) — заглушки by-design; вести [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md) на проході.

**📌 Що варто доробити далі (черга після тесту):**

1. **Лендінг EN-i18n + рестрктуризація** (коли визначиш фінальні тексти/структуру) → Lighthouse≥90.
2. **Leads-добудова** — ✅ lead-detail, ✅ lost-reason при drag, ✅ % конверсії, ✅ **UTM з contact-форми** (05.07), ✅ **activity-timeline** (05.07); лишок: пайплайн-редактор (custom-стадії — окремий зріз зі схемою).
3. **Vault/Секрети (модуль 17)** — ✅ agency-side MVP + ✅ глобальний список (17-ГЛОБАЛ) + ✅ журнал доступів owner-facing (17-Б) + ✅ **2FA на reveal** (step-up повторним паролем, grant 5хв) + ✅ **portal self-service (17-А)** + ✅ **журнал клієнту (17-Б portal-side)** + ✅ **типізовані шаблони (17-Д)** + ✅ **executor-share (17-SHARE)** (усі 05.07). Лишок: ротація-нагадування. _Примітки: TOTP-2FA — коли модуль 01 видаватиме authenticator-secret; каталог типів 17-Д — тимчасовий з design-v2, фінальний перелік від власника підміняється у `VAULT_RESOURCE_TYPES` (@workflo/types)._
4. ✅ **Member-mgmt write — зроблено** (owner-only, email-флоу): invite client member (POST `…/members/invite`, reuse portal-accept) + reset-password on-behalf (POST `…/members/:profileId/reset-password`, reuse forgot-password machinery).
5. **DR/інфра-блок** (беклог) — перед першим зовнішнім платним тенантом (див. нижче).

---

## 🔧 Зараз у роботі

- **S6 ✅ ядро закрито** (Documents + Notifications + Bot, на staging). Власник — **легкий sanity-тач** незворотних флоу (документ → надіслати → клієнт отримав + нотифікація; Telegram-лінк), НЕ вичерпний поштучний тест.
- **🧭 Режим тестування (рішення власника 2026-06-26):** per-slice безпека = **автогейт (type-check+lint+test) + Playwright-smoke у фоні** на кожен пуш. **Комплексний наскрізний тест + точкові правки логіки/фронту — на milestone S8** (QA + перший клієнт), коли вертикалі цілісні (багато фіч backend-blocked → розблокуються потім). Презентацію/UX відкладаємо туди; **гроші · документи · нотифікації · схему/контракти доводимо рано** (дорого ретрофітити). На S8-проході вести [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md), щоб відрізняти «заглушка by design» від багу.
- **➡️ S7 у роботі** (публічний сайт; [`TRACKER.md`](TRACKER.md) S7-01…04 — без CMS/chat-hub за scope-рішенням). **✅ Homepage ПОВНА (9/9 секцій):** Hero · Partners · Cases · Scale · Services · Process · Spotlight · About · Contact (термінал-shell, ported `wf-tm-*`, UA, light/dark, typewriter; гімікі-boot/sound/accent/CRT відкладено в polish). **✅ Contact API** (`POST /content/contact`, honeypot+rate-limit, ContactForm). **✅ Вторинні сторінки** (/services /about /contact /blog /cases через TermPageShell) + blog-read API + seed. **✅ SEO (S7-03 частина):** sitemap (static+services+blog-posts+/cases) · robots · metadataBase · per-page **canonical** · брендований динамічний **OG-образ** (`opengraph-image.tsx`, ASCII-only → network-free build) + twitter-карта · OG для blog/service detail. **Далі:** UA/EN i18n (+ hreflang, доносить решту S7-03) → Lighthouse≥90.
- **🧭 CMS-scope (рішення власника 2026-06-27):** «міні-CMS» = керування **блогом + кейсами** з workspace `/content` (+AI-генерація) — це **S7-05** (відкладено, наш scope «без CMS»). **Homepage-копірайт лишається в коді** (статика `content.ts`; рідкі зміни через деплой), НЕ редагується з адмінки. Повний landing-CMS (кожна секція з адмінки) = **S14 SaaS «лендінг-пресети+міні-CMS»** (11-ПРЕСЕТИ), не зараз. Поточна статика+seed сумісна: блог/кейси пізніше переїдуть у БД (`BlogPost`), homepage лишиться кодом.

### 🔍 Наскрізний design→build аудит (2026-06-24) — ДЖЕРЕЛО БЕКЛОГУ

> **[`DESIGN_GAP_AUDIT.md`](DESIGN_GAP_AUDIT.md)** — разова звірка ВСІХ екранів дизайн↔код. Висновок: збудоване ≈
> спрощений фундамент; дизайн = повний продукт; розрив ~70% бекендний. Беклог там — у двох треках:
> **Трек F** (frontend-only швидкі перемоги, бекенд готовий) і **Трек B** (backend-first модулі, S6+).
> **Канон дизайну:** живий claude.ai-проєкт «workflo.space» (через `DesignSync`); `design-v2/` — знімок; стару `design/` **видалено** (2026-06-24).
> Черга нижче — підмножина Треку F (детальніше — в аудиті).

### 🧪 Знахідки ручного тесту (2026-06-24) — черга доробок флоу (⊂ Трек F)

> Smoke ловить «екран не падає», НЕ «флоу повний». Власник тестуванням знаходить незавершені флоу. Тут — рівно вони.
> **Статус «Чистого S5»: ✅ Трек F ЗАВЕРШЕНО (12/12)** — фронт вирівняно до дизайну скрізь, де бекенд готовий; дивергентні заглушки прибрано. Далі — власник тестує все разом, потім **S6 (Трек B)**. Детально — [`DESIGN_GAP_AUDIT.md` §Трек F](DESIGN_GAP_AUDIT.md).

1. ✅ **Оцінка замовлення — UI** (Фіксована/Погодинна → `PATCH /orders/:id`) — розблоковує оцінка→погодження→рахунок.
2. ✅ **Ідентичність у чаті** — аватар + імʼя + бейдж команда/клієнт; бекенд `author.kind`.
3. ~~**Помітність таймера часу.**~~ ✅ зроблено (2026-06-29): `OrderTimerControl` у табі «Час» + глобальний `TimerBar` — старт/стоп з лічильником.
4. ~~**Портал: «Немає активної компанії».**~~ ✅ зроблено (2026-06-30): route-рівень `CompanyGate` (`components/CompanyGate.tsx`) огортає company-scoped маршрути (orders/billing/wallet/loyalty/referrals/team) → грейсфул empty-state «акаунт не привʼязаний до компанії» замість 400-червоної. Реальний клієнт із компанією, але без даних, проходить далі до власних empty-states.
5. ~~**Канбан DnD**~~ — ✅ зроблено (drag карток між колонками статусів, 2026-06-24).
6. ~~**Портал «Проєкти»**~~ ✅ зроблено (2026-06-30): новий `GET /portal/projects` (client-safe, scoped до активної компанії, billing.view) + портальна `ProjectsPage` (read-only умови: модель/цикл/ставка/включені години/статус). Під `CompanyGate`.
7. ~~**Реальний таймер часу (T2).**~~ ✅ **ПОВНІСТЮ ЗАКРИТО (2026-06-29):** бек — `TimeLog`+startedAt/endedAt (міграція `20260629_t2_timer`, drift-free), `services/timer.ts` (start auto-stops попередній + снапшот ставок; one-active через advisory-lock), `/workspace/timer` GET/start/stop, cron C15 auto-stop>8год, 13 тестів; UI — глобальний `TimerBar` + `OrderTimerControl` у табі «Час». Глобальний 1-таймер фактично per-tenant (RLS-scope) — достатньо для single-agency.
8. **Деталь замовлення v2 — розбіжність з дизайном.** Дизайн ([`product-app.jsx`](../design-v2/project/product-app.jsx):622): таби **Огляд · Чат · Час · Специфікація · Файли · Документи · Activity** + floating timer; задачі — в **глобальній «Дошці задач»** (`workspace-board.jsx`, лівий нав), НЕ в замовленні. **Прогрес:** ✅ Документи-таб (S6) · ✅ **Специфікація-таб** (естімейт проєкту, 2026-06-29) · ✅ звʼязок замовлення↔проєкт (лінк у сайдбарі) · Activity = сайдбар-картка (не таб, але дані є). **Лишилось:** Огляд-таб (вміст уже в сайдбарі — низька цінність). ✅ floating timer (T2, 2026-06-29), ✅ глобальна «Дошка задач» (`/workspace/tasks` + `/board`, 2026-06-30) — закрито.

## ✅ Готово нещодавно (не брати вдруге)

- **Vault executor-share (17-SHARE) — ЗАКРИТО (2026-07-05).** Модель — **рішення власника
  (вікторина 05.07): гібрид** (точковий share НА один секрет + «всі секрети клієнта» одним
  grant'ом, вкл. майбутні), **безстроково до відкликання** (`expiresAt` лишений у моделі під
  авто-expiry спеки — гейт чесно перевіряє, ніхто не видає), виконавцю — **свій розділ
  «Секрети»**. `CredentialShare` (міграція, RLS wf_in_tenant, XOR-ціль route-enforced).
  Роути `/workspace/vault/shares` GET/POST/DELETE — owner-only, одержувач мусить бути
  виконавцем (manager заблокований каноном MANAGER_BLOCKED), дубль → 409, audit
  share_granted/share_revoked. Read-шлях: `vaultShareAccess.ts` (owner все · executor union
  активних share · list executor'а без share = порожньо, не 403 · reveal поза скоупом 403 ·
  step-up відкрито виконавцям — reveal і їм потребує пароль). UI: на табі «Секрети» картки
  клієнта — блок «Доступ виконавців» (client-level тумблери) + модалка «доступи» на рядку
  (точкові; покриті client-share — замком) + рядок «доступ у команди: імена» (канон дизайну);
  виконавець — nav «Секрети» (roles ox) → `/vault` read-only без журналу/CRUD. Гейт: +14
  тестів (api **757** unit; 3 старі executor-403 тести свідомо переписані під нову поведінку),
  turbo 56/56. Вживу: owner тумблером видав «всі секрети» Петру → виконавець у своєму /vault
  побачив 2 секрети клієнта і розкрив typed-картку через ВЛАСНИЙ пароль-step-up → revoke →
  порожній vault (API-перевірка). Лишок 17: ротація-нагадування, TOTP-модал.

- **Vault типізовані шаблони секретів (17-Д) — ЗАКРИТО (2026-07-05).** Каталог
  `VAULT_RESOURCE_TYPES` (crm/server/hosting/api/db/other) + `VAULT_FIELD_KINDS` (url/login/
  email/note відкриті · password/api_key/token/secret_w 🔒) у `@workflo/types` — **єдина точка
  підміни** під фінальний перелік власника (патерн REACTION_EMOJIS; БД не мігрувати). Міграція
  `20260705_vault_typed_templates` (additive, drift-free): `credential_vault` += `resourceType`
  - `publicFields Json`. **Секретні поля картки — один envelope-пейлоад** (JSON-масив у наявних
    ciphertext-колонках) → одна audit-подія і один тік throttle на reveal картки; legacy-рядки
    (resourceType null) працюють без змін. `services/vaultFields.ts` спільний для обох роутів;
    create приймає обидва шейпи (typed вимагає ≥1 🔒-поля — 400 на all-public), невідомий
    тип/kind → 400; reveal typed → `secretFields[]`. UI — **спільні компоненти в
    `@workflo/app-core`** (`VaultTypedFieldsEditor` — kind-select+значення+«+ поле»;
    `VaultTypedCardFields` — відкриті поля з per-field «копіювати», секретні маскою до reveal):
    підключено в portal `/secrets` (модалка) і workspace client-360 add-форму + `SecretRow`
    (обидва `/vault` і таб «Секрети»). Гейт: +6 тестів (api **743** unit), turbo 56/56. Вживу:
    клієнт створив typed-картку KeyCRM (url+login+password+api_key) → відкриті поля видно одразу,
    секретні «••••» → reveal через пароль → «Пароль … копіювати · API-ключ … копіювати» (скрін);
    owner бачить ту саму картку в workspace `/vault`. Лишок 17: executor-share,
    ротація-нагадування, TOTP-модал.

- **Vault portal self-service + журнал клієнту (17-А + 17-Б portal-side) — ЗАКРИТО (2026-07-05).**
  Новий `portalCredentials.ts`: `/portal/vault/step-up` + `/portal/credentials`
  list/create/reveal/revoke/delete/audit. Доступ — **лише власник компанії** через
  `can('credentials.*')` (закладений ADR-002 шов нарешті використано; member → 403).
  Reveal — той самий HMAC-grant (пароль, 5хв) + throttle 10/год per-profile + audit
  `via:'portal'`. Клієнт **відкликає будь-який** доступ (канон дизайну), **hard-delete лише
  власноруч доданих** (агенційний рядок → 403 «його можна відкликати»). **Email-verified гейт
  на create/reveal/revoke/delete — закрито відкладений S9-борг** (непідтверджений акаунт бачить
  метадані, чутливі дії — після верифікації). Журнал клієнту: хто з команди і коли — **без
  IP/UA** (телеметрія лишається в owner-журналі). UI: portal `/secrets` під CompanyGate —
  security-нотатка, список з бейджем «додано вами», модалка «Додати ресурс», reveal з
  авто-hide 20с + «копіювати», журнал розгортанням; для не-власника — чесний 403-екран.
  Гейт: +20 route-тестів (api **737** unit), turbo 56/56. Вживу: клієнт додав секрет → reveal
  через step-up (скрін) → журнал «створено/показано» → **owner побачив його у workspace
  `/vault`** (двосторонність 17-А) → свіжий непідтверджений акаунт отримав 403 email-гейт
  (curl). Чесний субсет: типізовані картки 17-Д і TOTP-модал з мокапа — пізніше.

- **Leads-добудова: UTM-захоплення + activity-timeline (26 C1/A2-частина) — ЗАКРИТО (2026-07-05).**
  Міграція `20260705_lead_utm_activity` (additive, drift-free verified): `leads` += utm×5,
  нова `lead_activities` (RLS wf_in_tenant, FK cascade на lead), `contact_forms` +=
  utm/page/referrer/leadId. **UTM:** лендінг захоплює first-touch utm\_\*+referrer у
  sessionStorage (`lib/utm.ts` + `UtmCapture` у root-layout, не перезаписується), обидві
  contact-форми шлють із сабмітом; `POST /content/contact` **best-effort** створює лід у
  платформенній агенції (`runWithAgency`+`withTenant`; падіння інтейку НЕ губить повідомлення —
  contact_forms пишеться завжди, leadId nullable). Не-email контакт (@tg) іде в нотатки, не в
  email-колонку. **Timeline:** `LeadActivity` журналить created (manual/website+page) /
  stage_changed (from→to, +lostReason) / assigned / updated (**diff проти попередніх значень** —
  повторний save без змін не шумить) / converted (orderId); `GET /workspace/leads/:id/activity`
  (team-only, 404 cross-tenant). UI `/leads/:id`: картка «Джерело · UTM» (чіпи, лише коли є) +
  «Активність» (актор = ім'я з ростера або «сайт»; конвертація — лінк на замовлення). Гейт:
  +10 тестів (leads 24, content 9; api **717** unit + 151 gated), turbo test+lint+type-check+build 56/56.
  Вживу: curl contact з utm → лід+журнал+лінк у БД перевірені psql; UI — чіпи, таймлайн,
  зміна стадії з live-оновленням запису «Новий → Контакт» без reload (скрін). Лишок 26:
  пайплайн-редактор (A4), follow-up гігієна, аналітика джерел — окремі зрізи.

- **TOTP 2FA (S9-01) — ЗАКРИТО (2026-07-03).** RFC 6238 з нуля (Node crypto, без залежності —
  перевірено на ДВОХ офіційних RFC-векторах). Модель `TwoFactorAuth`: секрет **KEK-encrypted**
  тим самим envelope-схемою, що vault (17) — тож 2FA потребує `CREDENTIALS_KEK_BASE64`. Роути:
  setup (секрет+otpauth), enable (перший код → 10 одноразових backup-кодів, bcrypt), disable
  (код або пароль), status, **login-verify**. Login-гейт: при увімкненому 2FA пароль-крок віддає
  `twoFactorRequired`+challenge (окремий HMAC-токен, фізично НЕ access-token, 5 хв), не сесію;
  `/auth/2fa/login-verify` міняє challenge+код на токени. Backup-код одноразовий (спожив у tx —
  reuse дає 401). Фронт: workspace login отримав крок коду; settings «Безпека» — QR (lazy
  qrcode-чанк 24K, бандл +20K) + ручний ключ + backup-коди-бокс + disable. Гейт: +14 тестів
  (api 657). **Верифіковано наскрізно вживу**: setup→enable→login-challenge→TOTP-login→
  backup-login→reuse-401 (curl), і UI setup+enable (скрін QR + резервні коди). **Portal 2FA-крок
  теж закрито (2026-07-03)** — той самий challenge-бек, перевірено вживу через прев'ю (пароль →
  код → кабінет). sessions/OAuth/email-verify — далі по S9.
- **Активні сесії (S9-02) — ЗАКРИТО (2026-07-03).** Сесія = family refresh-токенів: ротація
  переносить `familyId` + `firstIssuedAt` на новий рядок, тож живі рядки = живі пристрої;
  access-токен несе `sid=familyId` → бек знає «поточну». RefreshToken += userAgent/ip (login,
  register, 2fa-verify пишуть; ротація освіжає). Роути: GET /auth/sessions,
  DELETE /auth/sessions/:id (404 на чужу/відкликану), POST /auth/sessions/revoke-others
  (400 на legacy-токен без sid — інакше вбив би й себе). Workspace /settings: картка
  «Безпека · активні сесії» (браузер·ОС з UA, ip, вхід/активність, бейдж «поточна», Завершити
  / Завершити всі інші). Revoke гасить refresh — пристрій вилітає на наступному оновленні
  (≤15 хв access-TTL). +6 тестів (api 663). Вживу: 2 логіни з різними UA → список/бейдж ок,
  revoke → 404 на повтор, revoke-others зніс 39 висячих dev-сесій; UI-клік зніс 3 (скрін).
  Далі: OAuth, email-verify.
- **Portal security-паритет (S9 tail) — ЗАКРИТО (2026-07-04).** Portal /settings тепер має
  повний набір workspace: «Безпека · пароль» (було) + «Безпека · 2FA» (QR/ключ/резервні коди,
  disable паролем) + «Безпека · активні сесії» (бейдж «поточна», Завершити / всі інші).
  Той самий бек, нові lib/twoFactor.ts + lib/sessions.ts у порталі, qrcode лінивим чанком.
  Вживу через прев'ю: client@ setup→enable (тост, 10 кодів)→disable паролем; revoke-others
  зніс 5 висячих сесій. Гейти 7/7.
- **Email-верифікація (S9, канон 01-auth §B) — ЗАКРИТО (2026-07-04).**
  `Profile.emailVerifiedAt` (міграція grandfather-ить усі наявні профілі — nag тільки для
  нових реєстрацій); токен в `otp_tokens(purpose=email_verify)` TTL 24h, upsert по
  (profileId,purpose) → resend гасить старий лінк. Лист uk/en (email+telegram шаблони,
  CRITICAL_EVENT). Роути: POST /auth/verify-email (публічний, 410 на
  чужий/прострочений/повторний), POST /auth/resend-verification (3/15хв, 400 як уже
  підтверджено). Скринька також доводиться invite-accept'ом (email-bound) і
  password-reset'ом. /auth/me віддає emailVerified. Portal: сторінка /verify-email
  (страждає StrictMode-подвійний виклик — firedRef) + банер з resend'ом у AppLayout.
  Login НЕ блокується (канон). +7 тестів (api 673). Вживу: register → лист у Mailpit →
  лінк у прев'ю → «готово» → reuse 410 → me:true → resend-після-verified 400; банер
  видно у user2, resend доставив другий лист, старий лінк 410/новий 200, після
  верифікації банер зник. Гейт «чутливі дії до підтвердження» — відкладено до
  portal-vault self-service (наразі непідтверджені лише свіжі клієнти, їм гейтити нічого).
  З auth-набору лишився OAuth (Google).
- **Google OAuth (S9 §E) — ЗАКРИТО (2026-07-04). Auth-набір §B–§E тепер повний.**
  Code-flow без SDK (redirect → token-exchange, id*token з TLS-довіреного ендпоінта);
  state = HMAC-підписаний JSON (v: login|link, app: portal|workspace, 10хв TTL).
  `OAuthAccount` (provider+sub unique). Callback-гілки: знайомий акаунт → сесія;
  email збігається з профілем → auto-link ТІЛЬКИ як Google каже email_verified
  (інакше oauthError=unverified); новий → signup (компанія+тенант як register,
  випадковий пароль, email авто-верифікований, avatar з Google). **2FA не обходиться**:
  замість сесії — challenge-redirect `/login?oauth2fa=`, той самий верифай, що пароль.
  Unlink вимагає пароль (канон ≥1 спосіб входу). GET providers → кнопки ховаються,
  коли не налаштовано (503-патерн як KEK). Обидва фронти: кнопка на /login,
  картка «Способи входу» в /settings, oauthError/oauth2fa-landing'и з чисткою URL.
  Compose: GOOGLE_OAUTH*\*\_STAGING/\_PROD → контейнер (callback-дефолти під dev-api/api).
  +11 тестів (api 684, stubbed token-endpoint). Вживу з fake-конфігом: providers,
  302 на accounts.google.com, forged-state → oauthError=state (скрін), oauth2fa-landing
  відкриває екран коду, unlink-без-звʼязку 404. Повний Google-dance потребує
  client-id/secret з Google Cloud Console — крок оператора (див. .env.example).
- **Chat @mention + read-receipts (S10) — ЗАКРИТО (2026-07-04).**
  @mention: GET /orders/:id/participants (team+client), автокомпліт у композері обох
  ChatTab-ів («@» → випадачка, Enter/Tab підставляє), фронт шле mentionIds; сервер
  валідовує ВИДИМІСТЬ (клієнта у internal-нотатці мовчки відкидає — перевірено вживу).
  `OrderComment.mentionIds`. Згадані отримують chat.mentioned (нові email/tg шаблони
  uk/en) ЗАМІСТЬ generic chat.new_comment (без подвійних листів; воркер ділить
  отримувачів). Підсвітка @Ім'я по точних іменах учасників + акцент-рамка рядка «вас
  згадали». Read-receipts: meta.reads (маркери інших учасників) + in-process bus-івент
  з mark-read → SSE `event: read` → ✓/✓✓ з тултипом «хто прочитав»; перехід ✓→✓✓
  БЕЗ reload перевірено наживо (клієнт прочитав по curl — тік перемкнувся в UI).
  Листи: executor отримав «Вас згадали» двічі (public+internal), клієнт — лише за
  public (Mailpit). Гейти 51/51 (api 684+chat-моки).
- **Chat edit/delete + реакції + typing (S10-хвости, канон 03-B/C + 03-Б) — ЗАКРИТО (2026-07-04).**
  PATCH коментаря: автор 15хв від createdAt, owner агенції — будь-чий і будь-коли (403/400
  перевірено вживу); факт правки = editedAt → «(відредаговано)». DELETE: soft (deletedAt),
  автор/owner. Реакції: CommentReaction (unique comment+profile+emoji), POST/DELETE
  .../reactions, агрегат {emoji,count,mine,names}, чіпи+«+🙂»-пікер; емодзі валідовано
  проти REACTION_EMOJIS. Typing (03-Б): ефемерно без БД — POST → bus → SSE, композер
  пінгує ≤1/2.5с, «N друкує…» гасне за 4с; leak-гард на internal-набирання. SSE додав
  comment_updated (re-fetch з DB-правди, як insert) / comment_deleted / typing; обидва
  фронти живо оновлюють кеш. +10 тестів (api 694). Вживу: 403 на чуже, edit → мітка,
  👍/🔥 агрегат з mine, 💩 → 400, «Петро Виконавець друкує…» у відкритому UI, 🗑 → зникло.
- **[БЕКЛОГ · дизайн] Власний технічний емодзі-пак для реакцій.** Зараз реакції — тимчасовий
  системний набір `REACTION_EMOJIS` (packages/types/src/constants.ts) — ЄДИНА точка підміни:
  API валідовує проти нього, обидва фронти рендерять пікер із нього. Коли дизайнер віддасть
  власний пак (svg/спрайт у стилі wf-tokens) — замінити константу + рендер чіпа (емодзі-гліф →
  іконка), БД не мігрувати (emoji-колонка лишиться ключем-ідентифікатором).
- **Chat pin + пошук (03-Г + 03-В) — ЗАКРИТО (2026-07-04).** Pin: `pinnedAt/pinnedById`,
  POST/DELETE `.../pin` — лише команда (клієнт 403), відповідь GET /comments несе окремий
  `pinned[]` (до 20, старші за сторінку включно), leak-гард: клієнту лише публічні піни
  (перевірено: owner бачить 2, клієнт 1). UI: згорнута секція «📌 закріплене · N» зверху
  чату (обидві апки; відкріплення ✕ — тільки workspace), 📌 на кожному повідомленні
  (workspace). Пошук: GET `.../comments/search?q=` (≥2 символи, insensitive contains по
  всіх коментарях замовлення, top-20), leak-гард (клієнт «маржа» → 0, «реквізити» → 1 —
  перевірено вживу), 🔍-інпут + режим результатів у обох ChatTab. +4 тести (api 698).
  З чат-модуля лишилось: 03-МЕДІА (інлайн-рендер медіа — чекає ТЗ/мокапи дизайнера)
  і стилістичні хвости (hover ⋯-меню, підсвітка збігів пошуку).
- **Chat 03-МЕДІА (функціональна версія) — ЗАКРИТО (2026-07-04).** Інлайн-рендер вкладень
  у чаті обох апок: image/\* — авто-прев'ю ≤180px (blob-URL через Authorization-fetch,
  revoke на демонтажі) + overlay-лайтбокс; audio/video — нативний плеєр ПІСЛЯ кліку ▶
  (файли до 100МБ не тягнемо на відкриття чату). MIME-allowlist розширено на аудіо
  (mpeg/wav/ogg/mp4/webm) з magic-bytes-гардом (фейковий wav → 415 перевірено вживу);
  відео (mp4/webm) вже було. Ліміт 100МБ/файл ЛИШЕНО свідомо (рішення після «переглянути»
  з проходу 11.06). Вживу: PNG 320×180 відрендерився інлайн, лайтбокс відкрився,
  WAV-плеєр з'явився після ▶ (скрін). Дизайнерська стилістика (PDF-вьювер, ←/→, стани
  завантаження) — коли буде ТЗ. Побічний фікс: vite-проксі /api → 127.0.0.1 (localhost
  у Node ≥17 резолвиться в ::1 → ECONNREFUSED при IPv4-only API).
- **Inbox-хвости (18): @згадки-таб + bell-dropdown + mark-unread + snooze (18-Б) —
  ЗАКРИТО (2026-07-04).** Таб «@згадки» (type=chat.mentioned) у спільному InboxView.
  Bell-dropdown: Topbar отримав `bellPanel` render-prop (клік-поза закриває), BellDropdown
  (app-core) — останні 4 з unread-виділенням, «прочитати все», «усі сповіщення →»;
  обидва AppLayout переключені з navigate-по-кліку на дропдаун. Snooze:
  `Notification.snoozedUntil`, POST /:id/snooze {hours 1..720} (isRead=true+until),
  прострочені «прокидаються» ЛІНИВО при GET (updateMany lte-now — без крона),
  PATCH /:id/unread повертає в непрочитані і знімає snooze. UI: actions-bar у детальці
  (Позначити непрочитаним / Snooze 1год·до завтра·тиждень), 💤-маркер у списку.
  +3 тести (api 701). Вживу: mention-нотифікація приїхала, snooze→isRead+until,
  unread→скинуто, дропдаун/таб/💤 у UI (скріни). Лишок 18: mute/archive розмов (B),
  відповідальний за тред (18-В), «без відповіді > N год» (18-Г) — окремий зріз.

- **Чат-збагачення: вкладення + reply-to (03) — ЗАКРИТО (2026-07-03).** Міграція
  `20260703_chat_attachments_reply` (additive): `OrderComment.replyToId` (self-relation,
  SetNull) + `OrderFile.commentId`. Бек: `fileIds`/`replyToId` у createCommentSchema
  (attachment-only повідомлення дозволені через refine), лінк файлів з гардами (своє
  замовлення, ще не прив'язаний — не можна «вкрасти»), reply-гард (клієнт не відповідає на
  internal і не бачить її прев'ю навіть у serializer), SSE reuse спільного серіалізатора
  (стрім несе вкладення/цитату). Фронт (обидва ChatTab): кнопка «Файл» → чіпи-очікування →
  send; ↩ на повідомленні → reply-стріп над інпутом; цитата в баблі (SetNull → «повідомлення
  видалено»); download-чіпи (файл видно і в «Файлах»). Гейт: 24/24, api **643** (+5 чат-кейсів).
  Перевірено вживу: API-флоу файл→коментар→відповідь + скрін UI (чіп + цитата + композер).
  Чесний субсет: без інлайн-медіа/лайтбоксу (signed URLs — Фаза B), edit/delete/реакції — S10.

- **Email-шаблони: всі живі події тепер з листами (08, email-блок) — ЗАКРИТО (2026-07-03).**
  +6 пар шаблонів (email+telegram, uk/en, stone+lime): **order_created** (команді, CTA у
  workspace) · **order_assigned** (виконавцю) · **approval_requested** (клієнту, CTA «Погодити
  оцінку» — раніше їхав генеричним status*changed) · **approval_decided** (команді,
  з коментарем клієнта при правках) · **document_sent** (акт/спека/звірка/договір з лейблом
  і номером) · **payment_received** (квитанція клієнту — **нова подія `payment.confirmed`**
  з createPayment, усередині idempotency: replay не шле дубля). Union подій += approval*
  requested/decided (+EVENT_TO_CATEGORY). Гейт: +9 тестів (notifications 29, api 638).
  **Верифіковано наскрізно через Mailpit**: 3 живі листи доставлені реальним пайплайном
  (API→outbox→worker→SMTP), бренд-палітра і CTA в HTML підтверджені. Лишок дизайн-набору
  (verify/otp/digest/deadline…) — флоу ще не існують (S9/S12), чесно відкладено.

- **Блок документів: повний UA-комплект 6 типів (06) — ЗАКРИТО (2026-07-03).** Раніше всі
  типи рендерились ОДНИМ generic-шаблоном (одна позиція + сума). Тепер пер-типові рендерери
  в `packages/templates` за каноном documents-screens.jsx: **рахунок/аванс** (позиції з
  estimate-ліній проєкту або фолбек, ПДВ-рядок за `legalEntity.vatPayer`, ₴-еквівалент з
  ExchangeRate + rate-note, призначення платежу, «сплатити до» з paymentTerms), **акт робіт**
  (період, підстава-рахунок, приймання-передача, двосторонні підписи), **специфікація**
  (контекст+позиції+бюджет), **акт звірки** (реальні charges/payments компанії → дебет/кредит/
  сальдо), **договір** (рамковий, 7 типових розділів, сторони-картки з реквізитами; тип доданий
  у create-схему й UI). **Фікс:** документ тепер білдиться до юр-особи (проєкт → дефолтна) —
  раніше binding не заповнювався і рахунки виходили без реквізитів. UI: 6 кнопок генерації в
  табі «Документи». Гейт: +8 тестів templates (нова тест-інфра пакета) + 18 documentsRoute,
  всі зелені. **Перевірено живими PDF** (Chromium): усі 6 типів = справжні %PDF 89–126KB,
  скріни рахунку/звірки — канон. Субсети чесні (без QR, e-sign — S12, EU-комплект — окремо).
  _Далі в блоці: email-шаблони (11 з 15 відсутні)._

- **INFRA-DR1 (repo-частина) — ЗРОБЛЕНО (2026-07-03).** (1) **uploads на named volume** —
  до цього клієнтські файли жили в шарі контейнера і гинули при КОЖНОМУ recreate
  (compose prod+staging: `uploads_data:/data/uploads` + `UPLOAD_DIR`; Dockerfile pre-create
  з правами node). (2) **Ще один project-name баг**: backup.sh кликав compose без
  `--project-name` → `up -d postgres` міг піднімати другий порожній postgres і дампити
  його — виправлено (та сама пастка, що в rollback.sh). (3) Денні дампи тепер
  `--no-owner --clean --if-exists` (ідемпотентний restore). (4) **`scripts/restore.sh`**:
  `--drill` (throwaway PG16 + метрики tables/profiles/agencies + Telegram-звіт) і
  `--restore` (підтвердження словом RESTORE, стоп сервісів, дамп, `up --wait`).
  (5) Нічний uploads-tar + офсайт (restic/rclone) для нього. (6) Щомісячний drill-cron
  в інсталяторі. (7) backup/restore/cron-інсталятор додані у scp-синк деплою.
  **Drill прогнано локально на реальному дампі: DRILL OK (52 tables, 3 profiles).**
  Серверна активація — SERVER_UPDATE_2026-07 крок 7 (restic init + перший drill).

- **EditMemberModal (12-EDITMEMBER) + advisory-lock на вікна ставок — ЗАКРИТО (2026-07-02).**
  Роль + компенсація (оклад/міс · **собівартість $/год** для каскаду маржі · комісія % ·
  валюта) + норма год/тиж + zeroCost — в ОДНІЙ модалці `/team` (ростер став read-only +
  «Редагувати»). Нове: `PATCH /workspace/executors/:id/role` (owner-only; лише
  manager/executor, **owner-рядок → 409** — передача власності окремим флоу);
  `hourlyRate` у схемі/роуті/DTO ставок (у payout свідомо НЕ включено — S5-D6 окремо).
  **Спійманий живим тестом і закритий конкуренс-баг:** rates-POST + zero-cost-PATCH
  паралельно лишали ДВА відкриті вікна ставки → `pg_advisory_xact_lock` per
  (agency, executor) в обох транзакціях (патерн таймера/лідів); доведено навмисною
  гонкою двома curl — рівно одне відкрите вікно з обома ефектами. +5 тестів (638 unit).
  Дизайн-субсет чесний: підрозділи/керівник із мокапа — Фаза B (нема жодного API).
  Mobile-пакет — відкладено рішенням власника 02.07.

- **Профіль «Заробіток» + security-фікс payouts-скоупа (13-ПРОФІЛЬ) — ЗАКРИТО (2026-07-02).**
  Дорогою знайдено і закрито **leak**: `GET /workspace/team/payouts` віддавав УСІ виплати
  агенції будь-якому члену команди (виконавець бачив чужі зарплати — всупереч принципу
  «compensation is owner-only» з team.ts). Тепер не-власник отримує **лише свої** рядки
  (server-side scope), власник — усі, менеджер — 403 як і був. Профіль: EmptyState «скоро
  (S5)» → реальні виплати по періодах (оклад·комісія·реф·разом·статус) + стат «виплачено
  за рік»; `useMyPayouts()`. +2 тести (633 unit). Перевірено вживу під виконавцем: у
  відповіді API рівно один рядок — власний; чужі відсутні (network-лог).

- **Прогрес годин на картках дошки задач (12-ПАНЕЛЬ) — ЗАКРИТО (2026-07-02).** Годин на
  `InternalTask` нема (канон workspace-board-task.jsx — rollup у замовлення), тож картка
  показує **est-vs-actual батьківського замовлення**: `GET /workspace/tasks` тепер віддає
  `order.estimatedHours` + `order.loggedHours` (groupBy по TimeLog, running-таймер виключено —
  те саме правило, що hoursReport). UI: міні-`wfp-est-bar` (3px) на картці — лайм у межах,
  червоний `--over` при >100%, «N год · без оцінки» без бара. +1 тест (631 unit). Перевірено
  вживу на 3 кейсах: 31% лайм · 130% червоний · без оцінки. _Per-task години + пул підписки —
  Фаза B (потребує схеми)._

- **CSV+XLSX-експорт на всіх 4 звітах (19-Б) — ЗАКРИТО ПОВНІСТЮ (2026-07-02, докручено XLSX на прохання власника).**
  Спільна пара кнопок «CSV · XLSX» (`components/ExportButtons.tsx`) + одна таблична модель
  (`lib/exportTable.ts`): CSV зшиває таблиці порожнім рядком, XLSX кладе кожну на окремий
  аркуш (Reports = 2 аркуші), числа — справжні numeric-клітинки, жирний хедер, авто-ширина.
  `exceljs` (MIT) тягнеться **лінивим чанком 920K лише на клік** — основний бандл не виріс
  (664K). Рефактор Reports/Finance/Margin/Payouts на спільний компонент. Верифіковано вживу:
  XLSX-blob = валідний ZIP (`PK\x03\x04`) на Margin і Payouts, CSV після рефактора коректний.
  _(Оригінальний CSV-зріз нижче — того ж дня.)_

- **CSV-експорт на Margin + Payouts (19-Б «експорт на кожному звіті») — ЗАКРИТО (2026-07-02).**
  Той самий клієнтський Blob-патерн, що в ReportsPage: `/margin` — CSV активного таба
  (клієнти/проєкти/виконавці, з рядком РАЗОМ), `/payouts` — CSV періоду з підсумками
  **по валютах** (не змішуємо). Кнопки disabled на порожніх даних. XLSX свідомо не робимо
  (CSV відкривається в Excel). Перевірено вживу перехопленням Blob: обидва CSV коректні
  (клієнти-таб + згенеровані виплати «Липень 2026»). Гейт workspace зелений. CSV тепер на
  всіх 4 звітних сторінках.

- **Звірка «backend-ready» беклогу + requiresApproval-чекбокс — ЗАКРИТО (2026-07-02).**
  Після 5 «привидів» поспіль (05-З теж виявився збудованим: ендпоінт+хук+модалка) проведено
  **агентну звірку всіх 28 рядків** секції «Що будувати далі» DESIGN_COVERAGE: **17 ✅ вже
  збудовано · 4 🟡 частково · 4 ⚪ реально відсутні**. Секцію перезібрано з вердиктами і
  доказами file:line. Чесна черга найдешевших: CSV на Margin/Payouts → прогрес на
  TaskBoard-картках → «Заробіток» у профілі → EditMemberModal; mobile-адаптиви — окремим
  пакетом (в апках нуль responsive-інфри). Єдиний реально відсутній «на годину» зріз
  закрито одразу: **чекбокс «Погодження оцінки клієнтом (02-А)»** у CreateOrderModal
  (workspace) — explicit-override поверх P-11 каскаду (unchecked → каскад вирішує сам,
  НЕ force-off). Перевірено вживу: створене з форми замовлення має `requiresApproval=t`
  у БД. Гейт workspace зелений.

- **zeroCost-тумблер «без собівартості» (22/P-5, backend-ready №видимий) — ЗАКРИТО (2026-07-02).**
  _Примітка розвідки: 4 інші «backend-ready» рядки матриці виявились уже збудованими
  (форма «Нове замовлення», approval-кнопки Portal, payment-модалка, LegalEntity CRUD) —
  рядки DESIGN_COVERAGE оновлено._ Бек: `PATCH /workspace/executors/:id/zero-cost`
  (owner-only, no-op на однаковий прапорець) — закриває відкрите `ExecutorRate`-вікно і
  відкриває нове з перенесеною компенсацією (append-only інваріант); **фікс бага-в-засідці:**
  `POST /rates` тепер переносить прапорець у нове вікно (раніше зміна ЗП мовчки скидала
  zeroCost). `GET /workspace/team` віддає `zeroCostDefault`. Фронт: пігулка `wfp-pill`
  «без собівартості» у ростері `/team` (owner; read-only мітка для інших). Гейт: api **630**
  unit (+6 нових у team.test.ts) · перевірено вживу (скрін: тост + пігулка; БД: 2 вікна,
  значення перенесені). Лишок 22-Д: per-project override UI — Фаза B.

- **A0 бренд вихідних артефактів — ЗАКРИТО (2026-07-02).** З'ясовано: палітру листів уже виправлено
  `a7209f9` (22.06, stone+lime) — Трек-A0 у PHASE2_PLAN був doc-drift. Доробано хвости: PDF
  `brand-dot` і landing **OG-образ** сиділи на tailwind `#84cc16` замість токенів → `#A3D90D`
  (light) / `#C5F82A` (dark OG). OG перевірено скріном (preview). Гейт: templates+landing+
  notifications зелені. `grep #84cc16` по репо = 0. UPDATE-нотатки в DESIGN_COVERAGE (3 місця).

- **🛠 Інфра/докс-зріз за аудитом 2026-07-02 (DevOps 7/10 · архітектура 8/10 · доки 6.5/10 → фікси).**
  Закрито 3 критичні знахідки: (1) **RLS/vault прокинуто в прод**: `packages/db` тепер читає
  `DATABASE_APP_URL` (app-роль лише для web; migrate/worker лишаються owner) + compose staging/prod
  прокидає `RLS_ENFORCED`/`DATABASE_APP_URL`/`CREDENTIALS_KEK_BASE64` — раніше CI гейтив RLS, який
  у проді фізично не міг увімкнутись; (2) **rollback.sh** — `--project-name workflo-production`
  (без нього піднімав ДРУГИЙ конфліктний стек) + `up --wait`; (3) **seed fail-closed** на
  NODE*ENV=production без `SEED*\*\_PASSWORD`+ staging api/portal під`TEAM_IPS`-whitelist
(`/health`carve-out для CI). Додатково: appleboy actions запінено по SHA (INFRA-SEC1 частково);
авто-rollback у production.yml тепер`--wait`(не рапортує успіх на падаючих контейнерах);`tsconfig.tsbuildinfo` знято з git (+`.gitignore`); доки: README-індекс перезібрано (ROADMAP =
start here, секція «Аудити»-lineage, чесний CRON-рядок), TRACKER позначено історичним знімком
з вказівником сюди, S4/S5-доки → `archive/`, AGENTS.md отримав Workflo-канон блок. Гейт:
type-check/lint/test db+api зелені (624 unit), обидва compose `config` валідні. Запис —
[`AUDIT_2026-07.md`](AUDIT_2026-07.md) раунд 3.

- **Leads-дозбудова (пост-аудит).** Закрив нотатку аудиту (drag→«Втрачено» губив причину): drag у «Втрачено» тепер запитує причину (`window.prompt`, Cancel скасовує), причина показується на картці «✕ …». + суми угод по колонках (`$Σ estimatedValue`) + активні/**конверсія %** у хедері (won/(won+lost)). Frontend-only (бек уже приймав `lostReason`). Гейт 55/55. **+ lead-detail сторінка** `/leads/:id` (новий `GET /workspace/leads/:id` +2 тести; редактор усіх полів + нотатки + стадія + inline-конвертація/видалення; клік на назві картки → деталь). _Лишок Leads: пайплайн-редактор, UTM-захоплення з contact-форми, per-lead activity-timeline (потребує `LeadActivity`)._

- **🔎 Наскрізний аудит сесії + ремедіація (2026-07-01, `f64c67b`).** 3-агентний аудит (security·typescript·code) діфу `8656538..a24409d` → `docs/AUDIT_2026-07.md`. 0 crit/high security. Виправлено: HIGH timer-`dateOnly` UTC→Europe/Kyiv бізнес-день; HIGH lead drag-to-won обходив convert (бек-гард + фронт→convert-модалка); MED last-owner + lead-convert TOCTOU (per-company/per-lead advisory-lock); LOW cron auto-stop lock; nits (ClientProject.createdAt, useUpdateLead тип). Регресій 0. Гейт: api **572**+151 gated·types 104·3 міграції drift-free (перевірено `migrate deploy` на real-PG).

- **Leads / CRM (модуль 26) — ядро.** Був design-only (нуль коду). Міграція `20260630_leads` (drift-free verified): `Lead` модель + `LeadStatus` enum (new/contacted/qualified/proposal/won/lost) + RLS (wf*in_tenant) + TS-enum+drift-guard. Бек: `routes/leads/leads.ts` — board (`GET /workspace/leads?status=`) · create · update (stage/fields/assignee/lost-reason) · **convert→client Order** (lock-guard «вже конвертовано» 409, company-tenant 404, лінкує companyId+convertedOrderId+won) · delete. Internal-team, tenant-scoped, audited. 14 route-тестів. Фронт: nav «Ліди» (om) + `/leads` `LeadBoardPage` — 6-стадійний DnD-канбан + create-modal + convert-modal (пікер компанії) + delete. Гейт: type-check 23·lint 14·build 14·test (api **571** unit + 151 gated · types 104). *(MVP: фіксовані стадії; custom-pipelines/UTM/lost-аналітика — пізніше.)\_

- **Capacity-норма — план-факт завантаження виконавців (12-ПЛАН-ФАКТ).** Дозбагатив hours-report capacity-рівнем. Міграція `20260630_capacity_norm` (ADDITIVE, drift-free verified): `AgencyMember.weeklyCapacityHours Int?` (null→дефолт 40). Бек: `computeHoursReport` byExecutor +`capacityHours`(норма×тижні-у-вікні)+`utilizationPct`(факт/норма); `PATCH /workspace/executors/:id/capacity` (owner-only, +6 тестів `teamCapacity.test.ts`); `GET /workspace/team` віддає норму. Фронт: ReportsPage byExecutor +колонки Норма/Завантаження (>100% червоним); TeamPage inline-редактор норми (owner, год/тиж). Гейт: type-check 23·lint 14·build 14·test (api **557** unit + 151 gated). Coverage 19 план-факт → capacity-рівень.

- **Портал «Проєкти» (#6 ЗАКРИТО) — усі знахідки ручного тесту закрито.** Бек: `GET /portal/projects` (`billing/projects.ts` — client-safe DTO без внутрішніх полів: legalEntity/contract/advance-gate/approver; scoped active-company; `billing.view`+module-gated) + 3 тести (`portalProjects.test.ts`). Фронт: портальна `ProjectsPage` (read-only умови співпраці: модель/цикл/ставка/включені години/статус) під `CompanyGate`; nav-лінк `/projects` уже існував. Гейт: type-check 23·lint 14·build 14·test (api **551** unit + 151 gated). **Знахідки ручного тесту #1–8 — усі закриті (крім свідомо backend-blocked-немає).**

- **Глобальна «Дошка задач» (02-Е/фінд.#8 ЗАКРИТО).** Бек: агрегуючий `GET /workspace/tasks` (`routes/orders/internalTasks.ts` — усі `InternalTask` агенції cross-order, internal-team, фільтри assignee/status, з order+assignee-контекстом) + 5 route-тестів (`tasksBoard.test.ts`). Фронт: nav «Дошка задач» (omx) + `/board` `TaskBoardPage` — 3 колонки (До роботи/В роботі/Готово), HTML5-DnD між колонками (move реюзає per-order PATCH через `orderId` картки — без нового мутейшн-ендпоінту), фільтр «лише мої», картка = задача+лінк на замовлення+виконавець. Гейт: type-check 23·lint 14·build 14·test (api **548** unit + 151 gated). _(Per-order таб «Задачі» лишається для локального контексту; глобальна дошка тепер теж є.)_

- **Reports — план-факт годин (19/12-ПЛАН-ФАКТ).** Природне продовження T2 (таймер дає реальні години). Бек: `services/hoursReport.ts` (`computeHoursReport` — за період: оцінка `Order.estimatedHours` vs факт Σ`TimeLog` по замовленнях + Σ по виконавцях + variance; running-таймери виключено) + owner-only `GET /workspace/reports/hours(.csv)` (6 тестів `hoursReport.test.ts`). Фронт: nav «Звіти» (owner) + `ReportsPage` (`/reports`) — період (YTD), стати план/факт/відхилення, таблиці по замовленнях (variance кольором) + по виконавцях, Експорт CSV. Гейт: type-check 23·lint 14·build 14·test (api **543** unit + 151 gated). Coverage 19 «план-факт» MISS→🟢IMPL. _(RISK: план = оцінка замовлення, не capacity-норма×тижні — той рівень потребує поля capacity.)_

- **Харден T2 — real-PG інтеграційний тест** (`apps/api/tests/integration/timer.test.ts`, gated `RUN_DB_TESTS=1`, 3 кейси, **прогнано на throwaway PG16**): доводить те, що mock не може — `pg_advisory_xact_lock` серіалізує **20 конкурентних стартів → рівно 1 running** (19 авто-стоплені, total=20); stop фіналізує + другий stop = no-op; auto-stop капить >8год timer рівно на 8год і прибирає з running. Закріплює найризикованіше зі збудованого без нового продуктового рішення. Гейт: type-check 23·lint 14·build 14·test (api 537 unit + **151** gated).

- **Портал «Немає активної компанії» (фінд.#4)** — route-рівень `CompanyGate` огортає company-scoped портал-маршрути → грейсфул empty-state замість 400. _(деталі у «Знахідки» #4)_

- **Floating-timer — UI (T2/фінд.#7+#3 ЗАКРИТО).** `lib/timer.ts` (`useActiveTimer` polling + `useStartTimer`/`useStopTimer` + `formatElapsed`). **Глобальний `TimerBar`** (`components/TimerBar.tsx`, fixed bottom-right, змонтований у `AppLayout`) — червоний пульс-дот + live-тікаючий HH:MM:SS + лінк на замовлення + «Стоп», рендериться лише коли таймер біжить. **Промінентний контрол у деталі замовлення** (`TimeTab` `OrderTimerControl`): «Засікти час»/«Зупинити» з лічильником; старт на іншому замовленні чесно попереджає «зупинить попередній». Закриває і фінд.#3 (помітність). Гейт: type-check 23·lint 14·build 14·test (api 537). **T2 повністю готовий (бек+UI).**

- **Floating-timer — БЕКЕНД (T2/фінд.#7, спринт-рівень).** Міграція `20260629_t2_timer` (**ADDITIVE, drift-free verified**): `TimeLog.startedAt`+`endedAt` (running = startedAt set + endedAt null; обидва null = ручний запис, back-compat) + composite-index `[executorId,endedAt]`. **`services/timer.ts`:** `startTimer` (advisory-lock per-executor серіалізує → авто-стоп попереднього + снапшот ставок П5/П7), `stopTimer` (endedAt+обчислення hours), `getActiveTimer`, `autoStopStaleTimers` (cap кожного на 8год). **One-active гарантується advisory-lock, НЕ partial-unique-індексом** (той зламав би drift-gate). Роути `/workspace/timer` GET/start/stop (internal-team). **Cron C15** `timerAutoStop` (погодинний cross-tenant sweep >8год). Running-таймер виключено зі списку time-logs. Тести: 13 (`timer.test.ts` — elapsedHours/GET/start+auto-stop/stop/cap). Гейт: type-check 23·lint 14·build 14·test (api **537**). **Далі: UI (floating timer-bar + start/stop у деталі замовлення).**

- **Orders-v2 — таб «Специфікація» + звʼязок замовлення↔проєкт** (`OrderDetailPage`): бек — `getOrder` тепер віддає `project{id,name,billingModel}` (internal-only, additive). Фронт: новий таб **«Специфікація»** (естімейт проєкту через `useProjectEstimate`/`GET /workspace/projects/:id/estimate-lines` — рядки послуг + reconciliation проти `includedHoursCap`, перевищення червоним; грейс-стани «без проєкту»/«немає доступу» для manager) + рядок **«проєкт»** у картці «Клієнт» (лінк на `/projects/:id`). Таби тепер: Чат·Час·Специфікація·Файли·Документи (+Activity у сайдбарі). Гейт: type-check 23·lint 14·build 14·test (api 524).

- **Фаза B (backend-first) — керування користувачами клієнта (28-Б, Edit-member)**: **новий бекенд** `PATCH`/`DELETE /workspace/clients/:id/members/:profileId` (`routes/company/members.ts`) — агенція змінює роль (власник↔учасник) / видаляє користувача клієнта. **OWNER-only** (керування чужими акаунтами — чутливо), tenant-scoped (404 cross-tenant), **last-owner-guard** (409 — не можна зняти/видалити останнього власника, щоб не осиротити компанію), audited `onBehalf:true`. +10 route-тестів (`clientMemberMgmt.test.ts`). Фронт: у табі «Люди» owner бачить inline role-select + «видалити» (confirm + toast). Гейт: type-check 23·lint 14·build 14·test (api **524**). _(Reset-password клієнта — окремо, бо email-флоу.)_

- **Фаза B (backend-first) — агенційне редагування реквізитів клієнта (28-Б)**: **новий бекенд** `PATCH /workspace/clients/:id/requisites` (`routes/company/requisites.ts`) — команда заповнює юр-дані клієнта замість нього (reuse `applyClientRequisites`: tenant-guard 404 + перерахунок `legalIsComplete`; internal-non-manager; audit `onBehalf:true`) + 6 route-тестів (`clientRequisitesWrite.test.ts` — owner-edit, cross-tenant 404, client/manager 403, empty-body 400, 401). Фронт: таб «Реквізити» тепер редагований (`useUpdateClientRequisites` + `RequisitesForm`: тип/назва/ІПН/ПДВ/адреса/банк/IBAN/підписант/email; empty→null; toast). **Завершує документообіг:** команда може довести реквізити клієнта до повноти → генерувати документи. Гейт: type-check 23·lint 14·build 14·test (api **514**).

- **Фаза B (backend-first) — таб «Люди» картки клієнта (28-Б)**: **новий бекенд** `GET /workspace/clients/:id/members` (`routes/company/requisites.ts`) — ростер контактів компанії клієнта (internal-non-manager, tenant-scoped: company.agencyId-перевірка→404 cross-tenant) + 5 route-тестів (`clientMembers.test.ts` — owner-scoped, cross-tenant 404, client 403, manager 403, 401). Фронт: таб «Люди» (`useClientMembers`) — аватар/імʼя/email/роль/дата. Read-only (Reset/Role/Remove/Invite = backend-blocked). Картка 360° = **6 табів** (Огляд·Люди·Проєкти·Фінанси·Документи·Реквізити). Гейт: type-check 23·lint 14·build 14·test (api **508**). Coverage 28 «таб Люди» MISS→🟢IMPL.

- **Фаза B (backend-first) — таб «Документи» картки клієнта (28-Б/06)**: **новий бекенд** `GET /workspace/clients/:id/documents` (`routes/documents/documents.ts`) — плоский company-scoped список усіх документів клієнта по замовленнях (`Document.companyId` indexed; internal-non-manager; cross-tenant→[] через agencyId+RLS) + 4 route-тести (owner-list scoped, client→403, manager→403, 401). Фронт: таб «Документи» у `ClientDetailPage` (`useClientDocuments`) — №·тип·замовлення·статус·дата + «відкрити» PDF (Bearer-blob через `openDocumentPdf`); нуль-стан. Розблокував 5-й таб картки 360° (Огляд·Проєкти·Фінанси·Документи·Реквізити). Гейт: type-check 23·lint 14·build 14·test (api **503**). Coverage 06 «таб Документи» MISS→🟢IMPL.

- **Фаза B — Нарахування на екрані проєкту (05/project360)** (`ProjectDetailPage` `ProjectChargesCard`): під білінг-грідом — таблиця нарахувань проєкту (період·тип·статус·строк·сума), статуси кольорами (очікує/частково/оплачено/прострочено/списано) + тег «чернетка» для on_actuals-pending. Фільтр client-side за `projectId` з `useCompanyCharges(project.companyId)`; нуль-стан. Internal-non-manager. Доповнює project360 (раніше: білінг+юр-особа+маржа+close-cycle). Гейт: type-check 23·lint 14·build 14·test (api 499).

- **Фаза B — «Потребує уваги» на табі Огляд картки клієнта** (`ClientDetailPage` `OverviewAttention` + новий `useCompanyCharges` у `lib/billing`): над статами Overview — картка attention з нарахувань клієнта: **прострочені рахунки** (dueDate<сьогодні і не paid/written_off → count + сума) + **на погодженні** (approvalStatus=pending чернетки → count), кожне з лінком на `/billing`; рендериться лише коли є що показати (інакше null). Реальні дані з `GET /workspace/billing/charges?companyId=` (internal-non-manager → manager не бачить). Це дизайн-патерн «потребує уваги» з `workspace-client360 Огляд». Гейт: type-check 23·lint 14·build 14·test (api 499).

- **Фаза B — client360 таб-shell (28-Б, дизайн-пріоритет №1)** (`ClientDetailPage`): 6 секцій картки обгорнуто в **таби** (`@workflo/ui Tabs`) за `design-v2 workspace-client360`: **Огляд** (стати+замовлення) · **Проєкти** · **Фінанси** (Лояльність+Маржа) · **Реквізити**. Manager бачить лише «Огляд» (решта internal-non-manager на беку → 403). **Свідомо омітнуто** дизайн-таби People·Документи·Секрети·Активність — backend-blocked (нема per-client members/docs/vault/activity API). Лінива загрузка: секція фетчить лише коли таб відкритий. Гейт: type-check 23·lint 14·build 14·test (api 499). Coverage 28 «таб Фінанси» PLHD→🟢IMPL. **Картка 360° тепер має таб-структуру дизайну (4/7 табів, решта — як з'явиться бекенд).**

- **Фаза B — Проєкти клієнта (05-ПРОЕКТИ/P-1) на картці клієнта** (`ClientDetailPage` `ProjectsSection` + новий `useCompanyProjects` у `lib/projects`): список фін-проєктів клієнта у workspace `/clients/:id` — назва (+неактивний), білінг-модель (абон/погодинна аванс/факт), цикл (щомісяця/щотижня/вручну), сума (абон/міс або ставка/год), рядок → `/projects/:id`; «+ проєкт» → `/projects`; нуль-стан. Backend `GET /workspace/projects?companyId=` був готовий (internal, manager-blocked). Це наближення client360-табу «Проєкти» (28-Б). Manager не бачить. Гейт: type-check 23·lint 14·build 14·test (api 499). **Картка клієнта тепер = 360°-lite: проєкти+замовлення+стати+лояльність+маржа+реквізити.**

- **Фаза B — Реквізити клієнта (06-Б/P-3) на картці клієнта** (`ClientDetailPage` `RequisitesSection` + новий `lib/requisites`): read-only секція «Реквізити» у workspace `/clients/:id` — юр-тип/назва/ЄДРПОУ/ПДВ/адреса/банк/IBAN/підписант/email-для-документів + бейдж повноти (`legalIsComplete` ✓повні/неповні); порожні поля приховані, нуль-стан = «клієнт ще не заповнив → документи виставити не можна» (видимість готовності до S6-документів для команди). Backend `GET /workspace/clients/:id/requisites` був готовий (internal, manager-blocked PII). Manager не бачить. Гейт: type-check 23·lint 14·build 14·test (api 499). _(Редагування на боці агенції = 28-Б; клієнт редагує в Portal.)_

- **Фаза B — Маржа клієнта (22-Д/P-9) на картці клієнта** (`ClientDetailPage` `MarginSection` + reuse `lib/margin`): **owner-only** секція «Маржа · з початку року» у workspace `/clients/:id` — дохід/собівартість/маржа(USD+%)/сплачено% (YTD-вікно як `/margin`) + розріз за проєктами (дохід/собів./маржа%) + лінк на повний `/margin` (період, за виконавцями). Backend `GET /workspace/companies/:id/margin` був готовий (owner-gated). Не-owner не бачить (query disabled + null). Реальні дані. Гейт: type-check 23·lint 14·build 14·test (api 499). _(Картка клієнта 360° тепер агрегує: замовлення+стати+лояльність+маржа; повний client360 з табами — окремий Фаза-B зріз.)_

- **Фаза B — Лояльність клієнта (10) на картці клієнта** (`apps/workspace/src/routes/clients/ClientDetailPage.tsx` + новий `lib/loyalty.ts`): секція «Лояльність» у workspace `/clients/:id` — ефективний тір + знижка% + прогрес-бар до наступного тіру (сплачено/залишок USD) + історія тірів; **owner-only ручний override** (Select тір/«Авто» → `POST …/loyalty/override-discount`, toast, invalidate). Backend був повністю готовий (S5-09 `GET/POST /workspace/companies/:id/loyalty`) — закрив дві свідомо відкладені S5-фічі (loyalty-override UI + per-client loyalty-view). Manager не бачить секцію (бек 403→`enabled:!isManager`); реальні дані, 0 моків. Гейт: type-check 23·lint 14·build 14·test (api 499). _(Edit-member лишається backend-blocked: нема PATCH-ендпоінту member-role/department/zeroCost.)_

- **Харден `profile/notifications` (07/13) — backend route-тести** (`apps/api/tests/notificationPrefs.test.ts`, 10 кейсів): непокрита матриця уподобань (category×channel). **PATCH**: 401 без токена · **ADR-003 email-lock** — disable EMAIL для `auth`/`billing`→400 (без writes) · disable EMAIL для не-locked `orders` дозволено · happy зберігає матрицю (settings-upsert scoped `{profileId}`, кожен pref-row під resolved `settingsId`, не клієнтським; audit×1) · empty array→400 (min 1) · unknown category→400. **GET**: 401 · порожня матриця коли нема settings-row (без зайвого findMany) · scoped `findUnique {profileId}` + prefs за `settingsId`. Багів не знайдено. Завершує notification-блок на беку. Гейт: type-check 23·lint 14·test (api **499** unit + 148 gated)·build 14.

- **Харден 15 Bot/Telegram — backend route-тести** (`apps/api/tests/telegramProfile.test.ts`, 12 кейсів): доповнив наявний `telegram.test.ts` (bot-secret boundary) user-частиною + конфіг/reassignment-прогалинами. **connect**: 401 без токена · 503 без `TELEGRAM_BOT_USERNAME` · 200 з profile-scoped OTP-upsert (`{profileId,purpose:telegram_link}`) + `t.me/<bot>?start=<hex32>` deep-link. **status** (GET): 401 · unlinked коли нема chatId · linked+linkedAt; scoped `findUnique {profileId}`. **unlink** (DELETE): 401 · чистить лише власний bind (`updateMany {profileId}`). **link** (bot): 503 без `BOT_LINK_SECRET` · **same-length wrong secret→401** (гілка `timingSafeEqual`) · **chat-reassignment** (release з іншого профілю `where {telegramChatId, profileId:{not}}` → bind тут → OTP-burn, single-owner-інваріант) · too-short code→400. Багів не знайдено. Завершує S6-трійку (Documents+Notifications+Bot) на беку. Гейт: type-check 23·lint 14·test (api **489** unit + 148 gated)·build 14. _(Наступний кандидат: `profile/notifications` PATCH/GET — ADR-003 email-lock + profileId-scope, теж непокритий.)_

- **Харден 06 Documents — backend route-тести** (`apps/api/tests/documentsRoute.test.ts`, 14 кейсів): закрив route-level прогалину (був лише numbering-unit). Перевірено повну access-матрицю + флоу: **generate** team-only (клієнт→403, cross-tenant→403, deleted→404, no-company→400, unknown-type→400, owner→201 з tenant-bound connect agency/order/company/createdBy + number); **list** participant-scoped (чужа компанія того ж тенанта→404, не список; клієнт замовлення→200 where orderId); **pdf** order-scoped findFirst (чужий docId→404 + assert `where {id,orderId}`; HTML-fallback 200 + `X-Document-Format` коли Chromium недоступний); **send** team-only (клієнт→403, double-send→409 без 2-ї нотифікації, unknown→404, owner→sent + рівно один `document.sent` outbox). Багів не знайдено — route коректний (гарди `requireTeamOrder`/`requireOrderParticipant`); регрес-сітка на гроші/документи (доводимо рано). Гейт: type-check 23·lint 14·test (api **477** unit + 148 gated)·build 14.

- **Харден 07 Notifications — backend route-тести** (`apps/api/tests/notifications.test.ts`, 10 кейсів): закрив нульове покриття свіжого S6-модуля. Перевірено: `GET /notifications` profileId-scoped (IDOR-гард у `where` обох запитів), unread-count, hasMore через over-fetch limit+1, `before`-курсор (createdAt<), 400 на limit>50; `PATCH /:id/read` scoped `{id, profileId}` + safe no-op 200 на чужий id (без leak); `POST /read-all` тільки власні unread; 401 без токена на всіх трьох. Route коректний — багів не знайдено, це регрес-сітка. Гейт: type-check 23·lint 14·test (api **463** unit + 148 gated)·build 14. _(Наступний кандидат харден-проходу: documents route — generate/list/pdf/send мають лише numbering-unit, без route-level IDOR/role-тестів.)_

- **S7-03 (SEO-частина) — canonical + OG + sitemap-доповнення** (`apps/landing`): per-page `alternates.canonical` на всіх 7 маршрутах (статичні + blog/[slug] + services/[slug]); брендований динамічний **OG-образ** `app/opengraph-image.tsx` (термінал-естетика, **ASCII-only** текст → вбудований шрифт, **без мережевого фетчу шрифтів** = build зелений у CI; пастка: Cyrillic/`●` тригерять dynamic-font-download→400); twitter `summary_large_image` + `siteName` у layout; OG-метадані для деталі статті/послуги; sitemap → async, +`/cases` +пости блогу (через fail-soft `fetchBlogList`). Верифіковано preview (canonical/og/twitter у `<head>`, OG-образ 200 image/png, sitemap 12 URL, 0 console-err). Гейт: type-check 23·lint 14·test (api 453 unit + 148 gated)·build 14. **Лишок S7-03:** UA/EN i18n + hreflang + Lighthouse≥90.

- **S7-01 зріз 1 — лендінг термінал-shell + Hero** (`apps/landing` Next.js): порт `wf-tm-*` дизайн-системи з `design-v2` (`terminal.css`), вікно-chrome (titlebar/nav/statusbar) + Hero (ASCII-кіт · prompt · typewriter-H1 · CTA · live-статус), UA, light/dark-тогл. Верифіковано preview (light+dark+desktop, гідрація чиста). Гейт 3/3.

- **S5.6 фронт:** `/wallet`, `/loyalty`, `/finance`, `/admin-wallet`, `/payouts`, `/services`.
- **Conformance-партія** (~11 екранів): токени чартів, таби в темній темі, картки клієнтів (реальні імена + тір), email-палітра (lime/stone).
- **Approval-цикл 02-А:** team «Надіслати на погодження» → client «Погодити / Запросити правки», status-reason, UK month-picker, сід.
- **Billing:** модалка «Підтвердити оплату» (`CreatePaymentModal`), разова знижка (`DiscountModal`).
- **Finance:** експорт CSV, період 3м/6м/рік, фільтри витрат. **Orders:** канбан-дошка + таблиця (`KanbanBoard`).
- **Fix:** expense `null` endDate/vendor → 400 (`createExpenseSchema` `.nullish()`).
- **DevOps:** SPA cache-headers, idempotent staging seed, **Playwright-smoke у CI** (гейтить `build`).
- **Slice №1 — Юр-особи агенції** (LegalEntity CRUD UI у `/settings`): список + create/edit-модалка + дефолт + delete; smoke тепер **сабмітить форму**; дорогою fix `taxId` 400.
- **Slice №2 — Екран проєкту** `/projects/:id`: Білінг + **селектор юр-особи** + per-project Маржа + close-cycle (manual); рядок списку → деталь; smoke ходить у деталь.
- **Slice №3 — Orders-v2** (закрито): **Timeline-view** (бакети дедлайнів: прострочено/тиждень/пізніше/без дати) додано. _Recon показав: bulk-assign + triage-фільтр уже були в таблиці._
- **Slice №4 — Задачі замовлення** (per-order `InternalTask` kanban): таб **«Задачі»** у деталі замовлення — `todo`/`in_progress`/`done`, create/move/assign/delete; smoke додає задачу. (Recon: глобальна командна дошка backend-blocked → Фаза B.)
- **Slice №5 — Margin per-executor**: третій таб **«За виконавцями»** у `/margin` — години + собівартість + % собів. по всіх проєктах, з підсумком. (`zeroCost`-тумблер → Фаза B: його UI-дім EditMember/executor-rates ще нема.)
- **Slice №7 — Реквізити компанії** (06-Б юр-онбординг): секція **«Реквізити компанії»** у portal `/settings` — форма на `/portal/company/requisites` + isComplete-індикатор; smoke сабмітить.
- **Slice №8 — Створення замовлення** (портал + workspace): portal `/orders/new` `OrderCreatePage` + workspace `CreateOrderModal` (клієнт + **проєкт під білінг** + пріоритет + дедлайн). Розблоковує повний флоу замовлення; smoke сабмітить обидві форми. _(Був пропущений backend-ready пункт — знайдено під час тест-планування.)_

---

## ✅ Фаза A — фронт S5.6 ЗАКРИТО (2026-06-24)

Усі **backend-ready** екрани S5.6 добудовано — **8 зрізів**: юр-особи · екран проєкту `/projects/:id` ·
Orders Timeline · задачі замовлення · margin per-executor · chat-фільтр · реквізити компанії ·
**створення замовлення** (портал+workspace). **S5.6-фронт повністю закрито** (фронт + бекенд +
conformance + form-submit smoke на кожен зріз).

➡️ **Далі — S6** (Documents + Notifications + Bot) по [`TRACKER.md`](TRACKER.md). Це **новий бекенд** —
планувати окремо (інший масштаб, не «дотягнути UI»). Backend-blocked залишки — Фаза B нижче.

## 📦 Фаза B — S6+ (backend-blocked, НЕ зараз)

> Потребують **нового бекенду** → за планом S6–S13 ([`TRACKER.md`](TRACKER.md):44). Не будуємо наперед.

- **client360** (картка клієнта 360°) — потребує clients-CRUD; **рішення власника 2026-06-20: не підтягувати наперед**.
- ~~**notify-feed** (центр сповіщень)~~ ✅ **ЗАКРИТО (2026-07-04)** — read/mark-read/unread/snooze (`routes/notifications`) + bell-dropdown + inbox-таби; цей рядок був застарілим (drift-звірка r4).
- **documents-eu / PDF-движок**, **vault** (секрети), **support**, **calendar**, **testimonials**, **case-editor**.
- **Глобальна командна дошка** (`workspace-board.jsx`: team-boards, агрегація «усі команди», DnD, фільтри) — нема cross-order/team-board API (`InternalTask` лише per-order). _Per-order kanban задач уже зроблено (slice №4)._
- **Team** ростер/картка виконавця — бекенд partial, перевірити перед плануванням.
- **S6 core:** Documents + Notifications + Bot.

_Повний беклог — [`DESIGN_PHASE2_PLAN.md`](DESIGN_PHASE2_PLAN.md) Трек B/C. Пер-екранний стан — [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md)._

## 🛠 Інфра / DevOps — відкладений блок (НЕ зараз)

> Серверний аудит 2026-06-26 ([`AUDIT_INFRA_DEVOPS_2026-06.md`](AUDIT_INFRA_DEVOPS_2026-06.md), беклог-секція в
> [`BACKLOG.md`](BACKLOG.md)). Механіка деплою сучасна; прогалина — **операційна стійкість** (DR/бекапи/моніторинг).
> **Рішення власника 26.06: весь блок у беклог.** **Тригер промоуту: перед першим зовнішнім платним тенантом.**
> Коли візьмемо — фазами, перший зріз **INFRA-DR1** (DR/бекапи P0 — єдине з ризиком незворотної втрати даних).

| Фаза | Зріз (код у BACKLOG)                                                                                                                                                                    | Пріоритет |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1    | ~~INFRA-DR1~~ ✅ repo-частина 03.07; лишилась серверна активація (крок 7 ранбука)                                                                                                       | P0        |
| 2    | **INFRA-DR2** infra-as-code (Ansible/cloud-init)                                                                                                                                        | P0        |
| 3    | **INFRA-OBS1** ✅ Sentry (`observability/sentry.ts` — api+worker+streams+ErrorBoundary); лишилось: **uptime-моніторинг + notify-on-failure**                                            | P1        |
| 4    | **INFRA-SEC1/2** appleboy (SSH-key) запінено по SHA (r3); лишилось: **пін actions/docker/pnpm** (ще floating `@v`) · **SSH-fingerprint/known_hosts** · edge security-headers+rate-limit | P0/P1     |
| 5    | **INFRA-OPS1** ✅ `health→/ready` (`routes/health.ts`); лишилось: **staging-rollback** (prod auto-rollback уже є)                                                                       | P1        |
| 6    | **AR-50b / CI-D1** multi-stage api + affected-build + promotion                                                                                                                         | P1/P2     |
| 7    | **INFRA-DOC1** OPS_RUNBOOK + DISASTER_RECOVERY + §5-дрифт                                                                                                                               | P1        |

## 🧱 Правила черги

- **Строго по фазах.** Фаза A до кінця → потім S6. Backend-blocked не тягнемо наперед.
- Наступний зріз — завжди **верхній у Фазі A**. Якщо в recon виявиться, що бекенду нема → опускаємо у Фазу B і беремо наступний.
- **Conformance-RISK (47 екранів)** вплітаємо у відповідний модуль-зріз, не окремим «косметичним» спринтом.
- Внутрішні проєкти, flat `/settings`→sub-tabs — у відповідні зрізи Фази B / рефактор (`DESIGN_COVERAGE.md`, рішення 2026-06-24).
