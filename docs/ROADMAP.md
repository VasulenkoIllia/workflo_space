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
- **Частина екранів backend-blocked** (documents-EU-PDF, rich announcement-feed) — заглушки
  by-design; вести [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md) на проході. _(calendar·support уже
  збудовані MVP — див. «Готово нещодавно»; звірка дрифту r5 2026-07-08.)_

**🧭 Integrations (27) — ВІДКЛАДЕНО (рішення власника 2026-07-07).** Публічне API + inbound/outbound
webhooks + ApiKey беремо **лише коли система цілісна**: клієнти чіпляють зовнішнє до готового
продукту, а не до рухомого контракту. Заглушка `/settings/integrations` лишається by-design. До того —
доводимо ядро до цілісності (гроші/приймання/payroll/картки), а не нові зовнішні поверхні.

**🧭 ПЛАН (рішення власника 2026-07-10):** черга — ✅ **agency_members RLS** (10.07) →
✅ **S7-05 міні-CMS** (10.07; кейс-едітор Фази B влився сюди) → **дизайн-хвости Фази B**:
✅ **team-boards + task-columns** (10.07) → ✅ **team-картка (12-В KPI)** (10.07) →
✅ **testimonials** (11.07) → ✅ **announcement-feed** (11.07) → ✅ **documents-eu (06-Е EU-комплект + 06-Д публічний рахунок)** (11.07) —
**дизайн-хвости Фази B закрито повністю** → **S9–S13 Enhancement** (черга власника 2026-07-11):
✅ **податок-на-дохід S13-06ч** (11.07) → ✅ **відпустки S13-04/05** (11.07) → ✅ **notify-пакет S12-03/06** (11.07) →
✅ **залежності замовлень + gantt S10-03** (11.07) — **черга №1 закрита 4/4**.
**Черга №2 (вибір власника 11.07):** ✅ **bulk-розсилки S12-07** (11.07) → ✅ **retention-дашборд S11-07** (11.07) →
**email-inbound → тікет S12-05** → **пакет дрібних хвостів** (hireDate-форма · thumbnails · GDPR-export).
**SaaS (S14) — лише коли все повністю працює і зафіксовано.**

**📌 Що варто доробити далі (черга після тесту):**

1. **Лендінг EN-i18n + рестрктуризація** (коли визначиш фінальні тексти/структуру) → Lighthouse≥90.
2. **Leads-добудова** — ✅ lead-detail, ✅ lost-reason при drag, ✅ % конверсії, ✅ **UTM з contact-форми** (05.07), ✅ **activity-timeline** (05.07); лишок: пайплайн-редактор (custom-стадії — окремий зріз зі схемою).
3. **Vault/Секрети (модуль 17)** — ✅ agency-side MVP + ✅ глобальний список (17-ГЛОБАЛ) + ✅ журнал доступів owner-facing (17-Б) + ✅ **portal self-service (17-А)** + ✅ **журнал клієнту (17-Б portal-side)** + ✅ **типізовані шаблони (17-Д)** + ✅ **executor-share (17-SHARE)** + ✅ **TOTP-first step-up на reveal** + ✅ **ротація-нагадування (17-РОТАЦІЯ)** (усі 05.07 — **модуль 17 закрито повністю**). _Примітка: каталог типів 17-Д — тимчасовий з design-v2, фінальний перелік від власника підміняється у `VAULT_RESOURCE_TYPES` (@workflo/types)._
4. ✅ **Member-mgmt write — зроблено** (owner-only, email-флоу): invite client member (POST `…/members/invite`, reuse portal-accept) + reset-password on-behalf (POST `…/members/:profileId/reset-password`, reuse forgot-password machinery).
5. **DR/інфра-блок** (беклог) — перед першим зовнішнім платним тенантом (див. нижче).

---

## 🔧 Зараз у роботі

- **S6 ✅ ядро закрито** (Documents + Notifications + Bot, на staging). Власник — **легкий sanity-тач** незворотних флоу (документ → надіслати → клієнт отримав + нотифікація; Telegram-лінк), НЕ вичерпний поштучний тест.
- **🧭 Режим тестування (рішення власника 2026-06-26):** per-slice безпека = **автогейт (type-check+lint+test) + Playwright-smoke у фоні** на кожен пуш. **Комплексний наскрізний тест + точкові правки логіки/фронту — на milestone S8** (QA + перший клієнт), коли вертикалі цілісні (багато фіч backend-blocked → розблокуються потім). Презентацію/UX відкладаємо туди; **гроші · документи · нотифікації · схему/контракти доводимо рано** (дорого ретрофітити). На S8-проході вести [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md), щоб відрізняти «заглушка by design» від багу.
- **➡️ S7 у роботі** (публічний сайт; [`TRACKER.md`](TRACKER.md) S7-01…04 — без CMS/chat-hub за scope-рішенням). **✅ Homepage ПОВНА (9/9 секцій):** Hero · Partners · Cases · Scale · Services · Process · Spotlight · About · Contact (термінал-shell, ported `wf-tm-*`, UA, light/dark, typewriter; гімікі-boot/sound/accent/CRT відкладено в polish). **✅ Contact API** (`POST /content/contact`, honeypot+rate-limit, ContactForm). **✅ Вторинні сторінки** (/services /about /contact /blog /cases через TermPageShell) + blog-read API + seed. **✅ SEO (S7-03 частина):** sitemap (static+services+blog-posts+/cases) · robots · metadataBase · per-page **canonical** · брендований динамічний **OG-образ** (`opengraph-image.tsx`, ASCII-only → network-free build) + twitter-карта · OG для blog/service detail. **Далі:** UA/EN i18n (+ hreflang, доносить решту S7-03) → Lighthouse≥90.
- **🧭 CMS-scope (рішення власника 2026-06-27; ✅ S7-05 ЗБУДОВАНО 10.07):** «міні-CMS» = керування **блогом + кейсами** з workspace `/content` (+AI-генерація) — **зроблено** (див. «Готово нещодавно»). **Homepage-копірайт лишається в коді** (статика `content.ts`; рідкі зміни через деплой), НЕ редагується з адмінки. Повний landing-CMS (кожна секція з адмінки) = **S14 SaaS «лендінг-пресети+міні-CMS»** (11-ПРЕСЕТИ), не зараз.

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

## 🔭 Пост-аудит r6 (2026-07-12) — черга доробок (не зараз, за пріоритетом)

> Повний звіт — [`AUDIT_2026-07-12.md`](AUDIT_2026-07-12.md). Усі підтверджені **баги**
> вже виправлено (H1-H3, M1-M7 — див. «Готово нещодавно»). Нижче — свідомо відкладене.

- **Рефактори модульності** (борг чистоти, не баги): ~~R1~~ ✅ (2026-07-12) гейти старту/
  settlements/нотифай-фан-аути → `services/orderTransition.ts`, роут 419→245 рядків;
  ~~R2~~ ✅ (2026-07-12) `documents.ts` (688) розбито на `orderDocuments`/`contracts`/
  `companyDocuments` + `nextDocumentNumber` → `services/documentNumber.ts` (cron→route
  inversion виправлено); ~~R3~~ ✅ `services/recipients.ts` (аудиторії owner/reviewer/staff/
  client + fanOut; заразом закрито LOW «notifyTeamOfInbound повз withTenant»); ~~R4~~ ✅
  `cron/makeCron.ts` (13 крон-файлів без boilerplate, msUntilUtc/DAY_MS спільні;
  recurringCharges — свідомо особливий); ~~R5~~ ✅ `AnnouncementBanner`+read-хуки → app-core
  (shim-и за старими шляхами); ~~R6~~ ✅ `requireOwnerAgency` в auth/tenant.ts (20 файлів
  делегують, доменні 403-меседжі збережено; pnl-гейт уніфіковано). **Рефактор-блок закрито.**
- ~~**LOW-hardening**~~ ✅ **закрито повністю:** inbound per-poll cap 200 + DKIM-surface —
  у ХВОСТИ-2 (2026-07-13, див. «Готово нещодавно»); `notifyTeamOfInbound` через withTenant —
  закрито R3 (recipients-хелпер).
- **SaaS-era гейти (→ S14):** `blog_posts`/`testimonials`/`cms` під `isAgencyOwner`, а не
  `platformAdmin` — при мульти-агенційному онбордингу окрема platform-admin роль; inbound
  потребує per-agency alias/mailbox для однозначного маршрутингу (зараз одна платформна скринька).
- **RLS:** полісі на 100% tenant-таблиць (вкл. `agency_members` — закрито 2026-07-10,
  міграція `20260710_agency_members_rls`). Відкритим лишається лише **системний enforce-flip**
  (`RLS_ENFORCED=true` + `workflo_app`-роль + `DATABASE_APP_URL`) — перед першим зовнішнім тенантом.

## 🔬 Coverage-аудит (2026-07-13) — черга фіксів прогалин

> Повний звіт — [`AUDIT_2026-07-13_coverage.md`](AUDIT_2026-07-13_coverage.md). Системний прохід
> «бек ↔ фронт ↔ налаштування ↔ env» після ХВОСТИ-2. Ядро повне (нуль мертвих викликів, нуль
> TODO); прогалини по краях. Фіксимо пакетами по черзі:
>
> 1. ~~**COV-ENV**~~ ✅ (13.07) — `.env.example` розсинхрон з кодом: 3 мертві змінні (STORAGE*TYPE→STORAGE_DRIVER,
>    JWT*_*TTL→JWT_EXPIRES_IN, OPENAI→ANTHROPIC_API_KEY) + ~13 відсутніх (VAPID, INBOUND_IMAP*_,
>    ADMIN_EMAIL, API_PUBLIC_URL, UNSUBSCRIBE_SECRET, SMTP_FROM_NAME…).
> 2. ~~**COV-UX**~~ ✅ (13.07) — юзабіліті-пакет: кнопка видалення замовлення (кошик є, кнопки нема!) ·
>    календар у nav workspace · кошторис клієнту на погодженні (зараз lump-sum) ·
>    SUPPORT/CALENDAR у матрицю сповіщень · edit-UI для події/time-log/номенклатури ·
>    GDPR-export у workspace · мертвий Placeholder.tsx.
> 3. ~~**COV-SET**~~ ✅ (13.07) — налаштування: квота відпусток (зараз hardcode 24!) · approval-каскад
>    agency/company рівні · bonusCurrency у PaymentForm.
> 4. ~~**COV-PORTAL**~~ ✅ (13.07) — заглушки «Моя компанія»/«Інтеграції» в nav · `/documents` під CompanyGate.
>
> Дрібні сироти (WS-1…11) і свідомо відкладене (S7 i18n, S8 QA, S14 SaaS, інтеграції-27,
> e2e-глибина, RLS-flip) — у звіті, не в цій черзі.

## 🎨 DESIGN-ALIGN (2026-07-14) — черга вирівнювання з дизайном (рішення власника: «робимо дизайн як за планом»)

> Свіжа звірка design-v2 ↔ білд (4 рецензенти, 14.07). Ядро конформне (дошка, client-360,
> маржа, інбокс, чати, /team-адмін, лендінг-homepage 9/9); нижче — структурні розриви.
> Принцип черги: (1) щоденні екрани власника, (2) обличчя перед клієнтом (портал),
> (3) frontend-only перед backend-blocked. Піксель-поліш і гіміки — НЕ тут (S8/S14).

**Блок 1 · Workspace-щоденне:**

- [ ] **DSN-1 Дашборд власника** (M, фронт): board-slice панелі з дизайну — Прострочені ·
      На перевірці · Без виконавця · Абонплата/авто + owner action-items (підтвердження оплат,
      дебітори 7д+, нові ліди, виплати). Дані всі є.
