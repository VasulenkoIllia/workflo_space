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
3. **Помітність таймера часу.** Лог працює (workspace → замовлення → таб «Час»), але неочевидний. → винести «засікти час» помітніше у деталі замовлення. _(пов'язано з таймером T2, п.7)_
4. **Портал: «Немає активної компанії».** Акаунт без компанії-клієнта (напр. owner у порталі) → червона помилка замість мʼякого стану «акаунт не привʼязаний до компанії». → грейсфул empty-state на `portalSummary`/wallet/referral 400.
5. ~~**Канбан DnD**~~ — ✅ зроблено (drag карток між колонками статусів, 2026-06-24).
6. **Портал «Проєкти»** — заглушка, backend-blocked → Фаза B (S6+).
7. **Реальний таймер часу (T2) — backend-first, НЕ збудовано.** Дизайн+доки ([`02-orders.md`](modules/02-orders.md):257-294) описують: floating timer-bar, **1 активний таймер на виконавця** глобально (старт нового → auto-stop старого + коментар), auto-stop 8год (cron C15), + ручний ввід. Зараз — лише **проста ручна модель `hours`** (без `startedAt/endedAt`, без one-active index, без start/stop ендпойнтів). → міграція `TimeLog`→таймерна модель + `/timer/start|stop` + partial-unique index + cron + UI. **Фаза B / окремий зріз** (це новий бекенд, не «дотягнути UI»).
8. **Деталь замовлення v2 — розбіжність з дизайном.** Дизайн ([`product-app.jsx`](../design-v2/project/product-app.jsx):622): таби **Огляд · Чат · Час · Специфікація · Файли · Документи · Activity** + floating timer; задачі — в **глобальній «Дошці задач»** (`workspace-board.jsx`, лівий нав), НЕ в замовленні. Збудовано: Чат · **Задачі** · Файли · Час. → per-order «Задачі» — **перехідна заглушка** (slice №4, бо глобальна дошка backend-blocked: нема агрегуючого `/workspace/tasks`); end-state = прибрати «Задачі» з замовлення, додати **Огляд/Специфікація/Документи** таби + збудувати глобальну «Дошку задач». **Фаза B.**

## ✅ Готово нещодавно (не брати вдруге)

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
