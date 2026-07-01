# 🧭 ROADMAP — операційний пульт workflo.space

> **Єдине місце, яке відкриваєш щодня.** Що в роботі, що далі, у якому порядку. Кожен зріз їде по
> **Definition of Done** ([`ENGINEERING_STANDARDS.md` §8](ENGINEERING_STANDARDS.md)). Стан коду —
> істина в [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md); це — **черга дій**.
> _Звірено з кодом: 2026-06-24 (кінець S5)._

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

**✅ Готове до тесту (backend+UI, на staging):**

- **Картка клієнта 360°** `/clients/:id` — таби Огляд(стати+замовлення+«потребує уваги») · Люди
  (ростер + owner: **запросити** email-інвайтом / **скинути пароль** / роль / видалити) ·
  Проєкти · Фінанси(лояльність+override / маржа YTD) · Документи(PDF) · **Секрети** (owner:
  зашифрований vault — додати/показати/відкликати/видалити) · Реквізити(read + agency
  edit-on-behalf). Manager бачить лише Огляд. _Тест: у клієнта з ≥1 користувачем — «Запросити
  учасника» → лист-інвайт на портал; прийняти інвайт → зʼявляється в ростері як «учасник».
  «Скинути пароль» → користувач отримує лист скидання (сам задає новий, агенція його не бачить).
  «Секрети» → додати секрет → «показати» (розшифровує, авто-ховається 20с) → відкликати/видалити.
  ⚠️ потребує `CREDENTIALS_KEK_BASE64` у staging-env (`openssl rand -base64 32`), інакше reveal 503._
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
- **Картка 360° — 7-й таб «Секрети» (vault) — MVP збудовано** (модуль 17, agency-side):
  список/додати/показати(reveal)/відкликати/видалити, envelope AES-256-GCM (KEK у env).
  Відкладено: 2FA-challenge на reveal, executor scoped-share, нагадування про ротацію, portal
  self-service, глобальний крос-клієнтський список. **Reveal деградує до 503 без `CREDENTIALS_KEK_BASE64`.**
- **Фронт перевірявся type-check/lint/build** (фронт-тести не пишемо за рішенням власника) —
  ручний прохід вживу потрібен саме тут.
- **Багато екранів backend-blocked** (documents-EU-PDF, calendar, support, in-app-нотиф-feed
  rich) — заглушки by-design; вести [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md) на проході.

**📌 Що варто доробити далі (черга після тесту):**

1. **Лендінг EN-i18n + рестрктуризація** (коли визначиш фінальні тексти/структуру) → Lighthouse≥90.
2. **Leads-добудова** — ✅ lead-detail, ✅ lost-reason при drag, ✅ % конверсії; лишок: пайплайн-редактор, UTM з contact-форми, activity-timeline.
3. **Vault/Секрети (модуль 17)** — ✅ agency-side MVP збудовано. Лишок: 2FA на reveal, executor-share, ротація-нагадування, portal self-service (17-А), глобальний список (17-ГЛОБАЛ), типізовані шаблони (17-Д), журнал доступів клієнту (17-Б).
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
- **notify-feed** (центр сповіщень) — модель є, read/mark-read API нема.
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

| Фаза | Зріз (код у BACKLOG)                                                            | Пріоритет |
| ---- | ------------------------------------------------------------------------------- | --------- |
| 1    | **INFRA-DR1** restore.sh + drill + офсайт restic + uploads-volume               | P0        |
| 2    | **INFRA-DR2** infra-as-code (Ansible/cloud-init)                                | P0        |
| 3    | **INFRA-OBS1** Sentry + uptime + notify-on-failure (⊃ OPS-D1)                   | P1        |
| 4    | **INFRA-SEC1/2** пін екшенів+SSH-fingerprint · edge security-headers+rate-limit | P0/P1     |
| 5    | **INFRA-OPS1** staging-rollback + health→/ready                                 | P1        |
| 6    | **AR-50b / CI-D1** multi-stage api + affected-build + promotion                 | P1/P2     |
| 7    | **INFRA-DOC1** OPS_RUNBOOK + DISASTER_RECOVERY + §5-дрифт                       | P1        |

## 🧱 Правила черги

- **Строго по фазах.** Фаза A до кінця → потім S6. Backend-blocked не тягнемо наперед.
- Наступний зріз — завжди **верхній у Фазі A**. Якщо в recon виявиться, що бекенду нема → опускаємо у Фазу B і беремо наступний.
- **Conformance-RISK (47 екранів)** вплітаємо у відповідний модуль-зріз, не окремим «косметичним» спринтом.
- Внутрішні проєкти, flat `/settings`→sub-tabs — у відповідні зрізи Фази B / рефактор (`DESIGN_COVERAGE.md`, рішення 2026-06-24).