- [ ] **DSN-2 Звіти → 6-таб хаб** (L): дизайн workspace-reports.jsx — Огляд · Виконавці ·
      Клієнти · Підрозділи · Timesheet · Audit log. Наявні картки розкласти по табах;
      нові зрізи: Підрозділи (агрегація по teams — бек-добудова), Timesheet-сітка,
      Audit log-стрічка (таблиця audit_logs Є — потрібен read-роут).
- [ ] **DSN-3 Settings → 5-таб хаб** (M): дизайн workspace-admin-settings.jsx — табування
      плаского скролу + SMTP-UI (сендер + тест-лист) + Крони-моніторинг (статуси джобів).

**Блок 2 · Портал (обличчя перед клієнтом):**

- [ ] **DSN-4 Замовлення** (M): нове замовлення → 5 нумерованих секцій дизайну
      (що потрібно · деталі+білінг · дедлайн · ФАЙЛИ-upload · канал звʼязку);
      деталь → постійний таб «Кошторис» (DTO вже віддає позиції).
- [ ] **DSN-5 Документи + Проєкти** (M/L): документи — групування по замовленнях +
      сегмент «Договори» + inline-дії; проєкти — KPI-ряд + картки + деталь-модалка +
      retainer hours-bar (бек: агрегація годин циклу).
- [ ] **DSN-6 Білінг + Гаманець + Учасники** (M): Recurring-таб білінгу; wallet
      hero-CTA layout + «Правила» (БЕЗ top-up — платіжний шлюз S14); учасники — KPI +
      пошук/фільтр + per-member активність (розширити members-DTO).

**Блок 3 · Workspace-поліш:**

- [ ] **DSN-7** (M): клієнти-список — фільтр-пілюлі + risk-бейджі (без LTV — модуль 28);
      календар — Week/Day view; notify-хаб — консолідація + «Тест»-надсилання;
      project-360 — KPI-hero + view-toggle (фронт-частина).

**Блок 4 · Лендінг:**

- [ ] **DSN-8** (M): /cases/:slug деталь + project/company-деталі (зараз dangling-якорі
      з homepage!) + бренд-404/500 + /terms + /privacy + контакт-форма (select типу + чипи).
- [ ] **DSN-9 = S7-03 i18n** (L): UA/EN + hreflang + тогл + Lighthouse≥90 — закриває S7.

**Backend-blocked / окремі рішення власника (НЕ в цій черзі):** лояльність 5-tier
(silver — міграція enum), реферали-воронка (стадії не трекаються), амендменти
замовлення («Зміни в угоді»), чек-лісти задач, clients-CRM rich (модуль 28),
wallet top-up (платіжний шлюз), booking-сторінка, mobile-shell-и (02.07),
Permissions-матриця + white-label + landing-CMS (S14).

## ✅ Готово нещодавно (не брати вдруге)

- **TEAM-ADMIN-1 (2026-07-13) — тімлід підрозділу як ЛОГІКА (рішення власника: 1 людина =
  1 команда; лід = права, не візуал).** `Team.leadId` (лід мусить бути членом команди) +
  `Project.teamId` (клієнту не віддається) — міграція `20260723_team_admin`. Права: тімлід
  налаштовує колонки СВОЄЇ дошки (чужої 403), executor бачить лише свою команду і задачі
  своєї команди/свої. UI: селект тімліда в редакторі команд (/board), бейдж «★ лід» у
  ростері, картка «Команда» на проєкті. + fix(ci): vitest 2 воркери в CI (api-сьют OOM-ив
  раннер). **TEAM-ADMIN-2 (того ж дня):** /team = «Адмін · команда» за дизайном
  workspace-admin.jsx — KPI-стріп (payroll-місяць/pending-інвайти/середня rate) + таби
  Підрозділи (картки з лідом ★ + селект) · Команда·ролі (пошук + «звітує»-ієрархія) ·
  Permissions 🔒 (S14) · Запрошення (pending-список + Resend/Cancel, нові invites-роути);
  executor-тімлід бачить read-only ростер свого підрозділу. Дизайн-розрив «Адмін · команда»
  закрито (без Permissions-матриці — свідомо S14).

- **COV-фікси (2026-07-13) — всі 4 пакети coverage-аудиту закрито одним днем.**
  ENV: `.env.example`+compose вирівняно з кодом (3 мертві змінні, ~13 відсутніх, worker-мапінги).
  UX: кнопка видалення замовлення (+кошик-флоу цілий) · календар у nav · кошторис
  клієнту при погодженні (estimateLines у clientView) · SUPPORT/CALENDAR у матриці
  сповіщень · edit-UI події/time-log/номенклатури · GDPR-export у workspace (секція
  → app-core) · мертві Placeholder-и. SET: квота відпусток у UI · approval-каскад
  3/3 рівнів (agency-дефолт + company-override роут/UI) · bonusCurrency у формі.
  PORTAL: «Моя компанія» — реальна сторінка · «Інтеграції» з nav геть (до модуля 27) ·
  /documents під CompanyGate. Коміти: 31bbb6a (док+TRACKER), 15f58b2, 8559cc7,
  45fecc3, 3513c99. Звіт: [`AUDIT_2026-07-13_coverage.md`](AUDIT_2026-07-13_coverage.md).

- **ХВОСТИ-2 (2026-07-13) — три хвости збудованих зрізів одним зрізом, усі закриті до ✅.**
  Міграція `20260722_tails2` (fresh-PG-proven, drift-clean): `profiles.phone/timezone` +
  identity-таблиця `email_suppressions` (без tenant-RLS — scoped по email, як push/refresh-токени).
  - **S9-06 · Profile.phone/timezone:** `updateProfileSchema` розширено; PATCH /profile валідує
    timezone через `Intl.DateTimeFormat` (невідома зона → 400); нова `ContactDetailsSection`
    (@workflo/app-core) — телефон + timezone-picker (`Intl.supportedValuesOf('timeZone')`),
    змонтована в settings обох апок; поля протікають у /auth/me + gdprExport allow-list.
  - **S12-05 · suppression/unsubscribe/bounce/DKIM (лишок inbound-рядка):**
    HMAC-підписаний unsubscribe-токен без стану (`@workflo/notifications`) → no-auth роут
    `/public/unsubscribe/:token` (GET HTML-підтвердження + POST one-click RFC 8058; scoped
    form-urlencoded content-parser); broadcast-листи несуть `List-Unsubscribe` +
    `List-Unsubscribe-Post` заголовки + футер-лінк; `notify()` пропускає email у suppression
    (reason `suppressed`); inbound-полер: DSN/bounce-детект (multipart/report або mailer-daemon)
    → suppress(bounce) без тікета, DKIM-fail із Authentication-Results → ⚠️ у нотифікації команди,
    per-poll cap 200 (анти-мейлбомба).
  - **S13-05 · calendar-integration відпусток:** read-side merge без dual-write —
    GET /calendar/events повертає додатковий `leaves` (approved-відсутності команди у вікні,
    лише для team-ролей; портальний клієнт не бачить); workspace місячна сітка малює read-only
    чіпи відсутності по днях (діапазон розгортається клієнтом).
  - Live-verified наживо: PATCH phone/tz + invalid-tz→400, unsubscribe GET(200)+POST-one-click(200)
    - tamper→400 + suppression-рядки, calendar leaves (Петро Виконавець vacation 07-20→07-24, клієнт
      бачить 0). Гейт turbo **37/37**, api **1052 passed**, +unit (unsubscribe-токен round-trip/tamper,
      detectBounce, notify suppression-skip).

- **АУДИТ r6 РЕМЕДІАЦІЯ (2026-07-12) — 10 багів delta-після-r5 закрито.** П'ять паралельних
  рецензентів (security/logic/DB/модульність/doc-drift) + пряма RLS-перевірка наживо. Загальний
  стан — здоровий (RLS повний, гроші коректні, delta без tech-debt). Виправлено: **H1** soft-delete
  блокера дедлочив залежні (фільтр `deletedAt` у gate/DFS/unblocked); **H2/H3** inbound крос-тенант
  (профіль у кількох агенціях → `ambiguous_tenant`; тредінг перевіряє тенант відправника →
  `wrong_tenant`); **M1** sharp `limitInputPixels` (DoS); **M2** leave approve fail-closed;
  **M3** leave TOCTOU advisory-lock; **M4** retention `lastActivity` через groupBy-max (не зрізаний
  take); **M5** order_dependencies `CHECK(orderId<>dependsOnId)` + advisory-lock (2-cycle race);
  **M6** drop мертвої `ExecutorRate.hireDate`; **M7** FK-індекси `leave_requests.reviewedById` +
  `broadcasts.createdById`. Міграція `20260721_audit_remediation`, fresh-PG-proven + CHECK
  live-verified. Гейт turbo **37/37**, api **1047**. Форвард-план — секція «Пост-аудит r6» вище.

- **ХВОСТИ-ПАКЕТ (черга №2 — 4/4, черга закрита) — три дрібні фічі одним зрізом — ЗБУДОВАНО (2026-07-12).**
  - **A · hireDate у команду (S13-04 хвіст):** знайдено латентний баг — форма ставки писала
    `ExecutorRate.hireDate`, який accrual відпустки НЕ читав (він бере `AgencyMember.hireDate`),
    тож найм ніколи не впливав на баланс. Фікс: rates POST дзеркалить дату в `AgencyMember.hireDate`
    (джерело accrual); поле «Дата найму» в RateModal + показ на картці виконавця + `hireDate`
    у ростері `/workspace/team`. Live-verify: POST rate → agency_members.hireDate = 2025-04-15.
  - **B · мініатюри зображень (S10-06ч):** `OrderFile.thumbKey` (міграція `20260720`, fresh-PG-proven);
    `services/imageThumbnail.ts` (sharp → webp ≤400px, best-effort — збій не валить upload; SVG
    свідомо пропускаємо); upload генерує+зберігає прев'ю; `GET /files/:id/thumb` віддає inline
    webp (XSS-безпечно — sharp перекодовує в растр); DTO несе `hasThumb` (не сам ключ); прев'ю
    у FilesTab (blob із auth → objectURL). Live-verify: 1000×600 PNG → hasThumb=true → thumb 200
    image/webp (валідний RIFF/WEBP).
  - **C · GDPR-export профілю (S9-06):** `services/gdprExport.ts → buildProfileExport` (профіль +
    settings + членства + свої сповіщення + свої тікет-повідомлення + відсутності; allow-list
    без passwordHash/TOTP/секретів vault); `GET /profile/export` — JSON-attachment; кнопка
    «Завантажити мої дані» в порталі /settings. Live-verify: export 200, усі ключі, **passwordHash
    відсутній**.
  - **Гейт:** turbo **37/37**, api **1043** (+8: hireDate 2, thumbnail 4, gdpr 2), drift-free,
    fresh-PG-proven, наскрізний live-verify усіх трьох проти dev-БД з прибиранням тест-стану.
  - **Черга №2 закрита (4/4):** bulk-розсилки · retention · email-inbound · хвости.

- **EMAIL-INBOUND (S12-05, черга №2 — 3/4) — лист на support-скриньку → тікет — ЗБУДОВАНО (2026-07-12).**
  Механіка **graceful-off** (як VAPID-push): без `INBOUND_IMAP_*` env полер не стартує —
  фіча вмикається лише коли власник заведе скриньку. **Покрокова інструкція власнику —
  [`EMAIL_INBOUND_SETUP.md`](EMAIL_INBOUND_SETUP.md)** (яку скриньку створити, IMAP-креденшли,
  які env додати на сервер). Міграція `20260719_inbound_email` (`ticket_messages.sourceMessageId
TEXT UNIQUE` — Message-ID: ідемпотентність полінгу + якір тредінгу; fresh-PG-proven).
  Маршрутизація `services/inboundEmail.ts → ingestInboundEmail` (чиста від IMAP, юніт-тести):
  дублікат Message-ID → skip · `In-Reply-To`/`References` збігається → дописати в тред + reopen ·
  новий тікет — відправника резолвимо email→Profile→CompanyMember→агенція (`source='email'`);
  невідомий/без компанії → skip (спам не робить тікетів); тема без `Re:`/`Fwd:`. Полер
  `cron/inboundEmail.ts` (~2 хв, single-flight): динамічний import `imapflow`+`mailparser`
  (без env не вантажаться), UNSEEN → parse → ingest у system-tx → `\Seen`; нотиф команді
  наявними `support.new_ticket`/`support.ticket_reply`. UI: бейдж «📧 email» у workspace-черзі +
  рядок на деталі тікета (`source` у TICKET_SELECT). Тести inboundEmail **11** (config graceful-off,
  create/case-insensitive/Re-strip/порожнє тіло, thread+reopen, duplicate/unknown/no-company/no-message-id).
  Live-verify проти dev-БД (реальний `ingestInboundEmail`): created (source=email, opener=клієнт) →
  thread reopen resolved→open → duplicate skip → unknown skip → cleanup. Гейт turbo **37/37**,
  api **1035**. E2E з реальною скринькою — після кроку власника (створити пошту + env).

- **RETENTION (S11-07, черга №2 — 2/4) — аналітика життєвого циклу клієнтів — ЗБУДОВАНО (2026-07-11).**
  `services/retentionReport.ts` (life-time, без вікна дат; ліміти вибірок 2k компаній /
  10k подій): тір-розподіл (канонічний порядок LoyaltyTier) · **repeat rate** (% компаній
  з 2+ замовленнями серед тих, хто має ≥1) · **медіана днів між 1-м і 2-м замовленням** ·
  **конверсія NEW→REGULAR** серед зрілих компаній (90+ днів; поріг $1000 з
  LOYALTY*TIER_THRESHOLDS_USD) · **активність** по останній події (замовлення АБО
  confirmed-платіж; без подій → createdAt, новачок ≠ churned): <60 дн active,
  60–120 at_risk, >120 churned · топ-20 клієнтів під ризиком. Роут owner-only
  `GET /workspace/reports/retention` (той самий ownerAgency-гейт, що всі звіти).
  UI: секція «Retention · життєвий цикл клієнтів» у /reports — 4 стата з підписами
  бази, тір-рядок, таблиця at-risk з лінками на картку клієнта + XLSX/CSV-експорт
  (2 аркуші). Тести retentionReport 4 (медіана парна/непарна, mature-конверсія,
  churn-класифікація 60/120 + платіж-як-активність + createdAt-фолбек, нулі без
  ділення на нуль). Live-verify: числа звірено з psql (3|2|1 → repeat 50%);
  зістарена компанія → churned 200 дн. у списку. Гейт turbo **37/37**, api **1024**.
  *Лишок рядка S11-07: Public API Swagger — свідомо у «останній» лінії webhooks/ApiKey.\_

- **BROADCAST (S12-07, черга №2 — 1/4) — bulk email-розсилки сегменту клієнтів — ЗБУДОВАНО (2026-07-11).**
  Модель `Broadcast` (forced-RLS, enum-и segment all/debtors/tier + status draft/sending/sent
  у drift; міграція `20260718_broadcasts` fresh-PG-proven). Флоу: owner-чернетка →
  preview (`resolveBroadcastRecipients`: власники компаній сегмента, дедуп по профілю;
  debtors = moneyBalance<0, tier = loyaltyTier) → send (**атомарний claim draft→sending**,
  повторний 409) → outbox `broadcast.send` → воркер `handleBroadcastSend` шле через
  `deliverToRecipients('system.broadcast')` — notify-МАТРИЦЯ: вимкнений system-email
  клієнта поважається, in-app пишеться завжди → status sent + counts. Email-шаблон
  `renderBroadcastEmail` (subject/body власника, plain-text → абзаци, повний escape).
  UI: секція «Email-розсилки» на /announcements (список зі статусами/counts, модалка
  subject+textarea+сегмент(+тір), лайв-«отримають N», send з confirm; правка/видалення
  лише чернеток). Тести broadcasts 4 (403 executor, tier-валідація, дедуп+debtors-фільтр,
  send-клейм+409, draft-only 404). Live-verify: чернетка → preview 2 → send → воркер
  sent 2/2 → in-app рядки обом власникам + **email status=sent** у notification*logs →
  повторний send 409 → executor 403. Гейт turbo **37/37**, api **1020**.
  *Ретрай-семантика воркера: обробляється лише status='sending' (після 'sent' — no-op);
  частковий ретрай з дублями малоймовірний (notify не кидає) — задокументовано.\_

- **DEPS+GANTT (S10-03, Enhancement №4 — черга закрита 4/4) — залежності замовлень + gantt-view — ЗБУДОВАНО (2026-07-11).**
  Спека 02-D повністю: модель `OrderDependency` (forced-RLS, unique пара, міграція
  `20260717_order_dependencies` fresh-PG-proven; колонки type нема свідомо — YAGNI).
  Бек: POST/DELETE `/orders/:id/dependencies` (team; self 400, дублікат 409, чужий/видалений
  блокер 404, **batch-DFS cycle-guard → 409 dependency_cycle**); DTO деталі: blockedBy/blocks/
  isBlocked; **гейт у transitionOrderStatus**: → in*progress 409 з назвами живих блокерів
  (done/cancelled = знято); при done блокера — `orders.unblocked` in-app виконавцям замовлень,
  у яких це був останній живий блокер. UI: картка «Залежності» на детальці (банер
  «заблоковано», списки чекає-на/блокує з лінками, пікер живих замовлень, видалення) +
  **gantt-бари в TimelineView /orders** (28-денне вікно, бар createdAt→dueDate, стани
  wip/soon/overdue/done, вихідні/сьогодні-маркер, легенда — за дизайном wfb-ktime інлайн).
  Тести: orderDependencies 5 (цикл A→B→C→A, гейт з назвою, клейми) + 2 патчені даблі
  (orderApproval/orders — новий запит гейта). Live-verify: цикл 409 → гейт 409 → done
  блокера → старт ок → notify «Замовлення розблоковано» виконавцю; verify-рядки прибрано.
  Гейт turbo **37/37**, api **1016**. *Порядок старт-гейтів: 02-А погодження → S10-03 блокери → 02-В аванс → 06-договір.\_

- **NOTIFY-ПАКЕТ (S12-03/06, Enhancement №3) — Web Push + тихі години + ранковий дайджест — ЗБУДОВАНО (2026-07-11).**
  **Push (S12-03):** модель `PushSubscription` (identity-scoped як refresh*tokens, endpoint
  unique, міграція `20260716_notify_pack` fresh-PG-proven); `PushAdapter` на `web-push`
  (VAPID з env `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`; без ключів — канал м'яко skipped
  `push_not_configured`); PUSH-гілка в `notify()` (payload = in_app title/body; 404/410 →
  підписка видаляється); канал увімкнено в CHANNELS-матриці; роути vapid-key +
  subscribe/unsubscribe (upsert по endpoint, ре-байнд браузера на інший акаунт);
  `sw.js` в обох апках + кнопка «Увімкнути push у цьому браузері» в налаштуваннях
  (ховається без ключів); колонка Push у матриці категорій.
  **Тихі години + дайджест (S12-06):** `NotificationSettings.quietFrom/quietTo` (Kyiv,
  вікно через північ 22→8) + `digestDaily/lastDigestAt`; у вікні НЕкритичні
  email/telegram/push скіпаються `quiet_hours` (CRITICAL_EVENTS пробивають; in_app
  завжди); cron `notifyDigest` (годинний тік, шле о 08:00 Kyiv) — один email
  `system.digest` зі списком накопичених in-app сповіщень від lastDigestAt (порожньо →
  лише зсув маркера); UI: чекбокс тихих годин з селектами годин + чекбокс дайджесту.
  ⚠️ Знахідка live-verify: `tenantScopedNotifyDb`-проксі фіксував select без
  quietFrom/quietTo → quiet мовчки не працював; виправлено і доведено наживо
  (email/telegram у логах skipped `quiet_hours`, in_app persisted). Тести: notifications 86 (8 push/quiet), api 1011 (роути 5 + digest-cron 3). Гейт turbo **37/37**.
  *Для продакшн-push: згенерувати `npx web-push generate-vapid-keys` → env API.\_

- **LEAVE (S13-04/05, Enhancement №2) — відсутності команди з accrual-балансом — ЗБУДОВАНО (2026-07-11).**
  Модель `LeaveRequest` (forced-RLS, міграція `20260715_leave` fresh-PG-proven) + enum
  LeaveType (vacation/sick/dayoff/unpaid) / LeaveStatus у drift-тесті; `AgencyMember.hireDate`
  - `Agency.vacationDaysPerYear` (24). Бек `routes/team/leave.ts`: self-service подача
    (робочі дні пн–пт, overlap-guard 409, санітарні межі), список self-vs-others (перше таке
    правило: executor лише своє), **обчислюваний баланс** (accrued = квота × повні місяці стажу
    поточного року / 12, округлення до 0.5 вниз; used/pending по vacation), approve/reject
    owner/manager (менеджер НЕ погоджує власну — лише owner; **балансовий guard 409** на
    vacation; атомарні pending-клейми), cancel автором. Нотифікації `team.leave_requested`
    (owner/manager, не собі) + `team.leave_status_changed` (заявнику) + audit на кожну дію.
    UI `/leave` «Відсутності» (nav «Команда», omx): мій баланс X з Y, мої заявки + модалка,
    черга погодження + reject-модалка з причиною (owner/manager). Тести: leave 15
    (workdays-математика, 403/409-гейти, accrual 24×6міс/12=12, self-approve заборона,
    клейм-гонка). Live-verify: баланс 0 (новачок) → approve 409 → hireDate рік тому →
    баланс 12 → approve → used 5/лишок 7 → нотифікація в БД. Гейт turbo **37/37**, api **1003**.
    _Follow-ups (свідомо, задокументовано): календар-шар approved-відсутностей ·
    capacity-зниження 23-А · свята per-agency 23-Б · Telegram-погодження 23-В · конфлікт-ворнінг 23-Г._

- **INCOME-TAX (S13-06 частина, Enhancement №1) — податок-на-дохід per-юр-особа/канал — ЗБУДОВАНО (2026-07-11).**
  Модель власника (рішення 18.06, НЕ ПДВ): податок = % від ОТРИМАНИХ платежів залежно від
  каналу (ФОП 5% / крипта-картка 0%). Міграція `20260714_income_tax` (fresh-PG-proven):
  `LegalEntity.incomeTaxPct` Decimal(5,2) + `Payment.legalEntityId` (SetNull, index).
  **Резолв при confirm** (`confirmManualPayment`): явний вибір (tenant-валідований, 404 на чужу)
  → юр-особа проєкту замовлення → дефолтна юр-особа; NULL (легасі) = без податку.
  **P&L**: лінія `income_tax` = Σ по юр-особах ((confirmed amountUsd − refund-и confirmed-платежів,
  М-1 фільтр) × ставка) — period-семантика клавбеку як у комісії (можливий відʼємний
  податок-кредит); bonus-платежі (amountUsd=0) не оподатковуються. Маржа СВІДОМО лишилась
  до-податковою (accrual vs cash — не змішуємо; окремий зріз за запитом). UI: «Податок % з
  доходу» у формі юр-особи, селект юр-особи-отримувача в модалці платежу (авто = каскад),
  стат «податок з доходу» + категорія в donut на /finance. Тести: finance 19 (4 tax),
  billing 33 (3 каскад/404). Live-verify: 1000 USD → tax 50.00 → refund 400 → 30.00 →
  повний refund → 0.00 (без подвійного віднімання). Гейт turbo **37/37**.
  _Лишок S13-06 (не цей зріз): budgets/receipts/approval-витрат; класичний VAT._

- **DOCUMENTS-EU (06-Е + 06-Д, Фаза B) — EU-комплект документів + публічна сторінка рахунку — ЗБУДОВАНО (2026-07-11).**
  Останній дизайн-хвіст Фази B. **06-Е:** `LegalEntity.docKit` (enum `DocKit` ua/eu, drift-тест)
  - `bic`; окремий EN/VAT-layout у `@workflo/templates/renderEu.ts` (Invoice · Proforma · Service
    Delivery Act · Statement of Work · Statement of Account · Service Agreement — за дизайном
    `workspace-documents-eu.jsx`, НЕ переклад UA); `buildRenderData` збирає EU-дані одразу
    EN-відформатованими (en-IE суми, '24 May 2026' дати, EN-лейбли звірки/договору/«Підстави»).
    **ПДВ display-only:** «VAT 0% — reverse charge (Art. 196, 2006/112/EC)» — типовий intra-EU B2B
    кейс, суми системи незмінні; повне VAT-числення свідомо лишається в S13-06 (рішення власника).
    **06-Д:** `Document.publicToken` (unique) → `POST/DELETE …/public-link` (team, ідемпотентно,
    audit) + no-auth `GET /public/documents/:token[.pdf]` (rate-limit 30/хв, системний RLS-контекст,
    пошук ЛИШЕ по 192-бітному токену; сторінка = документ + sticky-бар зі статусом/PDF; кнопки
    оплати нема by-design — 05-А провайдери вимкнені). UI: селект «Комплект документів» + BIC у
    формі юр-особи (settings), кнопка 🔗 на рахунках у DocumentsTab (copy-to-clipboard). Тести:
    templates 15 (8 нових EU), api `publicInvoice.test.ts` 8 (403 клієнт, ідемпотентність, no-auth
    200/404, revoke, HTML-фолбек). Міграція `20260713_documents_eu` fresh-PG-proven. Live-verify:
    EU-інвойс EN-рендер без UA-протікань, повний лінк-цикл issue→open→revoke→404 на реальній БД.
    Гейт: turbo **37/37**, api **981**.

- **ANNOUNCEMENTS (07-В, Фаза B) — оголошення агенції зі sticky-банером — ЗБУДОВАНО (2026-07-11).**
  Моделі **Announcement + AnnouncementRead** (forced-RLS; enum `AnnouncementAudience`
  team/clients/all у drift-тесті; міграція `20260712_announcements`, fresh-PG-proven). Бек
  `routes/notifications/announcements.ts`: owner-CRUD (create=чернетка · publish/unpublish ·
  archive зі stamp-once · delete) + **% прочитань** по цільовій аудиторії (team=члени агенції,
  clients=distinct-профілі компаній, all=сума) + `GET /announcements/active` (моя аудиторія,
  published, неархівні, **непрочитані**) + `POST /:id/read` (ідемпотентний upsert). UI: sticky-
  банер над контентом у **workspace і порталі** (✕ = read-receipt → банер зникає для юзера);
  owner-сторінка **/announcements** (nav «Оголошення»): список з % прочитань, publish/archive/
  delete, модалка створення з вибором аудиторії. 5 route-тестів (%, аудиторний фільтр team/client,
  read-ідемпотентність, archive stamp-once, executor 403). Гейт: turbo **56/56**, api **973**.
  Live повний цикл: create(team)→publish→executor бачить банер→✕→банер зник, адмінка 1/2=50%→
  archive→зник у всіх→delete. _Follow-up (свідомо): дайджест/пороги/DLQ-адмінка з дизайну
  workspace-notify — за потребою._

- **TESTIMONIALS (Фаза B) — відгуки клієнтів для лендінга — ЗБУДОВАНО (2026-07-11).**
  Модель **Testimonial** (platform-рівень без agencyId, як BlogPost; міграція
  `20260711_testimonials`; повний ланцюг прогнано на throwaway-PG з нуля — урок same-day-order).
  Бек `routes/content/testimonials.ts`: публічний `GET /content/testimonials` (лише published,
  featured перші) + owner-CRUD (create=чернетка · PATCH publish/featured/rating/position ·
  delete; rating 1-5 гард). UI: **таб «Відгуки» у `/content`** (стати всього·на лендінгу·сер.
  оцінка; список з зірками; модалка з зірковим пікером + featured). **Лендінг**: секція
  `# відгуки` (`cat ~/clients/feedback.log`) — client-fetch published, fail-soft (порожньо →
  секції нема; копірайт у коді, дані з API). 4 route-тести. Гейт: turbo **56/56**, api **968**.
  Live: чернетка невидима → publish → публічний GET (featured ★5 перший) → executor 403 → delete.

- **EXEC-CARD (12-В) — KPI-картка виконавця — ЗБУДОВАНО (2026-07-10).** Чесний лишок «team-картки»
  за DESIGN_COVERAGE (ростер/EditMember/компенсація/норма вже були). Бек: `GET
/workspace/executors/:id/kpi` (owner/manager; вікно дефолт = поточний місяць): hoursLogged
  (фіналізовані TimeLog) · hoursAccepted (payableHours прийнятих замовлень) · **нетто**-revenueUsd
  (confirmed − refund, семантика HIGH-2) · activeOrders · tasksDone · onTimePct (прийняті до
  дедлайну / всі з дедлайном). UI: `/team/:profileId` — шапка (аватар·роль·команда·з дати) +
  KPI-плитки + «Компенсація» (owner-only: оклад/ставка/комісія/zero-cost/норма); ім'я в ростері
  /team → лінк на картку. +2 тести (метрики+onTime 50%; executor 403 / не-член 404). Гейт: turbo
  **56/56**, api **964**. Live: KPI Петра на реальній БД (41.5 год · 5 прийнято · 3 активні).

- **TASK-COLUMNS — кастомні колонки командних дошок з МАПІНГОМ на статуси — ЗБУДОВАНО (2026-07-10,
  рішення власника).** Продуктова вимога: «в борді команди 3 своїх етапи = 1 статус в основній і
  1 у клієнтській». Модель **TeamColumn** (`kind = InternalTaskStatus` — патерн LeadStage; forced-RLS;
  міграція `20260710_team_columns`) + `InternalTask.columnId` (SetNull). **Механіка мапінгу:**
  (а) drag у кастомну колонку → сервер дзеркалить `status = column.kind` **і** `team = column.team`;
  (б) прямий рух статусу (канонічна дошка) знімає задачу з колонки іншого kind (колонка не бреше);
  (в) зміна kind колонки пере-дзеркалює статуси її задач; (г) видалення колонки → задачі у
  fallback-колонку свого kind. **Головна дошка «Усі» = 3 канонічні статуси-якорі** (свідомо не
  довільна — стабільна ціль мапінгу, як Lead.status); клієнтський рівень = статус ЗАМОВЛЕННЯ
  (задачі його не рухають — рішення власника: лише **підказка** «всі задачі виконані — можна здавати
  на приймання» в AcceptanceCard, `acceptance.allTasksDone`). Бек: lazy-seed 3 канонічних колонок
  новій команді; колонки налаштовує **owner/manager** (`POST/PATCH/DELETE /workspace/teams/:id/columns`).
  UI: таб команди рендерить ЇЇ колонки (динамічний grid + overflow), «⚙ налаштувати дошку»
  (редактор: назва + kind-селект «→ канонічний статус»), «Усі» — канонічні. +5 тестів (мірор
  columnId→status+team, зняття колонки при прямому статусі, kind-change re-mirror, дубль 400,
  executor 403). Гейт: turbo **56/56**, api **962**. Live: 6 інваріантів наскрізь (seed→кастом→
  мірор→не-бреше→re-mirror→delete-fallback).

- **TEAM-BOARDS (Фаза B) — команди агенції + таби глобальної дошки — ЗБУДОВАНО (2026-07-10).**
  Міграція `20260710_teams`: модель **Team** (agencyId·name·color·position, forced-RLS) +
  `AgencyMember.teamId` + `InternalTask.teamId` (обидва **SetNull** — видалення команди не губить
  ні людей, ні задачі). Бек: `routes/team/teams.ts` — list (команда) · create/rename/reorder/delete
  (owner; колір авто з палітри за позицією; дубль-назва 400) · `PATCH /workspace/executors/:id/team`
  (owner; чужа команда 400); дошка `/workspace/tasks` — DTO +team, фільтр `?teamId=` (`none` = без
  команди); task-PATCH приймає `teamId` (tenant-валідація). UI: **таби команд на дошці** («Усі» +
  кольорові крапки + лічильники, дизайн workspace-board.jsx), селект команди на картці, ⚙-редактор
  команд (owner); TeamPage — селект команди у члена (owner) / назва в ростері. 7 route-тестів.
  Гейт: turbo **56/56**, api **957**. Live: create «Dev»(#22c55e) → член+задача в Dev → фільтр 1/2 →
  delete → задача й член живі з teamId=null. _Follow-up (свідомо): кастомні колонки per-team
  (патерн LeadStage) + views list/timeline — за потребою._

- **S7-05 МІНІ-CMS — блог + кейси з workspace `/content` (+AI) — ЗБУДОВАНО (2026-07-10).**
  Кейс-едітор Фази B влився сюди (BlogPostType=case*study). Бек `routes/content/cms.ts`
  (owner-only, platform-рівень без tenant-шва): list-з-чернетками · full-read обидві мови ·
  create (published=false, slug kebab-гард, 409 на дубль) · update · **publish/unpublish**
  (publishedAt штампується ОДИН раз — стабільна дата) · delete · **POST generate** — AI-чернетка
  через Anthropic Messages API (`services/blogAi.ts`, fetch без SDK; env `ANTHROPIC_API_KEY`,
  модель `BLOG_AI_MODEL`∥claude-sonnet-5; без ключа → 503 з підказкою). UI: nav «Контент» (owner)
  → `/content` — список (тип·slug·статус·featured★) + publish/unpublish/delete + редактор-модалка:
  двомовні title/excerpt, контент **міні-markdown-ом** (`##`·`-`·`>`·`!`·код-фенси ↔ конвертери
  `blocksToText`/`textToBlocks` у `lib/content.ts`) рівно в block-shape лендінг-рендера, теги,
  AI-кнопка префілить форму. 6 route-тестів. Гейт: turbo **56/56**, api **950**. Live-verify:
  чернетка невидима публічно → publish → `/content/blog` list+detail (3 блоки) → generate 503
  без ключа → delete → зникла. \_Homepage-копірайт лишається кодом (рішення 27.06).*

- **RLS: agency_members tenant_isolation — ОСТАННІЙ security-борг ЗАКРИТО (2026-07-10).**
  Передіснуючий гап (відкладався r4→r5): єдина agencyId-таблиця без політики. Міграція
  `20260710_agency_members_rls` (ENABLE+FORCE+tenant_isolation, патерн решти таблиць). Перед
  міграцією проаудитовано auth-hot-path: login/refresh/switch читають memberships через **raw
  prisma без tenant-контексту** → GUC unset → `wf_in_tenant` permissive → логін неушкоджений;
  `enterAgencyContext` біндить GUC лише при `RLS_ENFORCED=true` (політика = backstop до enforce).
  **App-фікс:** `acceptInvite` біндить membership-upsert на агенцію ІНВАЙТА (`runWithAgency`) — інакше
  при enforce наявний член агенції A, приймаючи інвайт у B, впирався б у WITH CHECK. **Інтеграційний
  тест (5 інваріантів на реальному PG, роль `workflo_app`):** без GUC видно всі memberships (логін) ·
  GUC=A ховає B · WITH CHECK блокує крос-створення · invite-фікс проходить · system-bypass бачить
  усе. Гейт: turbo **56/56**, api **944 unit + 162 gated**. Live: логін owner/executor 200,
  memberships у клеймах, team-гейт 200. **RLS-покриття тепер 100% tenant-таблиць.**

- **MONEY-EDGES (2026-07-10) — добиті ВСІ відкладені краї грошового контуру (r5 «Відкладено» → 0).**
  Рішення власника: повна чистота money-контуру без known-limitations. **MED-4**: labor-запит P&L
  тепер помісячний (`GROUP BY executor, date_trunc('month')`) — «салярний червень → погодинний
  липень» дає липневу собівартість у витрати (раніше виконавець викидався по всьому вікну).
  **LOW-5**: refund no-order платежу відкочує `paymentAllocation` LIFO + перераховує статуси charge
  (`deriveChargeState`/`toStoredStatus` реюз; paid→partial→pending; written*off не воскрешаємо) —
  дунінг знову бачить борг. **Комісія-клавбек**: commissionBase = НЕТТО (confirmed − refund-клавбек;
  period-семантика: платіж з попереднього періоду АБО досі confirmed; повний refund свого ж періоду =
  нуль-нетто); база може бути від'ємною → видимий клавбек, без тихого клампу. Гейт: turbo **56/56**,
  api **944 unit + 157 gated** (+3 unit, +1 інтеграційний LOW-5 на реальному PG). Live-verify: P&L
  двомісячний SQL ✓; charge paid→partial→pending через refundPayment на реальному PG ✓; клавбек-запит
  у generate payout ✓. *У money-контурі лишився один свідомий trade-off: CRIT-1 set-once
  (недоплата видима при reopen через межу місяця) — задокументовано в transitionOrderStatus.ts.\_

- **АУДИТ r5 (2026-07-08) — ремедіація дельти `831d96e..HEAD` (48 зрізів пост-r4).** Метод: 4
  паралельні рецензенти (money-flow · tenant/IDOR · регресії · доко-дрифт), знахідки верифіковано
  власноруч. Канон: [`AUDIT_2026-07-08.md`](AUDIT_2026-07-08.md). **Виправлено (commit нижче):**
  **CRIT-1** подвійна виплата при reopen (`acceptedAt` тепер set-once — payroll-якір не зсувається у
  новий місяць); **HIGH-2** завищена виручка/маржа (часткові refund лишали Payment 'confirmed' — P&L
  і revenue-report тепер НЕТТО, мінус `PaymentRefund`); **MED-3** payout платив оклад+погодинну (тепер
  оклад XOR погодинна); **LOW-1** tickets `assignedToId` без валідації членства; **calendar-INFO**
  явний `agencyId` у team-запиті. RLS/міграції/enum-drift/нотифікації — чисто (єдиний відкладений гап
  `agency_members` RLS — передіснуючий). **Відкладено (задокументовано):** MED-4 (P&L salaried-
  виключення по вікну, не помісячно), LOW-5 (refund no-order-платежу лишає charge-стан), LOW-2 (хто
  приймає договір — будь-який член vs owner — рішення власника). Гейт: turbo **56/56**, api **939**
  (+4 тести). Live-verify: reopen не перештамповує; частковий refund $400 → P&L 1500→**1100**.

- **MONEY-LOOP: повний ростер приймання — розподіл оплати на співвиконавців і виконавців задач —
  ЗАКРИТО (2026-07-08).** Було: картка приймання показувала у звірці лише тих, хто **залогував час**
  (`TimeLog` ∪ наявні settlements) → співвиконавець без факту та виконавець окремої **задачі**
  замовлення були невидимі, оплату не розподілити (осідала на тому, хто бив час). Стало: `getOrder`
  збирає `acceptance.executors` як union **усіх причетних** — головний assignee + співвиконавці
  замовлення (`OrderAssignee`) + виконавці задач (`InternalTask.assignee` + `InternalTaskAssignee`) +
  автори `TimeLog` + наявні звірки. Owner/manager розподіляє `payableHours` per-person на будь-кого
  залученого; погодинний payroll агрегує ці рядки per-profileId. UI: у перегляді ховаємо «0 → 0», у
  редагуванні — повний ростер. **Без міграції й без зміни контракту** (`settlements[]` уже приймав
  масив; DTO-форма незмінна). Live-verify: замовлення з головним+співвиконавцем(без факту)+задачею
  (виконавець Оксана, без факту) → ростер бачить усіх 3 → звірка (Owner 2год, Оксана 3год, Петро 0) →
  `order_executor_settlements` рядки per-person → GET віддзеркалює. Гейт: turbo **56/56**, api **935**.
  _Закриває обидва «дрібні хвости money-loop»: per-executor до-оплати для задач + розподіл між
  співвиконавцями._

- **ЛІД-ПАЙПЛАЙН-РЕДАКТОР — кастомні стадії воронки (ХВІСТ-4) — ЗАКРИТО (2026-07-07).**
  Було: `Lead.status` фікс-enum, «custom per-agency pipelines = later». Стало: модель
  **LeadStage** (per-agency, `kind: open|won|lost`, position) + `Lead.stageId`. Owner додає/
  перейменовує/сортує/видаляє **open**-стадії (`/workspace/lead-stages` CRUD); won/lost —
  термінальні (по одній, захищені; won лише через конвертацію). Дошка — динамічні колонки зі
  стадій (kind→position), DnD-move через stageId; редактор стадій ⚙ на дошці (owner). `Lead.status`
  лишився coarse-прапорцем (new/won/lost), синхронізованим зі stage.kind → конверсія/звіти без
  рефактору. Видалення open-стадії переносить її ліди на першу відкриту (не втрачаємо). Нові ліди
  (workspace + веб-інтейк) стартують у першій open-стадії; дефолти — lazy-seed + міграція-бекфіл
  (20260707_lead_stages, RLS). Міграція LeadStageKind (drift). Гейт: +5 unit stage-CRUD (api 934),
  turbo 56/56. Вживу: list→create «Демо»→lead-start(Новий)→move→won-guard(400)→lost+reason→
  delete-reassign→won-delete-guard(400). **Усі 4 хвости флоу закрито.**

- **ХВОСТИ ФЛОУ + hourly-cost у P&L — ЗАКРИТО (2026-07-07).** Три downstream-хвости:
  **(1)** OrdersPage — клікабельна стат-плитка «на прийманні» (лічильник review) тумблить
  фільтр status=review (швидкий доступ до черги приймання). **(2)** documentRender — акт
  погодинного разового замовлення друкує рядок «N год × ставка» з БІЛАБЕЛЬНИМИ годинами
  (прийнятими власником), а не «послуга»; номенклатура має пріоритет. **(3)** P&L —
  собівартість погодинної праці: для виконавців БЕЗ активного окладу у періоді Σ(TimeLog.hours ×
  costRateUsd) → стаття `labor_hourly`; салярні виключені (без подвійного рахунку). Раніше
  погодинники давали 0 у витратах — тепер P&L покриває і оклад, і погодинну працю. UI: стат
  «погодинна праця» + категорія в donut. Гейт: +4 unit (docRenderHours 3 + finance labor 1,
  api 929) + real-PG pnl, turbo 56/56. Вживу: салярний→laborHourly 0 (виключено); погодинний
  (4г×$30)→**laborHourly 120.00** у витратах. **Лишився хвіст: лід-пайплайн-редактор (custom-стадії).**

- **КАРТКА КЛІЄНТА 360° — таб «Активність» (останній таб дизайну) — ЗАКРИТО (2026-07-07).**
  Був єдиний backend-blocked таб client360 (нема per-client activity API). Новий
  `GET /workspace/clients/:id/activity` — **агрегований timeline**: об'єднує події замовлень
  (`ActivityLog`) + підтверджені платежі + надіслані/прийняті документи цієї компанії в один
  відсортований стрічкою фід (нормалізація → `{kind,at,title,orderId,actorName}`, серверні лейбли
  дій/типів, limit). Internal-non-manager + cross-tenant company→404. UI: таб «Активність» на
  картці (◆ замовлення / $ платіж / ¶ документ, час+актор, лінк на замовлення). **Картка 360° =
  8/8 табів дизайну** (Огляд·Люди·Проєкти·Фінанси·Документи·Активність·Секрети·Реквізити). Без
  міграції (read-only агрегація). Гейт: +4 unit (api 925), turbo 56/56. Вживу: реальна компанія
  → 9 подій (статуси+платежі 80/500+акти/рахунки), відсортовано desc, лінки на замовлення.

- **PAYROLL — погодинна оплата виконавцю (замикає money-loop приймання) — ЗАКРИТО (2026-07-07).**
  Розблоковано застаблений `hourlyEarned` (S5-D6). Місячний `ExecutorPayout` тепер:
  **paidHours** = Σ прийнятих `OrderExecutorSettlement.payableHours` по замовленнях, ПРИЙНЯТИХ
  (`acceptedAt`) у періоді → **hourlyEarned = paidHours × ExecutorRate.hourlyRate** (та сама ставка
  = собівартість години в маржі + оплата погодиннику). `billableHours` (Σ TimeLog, залоговано)
  лишився окремо для інформації. **Платимо за ПРИЙНЯТІ години, а не за сирі залоговані** — owner/тімлід
  на прийманні звірив 10 залогованих → 5 оплатних → payout 5×ставку. Міграція 20260707_hourly_payout
  (ExecutorPayout.paidHours). UI: рядок «погодинно $X (N год)» у /payouts + профілі виконавця; підказка
  ставки в TeamPage. Окладні (monthlySalary) незмінні; hourlyRate null → hourlyEarned 0. Гейт: +2 unit
  (api 921) +1 real-PG (payout.test). Вживу: прийнятий order (5 год) + ставка 30 → generate →
  **hourlyEarned 150.00 (5×30), billableHours 37.5 (залог.), paidHours 5** → UI «погодинно $150 (5 год)».
  **Відкладено:** hourly-cost у P&L (зараз лише monthlySalary; погодинники 0 у expenses — окремий зріз).
  **Integrations (27) — ВІДКЛАДЕНО** (рішення власника: лише на цілісній системі).

- **ПРИЙМАННЯ РОБОТИ + звірка годин (план/факт/білабельно/до-оплати) — ЗАКРИТО (2026-07-07).**
  Здача задачі виконавцем іде на погодження керівнику перед виставленням. На наявному статусі
  `review`: `in_progress→review` — виконавець **здає** (нотиф власникам/тімлідам); `review→done` —
  **приймає лише owner/manager** (виконавця блокує 403); `review→revision` — повернути з коментарем.
  **Розділення 4 чисел:** План (`estimatedHours`) · Факт (Σ TimeLog по-виконавцях — не редагується) ·
  Білабельно клієнту (`Order.billableHours`, погодинне → авто-рахунок і акт) · До оплати виконавцю
  (`OrderExecutorSettlement.payableHours` per-executor). `PUT /orders/:id/reconciliation`
  (owner/manager) задає білабельні + оплатні години зі знімком факту. Маржа лишається чесною
  (дохід за білабельними, собівартість за фактом → видно ефективність). Міграція
  20260707_work_acceptance (Order acceptance-поля + order_executor_settlements + RLS), нові
  notif-події orders.submitted_for_acceptance/accepted/sent_back. UI workspace: картка «Приймання
  роботи» (4 числа + розбивка по-виконавцях + Здати/Скоригувати/Прийняти/Повернути, ролезалежно).
  autoInvoice погодинне тепер = `billableHours ?? факт`. Погодинний payroll НЕ чіпали (застаблений;
  коли увімкнуть — читатиме прийняті payableHours). Гейт: +18 unit (api 920), turbo 56/56. Вживу
  (owner+executor, hourly, реальна БД): submit→notify→403-executor-accept→reconcile(факт10→білабельно5
  →оплата5)→accept→**авто-рахунок 200.00 (5×40), не факт 400**→notify. Відкладено: розподіл payout між
  співвиконавцями по payableHours (коли увімкнуть погодинну оплату); показ білабельних год у PDF-акті;
  фільтр «на прийманні» у списку.

- **МУЛЬТИВИКОНАВЦІ — кілька виконавців у замовленні/задачі — ЗАКРИТО (2026-07-07).**
  Модель «головний + співвиконавці»: `Order.assigneeId`/`InternalTask.assigneeId` лишаються
  «відповідальним» (тримає SLA/комісію/chatOwner/«мої»), а нові join-таблиці
  OrderAssignee/InternalTaskAssignee (міграція 20260707_multi_executors, RLS, unique(orderId/taskId,profileId))
  тримають ДОДАТКОВИХ співвиконавців. Бек: `PUT /orders/:id/assignees` та
  `PUT /orders/:orderId/tasks/:taskId/assignees` — замінюють повний список (валідація «член агенції»,
  головного не дублюють, notify `orders.assigned` доданим, IDOR-гард). DTO getOrder/listOrders/
  internalTasks(+board) віддають `coAssignees[]`. UI workspace: картка «Виконавці» на деталі
  замовлення (головний + чек-бокс-керування співвиконавцями), стек аватарів-ініціалів у колонці
  списку, «+N» на картках дошки задач. **Час засікає будь-який член команди незалежно** (TimeLog
  per-executor + `requireTeamOrder`) — маржа/години вже мультивиконавцеві, не чіпали. **Зустрічі
  вже мультиучасникові** (CalendarAttendee many-to-one) — не чіпали. Payout лишили на головному
  (рішення власника). Гейт: +7 unit (coAssignees.test), turbo 56/56 зелений. Вживу (owner+executor,
  реальна БД): PUT→GET(імена)→рядок у БД→in-app «Вас додано виконавцем»→400 non-member→очистка;
  UI E2E — чек-бокс toggle→PUT→БД, аватари ПВ+WO у списку. Відкладено: UI-керування співвиконавцями
  ЗАДАЧ (бекенд готовий, але окремої task-edit-поверхні у UI поки нема — лише дошка read-only+DnD);
  фільтр списку за співвиконавцем; payout-розподіл між співвиконавцями.

- **24-Ф1 CALENDAR MVP — зустрічі — ЗАКРИТО (2026-07-07).** Модуль-заглушка №2 реалізовано.
  Команда (owner/executor) планує зустрічі команда↔команда і команда↔клієнт, запрошує
  Profile-учасників; ті отримують нотиф і accept/decline. Workspace /calendar — місячна
  grid-сітка (зустрічі + дедлайни замовлень read-only проєкцією), create-модалка, деталь+cancel.
  Портал /calendar — список запрошень + відповідь. Reminder-cron за ~1год. TZ per-event (IANA).
  Моделі CalendarEvent/CalendarAttendee (міграція 20260707_calendar, RLS). **Дорогою виправлено
  загальний баг нотифікацій**: нові категорії не доходили до наявних користувачів (0 pref-рядків)
  → резолвер дефолтить IN_APP + бекфіл SUPPORT/CALENDAR. Гейт: +5 unit (api 909), turbo 56/56,
  інтеграційні 155/155. Вживу: створення→нотиф→accept→view→reminder→cancel. Відкладено Ф2:
  email-гості, recurrence, ICS, booking-лінки, відео-провайдери. **Далі — Integrations (27).**

- **29-P1 SUPPORT MVP — тікети підтримки — ЗАКРИТО (2026-07-07).** Модуль-заглушка
  реалізовано (портальний /support був Placeholder). Клієнт (будь-який учасник компанії)
  відкриває звернення поза замовленням (пресет-категорія + пріоритет), веде тред;
  команда — черга з фільтрами (status/priority/assignee), master-detail, public/internal
  реплай (leak-guard: internal-нотатки клієнту невидимі), статус/пріоритет/призначення.
  SSE-live-тред (ticketBus, chatBus-патерн), in-app нотифікації (нова категорія SUPPORT).
  Моделі Ticket/TicketMessage (міграція 20260707_support_tickets, RLS). Гейт: +5 unit
  (api 904), turbo 56/56, інтеграційні 155/155. Вживу: клієнт→команда→internal+public→
  resolved, leak-guard підтверджено в обох UI. Відкладено P2: SLA, chat-hub, convert-to-order,
  categories-CRUD, canned, KB, CSAT, email-джерело. **Далі по черзі модулів-заглушок:
  Calendar (24), потім Integrations (27).**

- **05-А (рахунок замовлення в порталі) + 05-Д (списання бонусів) — ЗАКРИТО (2026-07-07).**
  05-А (скорочено, без платіжного шлюзу за рішенням власника): на замовленні в порталі
  клієнт бачить картку «Рахунок» (сума + статус оплати) + кнопку «Оплатити» → PDF-рахунок
  - реквізити «Як оплатити». 05-Д (переозначено власником як bonus-spend): клієнт-власник
    гасить нарахування бонусами кнопкою «Оплатити бонусом» у портальному Білінгу (сервіс
    spendBonusOnCharge + роут /portal/invoices/:id/pay-with-bonus уже існували S5-08 — додано
    UI). Гейт 56/56 (лише DTO-поле paidAt; bonus-spend покритий bonusSpend.test.ts). Вживу:
    списано 80 бонусів на нарахування 120 (partial, outstanding 40); портал показав рахунок
    замовлення+реквізити і кнопку бонус-оплати. По треку 05 лишаються дрібні: 05-Е (EUR —
    курс уже синкається), 05-Ж (VAT-поля — vatRate закладено в номенклатурі), 05-З (разові
    знижки — вже є на нарахуваннях). Автосписання-з-передоплати (початкове 05-Д) — не брали.

- **05-В СТОРНУВАННЯ / ПОВЕРНЕННЯ / СПИСАННЯ — ЗАКРИТО (2026-07-07).** Закриває беклог
  B-D2 («enum refunded мертвий»). Повне+часткове повернення платежу (PaymentRefund;
  повне → status=refunded; moneyBalance-терм відкочується), списання боргу (write-off:
  status=written_off + аудит, виключається з боргу), кредит-нота (внутрішнє негативне
  нарахування, зменшує борг). Авто-клавбек company-реферального бонусу пропорційно
  поверненню (clamp до балансу референта). Клієнту летять листи (refund+write-off
  editable у 08-EMAIL; кредит-нота теж). UI на BillingPage: «Повернути»/«Списати»/
  «+ Кредит-нота» (owner-only) + бейджі повернень. Гейт: +4 інтеграційні (155), turbo
  56/56, міграція 20260707_reversals drift-free. Вживу: платіж 300 → refund 100 (баланс 400) → повний refund 200 (status refunded) → над-повернення 400 → write-off 150 (борг
  прощено) → кредит-нота 50; усі листи в Mailpit. З треку 05 «прохід власника» лишаються
  05-А (онлайн-оплата фундамент), 05-Д (автосписання з передоплати), 05-Е/Ж/З дрібні.

- **02-Б НОМЕНКЛАТУРА + КОШТОРИС — ЗАКРИТО (2026-07-07) — фінансова трійка повна.**
  Довідник офіційних позицій «згідно КВЕД» (vatRate закладено під майбутнє 05-Ж):
  обирається на замовленні/проекті — його назва друкується в рахунках/актах (одна
  позиція на всю суму, розбивка туди не потрапляє). Кошторис разового замовлення
  (к-сть × ціна, з каталогу послуг або вільним рядком) → Σ автоматично стає сумою
  замовлення; друкується у СПЕЦИФІКАЦІЇ (довільний формат). UI: довідник у /settings,
  селект номенклатури в «Оцінці» замовлення і в картці проекту, редактор кошторису
  в табі «Специфікація» безпроектних замовлень. Гейт: +4 тести (api **895**), turbo
  56/56, інтеграційні 151/151, міграція drift-free. Вживу: довідник → кошторис 400
  USD (2 позиції) → fixedPrice=400 → рахунок друкує «Консультації з питань
  інформатизації» БЕЗ розбивки, специфікація — розбивку БЕЗ номенклатури. Allowlist
  послуг per-клієнт відкладено (нема портального каталогу).

- **АВТО-РАХУНОК разових замовлень — ЗАКРИТО (2026-07-07).** Замовлення без проекту
  перейшло у «виконано» → чернетка рахунку (fixed = погоджена сума; hourly = факт
  годин × ставка) + in-app власнику «перевір і надішли»; клієнту нічого не летить
  автоматично. Генерація в outbox-воркері (durable), ідемпотентна (existing-invoice
  guard — reopen не дублює), totalAmount доштамповується для PDF. Немає суми/годин →
  замість рахунку in-app з причиною. Тумблер у /settings «Воркфлоу» (увімк. за
  замовчуванням). Гейт: +3 тести (api **891**), turbo 56/56, інтеграційні 151/151,
  міграція 20260707_auto_invoice drift-free. Вживу: клієнт створив → owner оцінив
  350 USD → review → done → INV-2026-000006 draft + сповіщення; reopen-цикл — без
  дубля. З фінансової трійки лишилась номенклатура-CRUD (02-Б).

- **05-Б ДУНІНГ — overdue-маркування + авто-нагадування про оплату — ЗАКРИТО (2026-07-07).**
  Закрито беклог B-D1 («unpaid charge вічно pending»): щогодинний cron ставить
  `overdue` нарахуванням з минулим dueDate. Ланцюжок нагадувань клієнту від dueDate
  (дефолт -3/0/+3/+7/+14, редагований у /settings; [] = вимкнено), email + in-app,
  тексти листів кастомізуються через 08-EMAIL (`billing.payment_reminder`), фази
  upcoming/due/overdue. Ідемпотентність — DunningLog unique(chargeId, stepOffset),
  надсилається лише останній насталий крок. На фінальному кроці — ескалація власнику
  (`billing.invoice_overdue`, лінк на картку клієнта). Per-company тумблер «не
  надсилати» у картці клієнта (Фінанси) — глушить лише листи. Гейт: +7 тестів
  (api **888**), turbo 56/56, інтеграційні 151/151, міграція 20260707_dunning drift-free.

- **08-EMAIL — owner-редаговані email-шаблони — ЗАКРИТО (2026-07-06).**
  `EmailTemplate` (agencyId+event+locale, RLS) + міграція 20260707_email_templates.
  Owner у /settings обирає один із 12 бізнес-листів і задає тему та вступний абзац
  окремо uk/en з `{{змінними}}` події; auth-листи не редагуються свідомо. Override
  накладається в усіх шляхах доставки: dispatchNotification, outbox-воркер (чат,
  статуси, білінг, документи) і cron місячного звіту клієнту. Порожньо = системний
  текст; «Скинути до системного» повертає дефолт. Гейт: +9 тестів (api **881**),
  turbo 56/56. Вживу: override chat.new_comment → лист у Mailpit з кастомною темою
  і вступом з підстановками; reset з UI; сліди прибрані. **Пакет «операційні
  налаштування» повний** — система готова до повного точкового тесту функціоналу.

- **06-SEND — email-вкладення PDF + портальні «Документи» — ЗАКРИТО (2026-07-06).**
  Notify-пайплайн отримав наскрізні attachments (EmailPayload → dispatchEmail →
  NotifyInput); збірка PDF-рендера винесена в services/documentRender.ts (роути + воркер
  реюзають). `document.sent` для рахунків кладе PDF у лист billing.invoice_sent (без
  Chromium — HTML-вкладення; збій рендера не валить доставку). Портал `/documents` (був
  Placeholder): GET /portal/documents — усі надіслані/прийняті документи компаній клієнта
  (вкл. зовнішні договори й місячні звіти), відкриття будь-якого типу + прийняття
  договору/акта зі списку. Payment-terms: paymentTermsDays вже редагувався в «Оплата» —
  перевірено, нового не треба. Гейт: +1 тест (api **877**), turbo 56/56, без міграцій.
  Вживу: send рахунка → лист «Рахунок INV-2026-000005» клієнту з вкладенням (8.3КБ);
  портальна сторінка зі списком і кнопкою «Прийняти» на акті; скрін; сліди прибрані.
  Пакет «операційні налаштування»: лишився зріз 4 — owner-редаговані email-шаблони.
- **06-А шаблони документів + PDF-брендинг — ЗАКРИТО (2026-07-06).** Рішення власника:
  секції з {{змінними}}, ВСІ типи, лого + акцент. Міграція `20260707_document_templates`
  (DocumentTemplate per-agency, @@unique([agencyId,type]), RLS) + Agency.pdfLogoKey/
  pdfAccentColor. Договір — редагований список секцій (заголовок + абзаци); решта типів —
  примітка (+ призначення платежу для рахунків); підстановки {{client}}/{{order}}/
  {{amount}}/{{contract}}/… (невідомий токен видимий у PDF), 2-рівнева резолюція
  agency → системний. Брендинг: лого data-URI в шапці всіх PDF + акцент замість
  системного кольору. Роути owner: document-templates GET/PUT/DELETE (GET дає типовий
  договір, префілений токенами) + pdf-branding GET/PUT(+multipart)/logo. UI: дві картки
  в /settings (редактор секцій зі збереженням сирого тексту — абзаци не зʼїдаються).
  Гейт: +5 тестів (api **876**), turbo 56/56, drift-free. Вживу: note/purpose рахунка
  підставили клієнта/замовлення/номер/дату, {{contract}} чесно дав «—» без прийнятого
  договору, акцент #FF6600 у PDF (системного нема); скрін карток; сліди прибрані.
  Пакет «операційні налаштування» далі: email-шаблони (зріз 4).
- **06-ДОГОВІР-2 — зовнішній договір + каскад гейтів + «Підстава» в PDF — ЗАКРИТО
  (2026-07-06).** Рішення власника (вікторина ×4). Міграція `20260707_external_contract`
  (Document.signedExternally/contractDate/externalUrl + задіяно storedAs).
  **(1) Зовнішній договір:** `POST /workspace/companies/:id/contracts/external` (JSON або
  multipart+PDF) — власний номер/дата/підписант/файл-або-лінк → одразу accepted; дубль
  номера 409; `GET /documents/:id/file` (ASCII-safe заголовок для «№ 8/2026»); UI в
  клієнт-360 «+ Зовнішній договір» + бейдж «зовнішній». **(2) Каскад гейтів:** effective =
  project.contractRequired ?? agency.requireSignedContract — проект «без договору»
  вимикає старт-гейт для своїх замовлень; «з договором» гейтить і без тумблера.
  **(3) П3 посилено:** білінг-гейт вимагає ПРИЙНЯТИЙ договір (чернетка не відкриває
  цикл; held-проєкти наздоганяють). **(4) «Підстава» в PDF:** рахунок/акт друкують
  «договір: Договір № … від …» (проектний → останній accepted компанії). Гейт: +5
  тестів (api **871**), turbo 56/56, drift-free. Вживу: реєстрація «№ 7/2026» (лінк) і
  «№ 8/2026» (PDF-файл, віддається назад 200), рахунок INV-2026-000003 надрукував
  «Договір № 7/2026 від 15.05.2026»; сліди прибрані.
- **06-ПІДПИС фаза 1 — прийняття документів клієнтом + договір-гейт — ЗАКРИТО (2026-07-06).**
  Рішення власника: клік + ПІБ (typed signature), скоуп договір+акт, гейт-тумблер агенції.
  Міграція `20260706_doc_acceptance`: `DocumentStatus.accepted` + Document.acceptedAt/ById/
  ByName/Ip + `Agency.requireSignedContract`. `POST /portal/documents/:id/accept {fullName}`
  (лише sent, атомарний claim, replay 409, фіксація ПІБ/час/IP/акаунт + audit) → in-app
  власникам (`documents.accepted`). Договір-гейт у transitionOrderStatus: при увімкненому
  тумблері `→ in_progress` вимагає ПРИЙНЯТОГО договору КОМПАНІЇ (рамкова семантика);
  owner-тумблер «Воркфлоу · договір» у /settings. UI: портал «Документи» — кнопка
  «Прийняти» → модалка ПІБ → бейдж «прийнято» + «✓ ПІБ» в обох апках. Гейт: +7 тестів
  (api **861**; drift-тест enum'ів заодно зловив пропущений TS DocumentType.monthly_report
  з 19-Г — синхронізовано), turbo 56/56. Вживу повний цикл: гейт 409 → створити+надіслати
  договір → клієнт прийняв з ПІБ (200, replay 409) → старт роботи 200; скрін порталу.
  КЕП/Дія.Підпис — фаза 2 (свідомо пізніше). Наступний зріз пакета: шаблони документів
  (DocumentTemplate + PDF-брендинг).
- **19-А/Б/Д — прохід власника по модулю 19 ЗАКРИТО повністю (2026-07-06).**
  **19-А «Виручка»**: `GET /workspace/reports/revenue` — по місяцях (amountUsd-база, як
  P&L/overview), по клієнтах, нові клієнти, дебіторка per-currency з віком найстарішого
  неоплаченого замовлення; блок на /reports. Маржа і завантаженість зі списку 19-А вже
  жили (/margin, план-факт byExecutor) — не дублювали. **19-Б**: CSV/XLSX-експорт тепер
  на кожному блоці /reports (виручка 3 листи, SLA, джерела лідів; години й P&L були).
  **19-Д**: `GET /workspace/reports/mom` + стрічка «місяць до місяця» на owner-дашборді
  (виручка/замовлення/ліди/години, ▲/▼-дельти, prev=0 → чесне «—»). Гейт: +3 тести
  (api **854**), turbo 56/56, без міграцій. Вживу: revenue-звіт з реальними цифрами
  (500 USD, дебіторка 3050 USD/13 днів), MoM-стрічка на дашборді збігається з curl
  (замовлення ▼80%); скріни. Лишок модуля 19 — лише конструктор звітів (SaaS-фаза).
- **19-Г місячний звіт клієнту — ЗАКРИТО (2026-07-06).** Уточнення: «по білінг-циклу»
  v1 = календарний UTC-місяць (персональні цикли — разом із 06-В). Новий
  `DocumentType.monthly_report` (company-scoped, без замовлення, номер RPT-YYYY-###### через
  DocumentCounter) + власний PDF-шаблон у @workflo/templates: нові/завершені замовлення
  (doneAt з ActivityLog) · години по проєктах · оплати · поточний борг (формула
  billing/overview, per-currency). Cron `C-client_monthly_report` (доба, lastSentAt-гейт):
  кожній АКТИВНІЙ компанії — лист із PDF-вкладенням на Company.documentEmail (+cc) або
  власникам компанії; без Chromium — HTML-вкладення. Generic `GET /documents/:docId/pdf`
  (команда крім manager / клієнт компанії) + документ у картці клієнта 360° «Документи».
  Тумблер «Місячний звіт клієнтам» у «Звіти на email» (/settings). Міграція
  `20260706_client_monthly_report`, drift-free; +5 тестів. Вживу: тумблер → cron → лист
  «Місячний звіт — червень 2026 р.» у Mailpit із вкладенням RPT-2026-000001 і реальними
  цифрами (5 замовлень, борг 3050 USD), повторний прогін чесно 0, generic-PDF відкривається
  owner'ом/клієнтом/виконавцем (200).
- **18-Б snooze — ЗАКРИТО (2026-07-06). Модуль 18 ПОВНИЙ.**
  `ConversationState.snoozedUntil` (міграція `20260706_snooze`) +
  `PUT /orders/:id/conversation {snoozeUntil}`. Активний snooze ховає тред з основних
  фільтрів хабу → фільтр «відкладені» («⏰ до HH:MM»); після настання часу тред
  повертається у «всі» з ⏰-маркером («повернути непрочитаною» = повернути в увагу),
  відкриття знімає маркер. UI: «⏰ відкласти…» (1 год / 4 год / завтра 9:00) у хедері
  чату. Workspace-only свідомо. +2 тести. Вживу: повний цикл відкласти→відкладені→зняти→
  повернувся.
- **18-А portal-inbox «Чати» для клієнта — ЗАКРИТО (2026-07-05).** Той самий
  conversations-підхід у портальному соусі: `GET /portal/conversations` — клієнтський скоуп
  (замовлення моїх компаній) і **лише публічні повідомлення** (internal-нотатки не течуть
  ані в прев'ю, ані в unread — окремий фільтр у raw-запиті, тест + live-перевірка);
  акаунт без компанії → грейсфул `[]`. UI: `/chats` у порталі (нав «Чати») —
  master-detail з портальним ChatTab, фільтри всі/архів, unread-бейджі, SSE. Бонус:
  обидва хаби отримали narrow-режим (≤720px: «список ⇄ чат», кнопка «← список»).
  Гейт: +2 тести (api **844** unit), turbo зелений. Вживу: клієнт бачить свої 2 треди
  з unread, внутрішня нотатка власника не зрушила ні прев'ю ні лічильник, відкриття
  треда гасить unread (3→2), narrow-режим на скріні. Лишок модуля 18: snooze (18-Б).
- **«Чати» — workspace-хаб розмов (модуль 18, секція «Чати») — ЗАКРИТО (2026-07-05).**
  Рішення власника: групування **клієнт → замовлення**, повний v1 «список + чат + unread».
  Бек: `GET /workspace/conversations` — треди з прев'ю останнього повідомлення,
  unread одним raw-запитом поверх OrderChatRead, ефективний відповідальний
  (chatOwnerId ?? assignee), mute/archive стан юзера, `mine`; кап 300, сортування за
  свіжістю. UI: `/chats` (усі внутрішні ролі, нав-пункт «Чати») — master-detail: зліва
  групи по клієнтах з unread-бейджами, праворуч спільний ChatTab (повний чат з mute +
  відповідальним) + архів/повернути; фільтри всі/мої/без відповіді/архів (18-В фільтр
  «мої треди» закрито); SSE обраного треда, список оновлюється кожні 30с, відкриття
  гасить unread. Гейт: +3 тести (api **842** unit), turbo 56/56, без міграцій
  (archivedAt/OrderChatRead вже були). Вживу: клієнтське повідомлення → unread=1 у хабі →
  фільтр «без відповіді» ловить тред → відповідь з хабу → unread знявся → архів/повернути
  цикл; скрін. Лишок модуля 18: portal-inbox клієнта (18-А), snooze (18-Б).
- **Звіти-надбудови S11 (модулі 19/02/26) — ЗАКРИТО (2026-07-05).** Три надбудови на
  даних цього тижня: **(1) SLA-compliance** — `GET /workspace/reports/sla` (owner):
  met/late/pending для першої відповіді і розвʼязання, % лише по «розсуджених»,
  розріз по виконавцях + список порушень; done-момент з ActivityLog (у Order нема doneAt),
  скасовані поза знаменником; блок на `/reports`. **(2) Джерела лідів (26-В)** —
  `GET /workspace/reports/lead-sources`: utmSource→manual→«(без джерела)», воронка з %
  конверсії, гроші зі сконвертованих замовлень per-currency (виставлено/оплачено, курси
  не зшиваються) + топ-кампанії; блок на `/reports`. **(3) Місячний email-дайджест
  власнику** — міграція `20260705_monthly_report` (Agency.monthlyReportEnabled/LastSentAt),
  owner-тумблер «Звіти на email» у /settings (`GET/PATCH /workspace/agency/report-settings`),
  cron `C-monthly_report` (доба) шле за попередній UTC-місяць лист `reports.monthly`
  (CRITICAL, uk/en): замовлення/оплати/години/ліди/SLA; відправка раз на місяць через
  lastSentAt-гейт. Це owner-дайджест, НЕ 19-Г (клієнтський PDF-звіт — відкритий).
  Гейт: +14 тестів (api **839** unit), turbo 56/56, drift-free. Вживу: обидва звіти
  curl+скрін /reports (SLA 100% на реальному замовленні, google/july-promo у джерелах),
  тумблер → cron → лист «Місячний звіт агенції — червень 2026» у Mailpit з реальними
  цифрами (5 замовлень), повторний прогін чесно 0 (гейт місяця).
- **Auth-пачка 01-А/Б/Г/Д (модуль 01) — ЗАКРИТО (2026-07-05).** Лишок модуля 01 — тільки
  passkeys (01-Е, SaaS-фаза). Міграція `20260705_auth_pack` (Profile: failedLoginAttempts/
  lockedUntil/pendingEmail/mustChangePassword; OtpPurpose += magic*link/email_change).
  **01-Б lockout:** 5-й фейл → лок 15→30→60 хв (прогресія, cap), під локом generic 401 і
  пароль не перевіряється (не оракул), успіх скидає. **01-А magic-link:** `/auth/magic-link`
  (3/15хв, завжди 200) → лист → `/auth/magic-login`; 2FA НЕ обходиться (challenge як після
  пароля); UI: «Увійти без пароля» на /login порталу + `/magic-login`. **01-Г зміна email:**
  re-auth паролем + confirm-лінк на НОВУ адресу (TTL 24 год) + попередження на стару
  (відхилення від спеки «підтвердження на обидві» — задокументовано в 01-auth.md); `pendingEmail`
  до підтвердження; `EmailChangeSection` (app-core) у portal /settings + workspace /profile;
  race-check зайнятості на confirm (409). **01-Д mustChangePassword:** прапорець у сесії +
  `/auth/me` → банер в обох AppLayout; зміна пароля знімає. Бонус: спільна `PasswordSection`
  в app-core — у workspace вперше зʼявилась зміна пароля (/profile). 3 нові email-шаблони
  (uk/en, CRITICAL). Гейт: +20 тестів (api **825** unit), turbo 56/56. Вживу: повний
  magic-link цикл (лист → вхід → replay 401), lockout-цикл (5 фейлів → лок → скидання),
  зміна email (2 листи → confirm → вхід новою адресою), банер+секції на скрінах.
  *Знахідка мимохідь: rate-limit віддає 500 замість 429 (error-handler) — окрема задача.\_
- **Глобальний пошук + Cmd+K (S11-01/02, модуль 16) — ЗАКРИТО (2026-07-05).**
  FTS на **expression-GIN індексах** (конфіг `simple` — безсловниковий lowercase, чесний для
  змішаної uk/en; словникового `ukrainian` у стоковому PG нема; expression-індекси не входять
  у Prisma-датамодель → drift-гейт чистий). `GET /workspace/search?q=` — 4 групи з role-скоупом
  екранів (замовлення — команда · клієнти/ліди — owner+manager · проєкти — internal-non-manager),
  top-5 на групу, останнє слово префіксно (`:*` — «лен» знаходить «лендінг»), tsquery-білдер
  ріже спецсимволи (інʼєкція неможлива). UI: `CommandPalette` розширено `onQueryChange` +
  `asyncItems` (серверні результати домішуються до локальних команд без ре-фільтру); AppLayout
  мапить групи в палітру з навігацією (⌘K → друк → Enter відкриває сутність). Гейт: +6 тестів
  (api **805** unit), turbo 56/56. Вживу: «тест» у палітрі → 3 групи (замовлення/клієнт/лід),
  скрін; API — «заявка» знаходить лід, префікс працює. Лишок 16: пошук по коментарях
  (participant-скоуп) і Meilisearch-адаптер — Phase 3.

- **SLA-політики + breach-cron (S10-02) — ЗАКРИТО (2026-07-05). Блок S10-лишків: 07+01+02 за день.**
  Канон спеки 02-orders §C: `SlaPolicy {agencyId, priority, firstResponseMins, resolutionMins}`
  (unique per-пріоритет, RLS) + `Order` += firstResponseDueAt/resolutionDueAt/firstRespondedAt/
  slaBreachedAt (міграція `20260705_sla`). **Штампування:** `services/sla.ts` на всіх 3 точках
  створення (portal create, workspace create, from-template) — нема політики → null-и, cron не
  чіпає; зміна політики заднім числом не перештамповує (свідомо). **Перша відповідь:** перший
  ПУБЛІЧНИЙ коментар команди → firstRespondedAt (updateMany-гард — лише раз). **Cron кожні
  15 хв:** прострочені first-response/resolution → slaBreachedAt + in-app `orders.sla_breached`
  власникам (нова подія; один breach на замовлення). Роути: GET/PUT/DELETE
  /workspace/sla-policies (owner-write, resolution ≥ firstResponse → 400). UI: settings-картка
  «SLA · терміни реакції» (4 пріоритети, зберегти/зняти) + картка «SLA» у сайдбарі деталі
  (дедлайни, ✓ факт відповіді, «⚠ SLA порушено»). Гейт: +5 тестів (api **799** unit; 3 старі
  моки доповнені під slaPolicy/updateMany), turbo 56/56. Вживу: політика high 60хв/8год → нове
  high-замовлення отримало обидва дедлайни. Лишок §C: % SLA-compliance у звітах — зріз 19.

- **Теги + шаблони замовлень (S10-01) і кошик відновлення (S10-07) — ЗАКРИТО (2026-07-05).**
  **S10-07:** `GET /workspace/orders/deleted` (owner, вікно 30 днів, daysLeft) +
  `POST .../restore` (поза вікном → 410 остаточно, audit `order.restored`); кнопка «Кошик» на
  /orders → модалка з відкатом. **S10-01 (канон спеки 02-orders):** міграція
  `20260705_order_tags_templates` — `OrderTag` (unique agencyId+name) + `OrderTagAssignment`
  (join несе agencyId заради уніформного RLS) + `OrderTemplate` (defaultStages/nomenclatureCode
  лежать spec-compat під майбутні зрізи). Роути: каталог тегів CRUD (owner) + `PUT
/orders/:id/tags` replace-set (команда; cross-tenant tagId → 400); шаблони CRUD (owner) +
  `POST /workspace/orders/from-template/:id` (команда; несе title/description/type/білінг —
  fixed→fixedPrice, hourly→hourlyRate). Список: `?tags=` CSV-фільтр + tags у list/getOrder DTO
  (internal-only). UI: фільтр «Тег» на /orders, картка «Теги» (чіпи+чек-пікер) у сайдбарі
  деталі, селект «З шаблону» в «Новому замовленні» (prefill + створення через from-template),
  settings-картка «Замовлення · теги і шаблони» (owner CRUD, color-picker). Гейт: +11 тестів
  (api **794** unit; 2 старі list/get-моки доповнені під tags-select), turbo 56/56. Вживу: тег →
  призначення → `?tags=`-фільтр віддає 1 замовлення з чіпом; шаблон → from-template створив
  замовлення з назвою шаблону. Чесний субсет: чіпи на канбан-картках і «зберегти як шаблон» з
  деталі — пізніше; стадії з шаблону — коли підключимо defaultStages.

- **Inbox-18 хвости: mute/archive + відповідальний за тред + «без відповіді > N год» — ЗАКРИТО (2026-07-05).**
  Міграція `20260705_conversation_state`: `ConversationState {profileId, orderId, muted,
archivedAt}` (RLS) + `Order.chatOwnerId`. **18-Б mute:** `GET/PUT /orders/:id/conversation`
  (учасник, обидві апки); заглушені випадають із fan-out `chat.new_comment` у outbox-воркері —
  **@mention пробиває mute свідомо**; archivedAt закладено під секцію «Чати». **18-В:**
  `PATCH /workspace/orders/:id/chat-owner` (команда, target-валідація; null = «авто» = перший
  assignee) + селект «відповідальний» і 🔔/🔕-тумблер у хедері чату (workspace ChatTab).
  **18-Г:** `GET /workspace/chats/unanswered?hours=` (дефолт 4) — активні замовлення, де останнє
  публічне повідомлення від клієнта старше за поріг; картка-алерт на дашборді owner/manager
  (топ-6: год · замовлення · клієнт · відповідальний). Гейт: +6 тестів (api **783** unit; +1
  мок-фікс воркера), turbo 56/56. Вживу (curl): mute persist → GET віддає ефективного
  відповідального (авто=assignee) → PATCH chat-owner → unanswered чистий shape. Чесний субсет:
  portal-mute UI і фільтр «мої треди» — разом із секцією «Чати» (беклог).

- **Vault ротація-нагадування (17-РОТАЦІЯ) — ЗАКРИТО (2026-07-05). Модуль 17 повністю закрито.**
  `credential_vault` += `expiresAt` + `rotationRemindedAt` (міграція, additive). Create-схеми
  обох роутів приймають термін; `PATCH .../expiry` (workspace owner + portal власник компанії) —
  зміна скидає вікно нагадувань. Cron daily: секрети з терміном ≤7 днів або минулим → **in-app**
  `credentials.rotation_due` власникам агенції (нова подія без email/tg-шаблонів свідомо — nag,
  не алерт; throttle 1/7днів per-секрет, cap 200/прохід). UI: спільний `VaultExpiryTag`
  (app-core) «⚠ ротація за Nд»/«⚠ протерміновано» на рядках обох апок + дія «термін» (client-360,
  /vault, портал). Гейт: +6 тестів (api 777), turbo 56/56; вживу: PATCH → DTO несе термін.

- **TOTP-step-up у vault + політика «вимагати 2FA у команди» (2FA-POLICY) — ЗАКРИТО (2026-07-05).**
  Рішення власника (вікторина): **TOTP якщо є, інакше пароль** · **owner-тумблер для команди**
  (клієнтів не стосується) · **грейс 7 днів → блок входу**. (1) **TOTP-first step-up**:
  `vaultStepUp.ts` спільний для обох vault-роутів — з увімкненим 2FA reveal вимагає код
  автентифікатора/backup (пароль → 400, даунгрейд неможливий); модалки обох апок самі
  перемикаються по /auth/2fa/status. (2) **Політика**: `Agency.requireTwoFactorAt` (міграція) +
  `GET/PATCH /workspace/agency/security` (owner-only, GET = покриття команди) + двигун
  `twoFactorPolicy.ts` на кожній видачі сесії (login/refresh/switch) і в /me. Поза грейсом —
  клейм `tfaDue` → **authenticate-гейт пропускає лише /auth/\***, решта 403 `TFA_SETUP_REQUIRED`
  (новий код). UI: картка «Безпека агенції» в /settings (тумблер + хто вже з 2FA), банер
  дедлайну, форс-екран setup замість апки; **2FA-секція додана в /profile** (була лише в
  owner-only /settings — виконавцю не було де вмикати). Гейт: +14 тестів (api **771** unit;
  4 старі моки доповнені під policy-двигун), turbo 56/56. Вживу (curl): enable TOTP → step-up
  паролем 400 «введіть код» → кодом grant; політика on → login виконавця несе
  `twoFactorSetup{deadline}`; бекдейт -8днів → `/workspace/*` 403 TFA_SETUP_REQUIRED, а
  `/auth/2fa/status` доступний. Канон: `01-auth.md §C-2`.

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

- ~~**client360** (картка клієнта 360°)~~ ✅ **ЗАКРИТО** — таб-shell + 8 табів (Огляд·Люди·Проєкти·Фінанси·Документи·Реквізити·Активність), решта write-частин по мірі появи бекенду (drift-звірка r5 2026-07-08).
- ~~**notify-feed** (центр сповіщень)~~ ✅ **ЗАКРИТО (2026-07-04)** — read/mark-read/unread/snooze (`routes/notifications`) + bell-dropdown + inbox-таби; цей рядок був застарілим (drift-звірка r4).
- ~~**vault·support·calendar·PDF-движок**~~ ✅ **ЗАКРИТО** (модуль 17 повністю · SUP-MVP 29 · CAL-MVP 24 · 06-А/06-SEND PDF). Лишок цієї лінії закрито повністю: ✅ documents-eu (11.07) · ✅ testimonials (11.07) · ✅ case-editor (у складі S7-05 CMS, 10.07).
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
