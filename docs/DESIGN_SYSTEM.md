# WORKFLO.SPACE — Design System & Coverage

> **Це головний документ зв'язку «дизайн ↔ код».**
> Версія: 1.1 · Створено: 2026-05-29 · Рішення зафіксовано: 2026-05-29 · Статус коду: snapshot на 2026-05-29 (перевіряй перед використанням)
>
> Джерело правди для візуалу — **готовий хендофф з Claude Design** у [`design/`](../design/).
> Джерело правди для статусу коду — сам код (цей файл — карта, а не заміна `git`/читання коду).

---

## 0. Як користуватися цим файлом

Цей файл відповідає на три питання:

1. **Який у нас дизайн?** → §3 (токени) + §5 (повний інвентар екранів).
2. **Що вже зроблено в коді, а що ні?** → §5 (матриця покриття) + §6 (черга коду).
3. **Я додаю фічу — чи є під неї дизайн?** → §7 (workflow-гейт). Це обов'язковий крок перед кодом.
4. **Що треба домалювати / передати дизайнеру?** → окремий файл [`DESIGN_TODO.md`](DESIGN_TODO.md) (handoff на допрацювання).

**Правило проєкту:** жоден UI не пишемо «з голови». Спочатку дивимось сюди → знаходимо екран → відкриваємо відповідний файл у [`design/project/`](../design/project/) → реалізуємо піксель-в-піксель у нашому стеку (React/Vite або Next.js) → оновлюємо статус у §5. Якщо дизайну немає — це стоп-сигнал (див. §7).

---

## 1. Джерело правди (хендофф)

Повний експорт дизайну лежить у [`design/`](../design/). Це HTML/CSS/JS-прототип (React 18 + Babel standalone, рендериться у браузері без збірки). Його **не треба запускати** — читаємо вихідний код напряму.

| Що                                       | Файл                                                                                                                                     | Призначення                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Інструкція хендоффу                      | [`design/README.md`](../design/README.md)                                                                                                | Що робити з бандлом                                 |
| **Продукт** (portal+workspace+documents) | [`design/project/workflo-product.html`](../design/project/workflo-product.html)                                                          | Головний файл — його тримали відкритим при хендоффі |
| **Лендинг**                              | [`design/project/workflo-landing.html`](../design/project/workflo-landing.html)                                                          | Маркетинг-сайт                                      |
| Реєстр екранів продукту                  | [`design/project/product-app.jsx`](../design/project/product-app.jsx)                                                                    | Список **усіх** артбордів (екран = `<DCArtboard>`)  |
| Реєстр екранів лендингу                  | [`design/project/app.jsx`](../design/project/app.jsx)                                                                                    | Артборди лендингу                                   |
| Дані-заглушки                            | [`design/project/product-data.js`](../design/project/product-data.js), [`design/project/pages-data.js`](../design/project/pages-data.js) | Моделі даних, статуси, матриці                      |
| Токени (CSS-змінні)                      | [`design/project/styles.css`](../design/project/styles.css)                                                                              | `--wf-*` змінні — джерело §3                        |
| Стилі продукту                           | [`design/project/product-styles.css`](../design/project/product-styles.css)                                                              | `.wfp-*` / `.wfd-*` компоненти                      |
| Інтент (переписка)                       | [`design/chats/`](../design/chats/)                                                                                                      | 5 транскриптів — «чому саме так»                    |

**Префікси класів** (важливо для розуміння файлів):

- `.wf-*` — лендинг + спільна основа (типографіка, кольори, кнопки).
- `.wfp-*` — продукт (portal + workspace shell, картки, таблиці).
- `.wfd-*` — документи (PDF-шаблони).

**Аркуш екранів:** ~**120 артбордів** на 4 канвасах (`portal`, `workspace`, `documents`, `brandbook`) + ~25 на лендингу.

---

## 2. ✅ Візуальна мова — ЗАФІКСОВАНО (рішення 2026-05-29)

**Офіційно:** джерело правди для візуалу — **готовий дизайн** (`design/`): **лайм-акцент** за замовчуванням, теплі **stone**-нейтралі, **Geist + JetBrains Mono + Caveat**, **термінальна естетика «Engineer's Cut»** (shell завжди у режимі A · Terminal — див. §3.6). Старий бриф (синій/Inter) — **застарілий**.

**Токени свапабельні — палітра не зашита.** У дизайні вже є **6 акцент-пресетів** + light/dark + CRT glow (§3.3) і 10 готових схем. Зміна вигляду = зміна `--wf-*` токенів, **без перемалювання екранів**. Тобто навіть синій за бажання повертається як ще один accent-пресет — це питання токена, не редизайну.

|           | Старий бриф (`docs/DESIGN_BRIEF.md` v1.0)              | **Офіційно (готовий дизайн)**                                             |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Акцент    | IBM Carbon синій `#0F62FE`                             | **Лайм `#A3D90D` / `#C5F82A`** (+5 пресетів, свапабельні)                 |
| Нейтралі  | холодні сіро-сині (`#F4F6FA`, `#E5E9F0`)               | **теплі stone** (`#FAFAF9`, `#E7E5E4`, `#0C0A09`)                         |
| Шрифт     | Inter                                                  | **Geist** (body) + **JetBrains Mono** (числа/коди) + **Caveat** (підписи) |
| Семантика | success `#24A148`, warning `#F1C21B`, danger `#DA1E28` | success `#059669`, warning `#D97706`, destructive `#DC2626`               |
| Естетика  | «Linear/Vercel clean»                                  | **«Engineer's Cut» — термінал** (режим A скрізь)                          |

**Action items:**

- [x] Затверджено: лайм + термінал (A), токен-система зі свапабельними акцентами.
- [ ] Оновити `docs/DESIGN_BRIEF.md` §4–§5: послатися на §3 цього файлу як на джерело токенів (або позначити секції superseded).
- [ ] Звірити inline-CSS email-шаблонів ([`render.ts`](../packages/notifications/src/email/render.ts)) з токенами §3 — могли бути зроблені під старі (сині) токени.
- [ ] `packages/ui`: будувати на CSS-змінних `--wf-*` (свапабельні теми), не хардкодити hex.

---

## 3. Дизайн-токени (канонічні)

Джерело: [`design/project/styles.css`](../design/project/styles.css). Тема перемикається через `data-theme`, акцент — `data-accent`.

### 3.1 Кольори — Light

| Роль              | Змінна               | Hex       |
| ----------------- | -------------------- | --------- |
| Фон сторінки      | `--wf-bg`            | `#FAFAF9` |
| Поверхня (картки) | `--wf-surface`       | `#FFFFFF` |
| Підкладка         | `--wf-subtle`        | `#F5F5F4` |
| Бордер            | `--wf-border`        | `#E7E5E4` |
| Бордер сильний    | `--wf-border-strong` | `#D6D3D1` |
| Текст основний    | `--wf-fg`            | `#0C0A09` |
| Текст вторинний   | `--wf-fg-secondary`  | `#44403C` |
| Текст muted       | `--wf-fg-muted`      | `#78716C` |
| Текст subtle      | `--wf-fg-subtle`     | `#A8A29E` |
| **Акцент**        | `--wf-accent`        | `#A3D90D` |
| Акцент-фон        | `--wf-accent-bg`     | `#C5F82A` |
| Акцент-soft       | `--wf-accent-soft`   | `#ECFCC4` |
| Destructive       | `--wf-destructive`   | `#DC2626` |
| Warning           | `--wf-warning`       | `#D97706` |
| Success           | `--wf-success`       | `#059669` |

### 3.2 Кольори — Dark

| Роль            | Змінна               | Hex       |
| --------------- | -------------------- | --------- |
| Фон             | `--wf-bg`            | `#0A0A0A` |
| Поверхня        | `--wf-surface`       | `#161616` |
| Підкладка       | `--wf-subtle`        | `#1C1917` |
| Бордер          | `--wf-border`        | `#27272A` |
| Бордер сильний  | `--wf-border-strong` | `#3F3F46` |
| Текст           | `--wf-fg`            | `#FAFAF9` |
| Текст вторинний | `--wf-fg-secondary`  | `#D6D3D1` |
| Акцент          | `--wf-accent`        | `#C5F82A` |
| Акцент-soft     | `--wf-accent-soft`   | `#3F4F0F` |

### 3.3 Акцент-пресети (6)

Перемикач `data-accent`. Джерело: `ACCENT_PRESETS` у [`design/project/product-shell.jsx`](../design/project/product-shell.jsx).

| Пресет             | Light     | Dark      | Soft (light) |
| ------------------ | --------- | --------- | ------------ |
| **lime** (default) | `#A3D90D` | `#C5F82A` | `#ECFCC4`    |
| amber CRT          | `#D97706` | `#FFB000` | `#FEF3C7`    |
| phosphor green     | `#16A34A` | `#22C55E` | `#DCFCE7`    |
| cyan               | `#0891B2` | `#22D3EE` | `#CFFAFE`    |
| magenta            | `#C026D3` | `#E879F9` | `#FAE8FF`    |
| orange             | `#EA580C` | `#FB923C` | `#FFEDD5`    |

**Default: `lime`.** Палітра свапабельна (рішення §2): інший вигляд = інший пресет або інші `--wf-*` токени, без редизайну екранів. Усі компоненти мають читати акцент через `--wf-accent` / `--wf-accent-bg` / `--wf-accent-soft`, ніколи не хардкодити hex.

### 3.4 Типографіка

- **Body / UI:** `Geist` (300–700), `font-feature-settings: 'ss01','cv11'`.
- **Mono (числа, коди, реквізити, ID):** `JetBrains Mono` → fallback `Geist Mono`. `font-feature-settings: 'tnum'`.
- **Підписи в документах:** `Caveat` (500–700), нахил −3°.
- Базовий розмір 16px, line-height 1.5. Заголовки секцій: 36px / weight 600 / letter-spacing −0.03em.
- Mono-лейбли секцій: 13px.

### 3.5 Простір, форма, рух

- **Radius:** `--wf-radius: 8px` (картки/інпути), `--wf-radius-btn: 6px` (кнопки), pills `999px`.
- **Контейнер:** max-width 1104–1200px, padding 48px; `container-type: inline-size` (адаптив через container-queries, не лише media).
- **Секція:** padding 96px, розділювач — `1px solid --wf-border`.
- **Рух:** transitions 0.15s ease-out (filter/background/border/color). Опційний `CRT glow` для термінал-режиму.

### 3.6 Естетика продукту — A · Terminal (рішення 2026-05-29)

**Офіційно: режим A · Terminal — для обох поверхонь** (portal і workspace). Shell ([`design/project/product-shell.jsx`](../design/project/product-shell.jsx)) завжди рендериться у термінал-вікні:

- macOS-вікно: traffic-dots, title-bar (`portal.workflo.space — bash`), status-bar (branch `main`, час, тема).
- `[ ... ]`-брекети навколо кнопок, `// group`-лейбли у sidebar.
- Опційний CRT glow (§3.5).

Режим **B · Studio** (чистий shell без хрому) лишається в коді лише як службовий fallback — не основний.

### 3.7 Статуси та кольорові системи (з `product-data.js`)

**Статуси замовлення (клієнтські, 9):** `new` Створено · `clarification` Уточнюємо · `estimating` Оцінюємо · `pending_approval` Очікує підтвердження · `in_progress` В роботі · `revision` Доробка · `review` На перевірці · `done` Готово · `cancelled` Скасовано. (Внутрішніх статусів — мапінг 9→client; див. `LIFECYCLE.md`.)

**Tier лояльності (5):** new (0%) · regular (3%) · silver (5%) · partner (8%) · vip (12%).

**Типи документів (5, з кольором):** INV Рахунок `#0C0A09` · ACT Акт виконаних робіт `#16A34A` · REC Акт звірки `#D97706` · SPC Специфікація `#A3D90D` · CTR Договір `#0891B2`.

---

## 4. Легенда покриття

**Дизайн** (чи намальовано): ✅ повний · ◑ частковий · ❌ немає
**Код** (чи реалізовано): ✅ реальний · ◑ частковий · 🟡 stub/заглушка · ❌ немає / scaffold

---

## 5. Матриця покриття за поверхнями

### 5.1 Загальна картина

| Поверхня                         | Дизайн          | Код | % коду | Вердикт                                       |
| -------------------------------- | --------------- | --- | ------ | --------------------------------------------- |
| Landing (`workflo.space`)        | ✅              | 🟡  | ~5%    | layout+health є, секцій немає                 |
| Portal (`portal.workflo.space`)  | ✅              | ❌  | 0%     | scaffold `App.tsx`                            |
| Workspace (`work.workflo.space`) | ✅              | ❌  | 0%     | scaffold `App.tsx`                            |
| Documents / PDF                  | ✅              | 🟡  | 0%     | `generatePdf()` кидає «not implemented»       |
| Email-шаблони                    | ❌ (немає арт.) | ✅  | ~90%   | 4 шаблони готові, **без візуального дизайну** |
| Telegram-шаблони                 | n/a (текст)     | ✅  | ~85%   | 7 рендерерів готові                           |
| Notification core                | n/a             | ✅  | ~85%   | notify/resolver/dispatch готові               |
| Shared UI (`packages/ui`)        | ✅ (brandbook)  | 🟡  | ~10%   | Button + утиліти; ~35 компонентів треба       |

### 5.2 Landing — `workflo.space`

Дизайн: [`design/project/app.jsx`](../design/project/app.jsx), [`design/project/terminal-variant.jsx`](../design/project/terminal-variant.jsx), [`design/project/terminal-pages.jsx`](../design/project/terminal-pages.jsx). Код: [`apps/landing/`](../apps/landing/) (Next.js 15).

| Екран / секція                  | Дизайн | Стани в дизайні                                                  | Код | Нотатки                          |
| ------------------------------- | ------ | ---------------------------------------------------------------- | --- | -------------------------------- |
| One-pager: hero                 | ✅     | 3 варіанти H1, light/dark, 6 акцентів, CRT glow                  | ❌  | `page.tsx` — заглушка            |
| One-pager: services             | ✅     | —                                                                | ❌  |                                  |
| One-pager: work (кейси)         | ✅     | дані з `pages-data.js` (7 проєктів)                              | ❌  |                                  |
| One-pager: process              | ✅     | —                                                                | ❌  |                                  |
| One-pager: spotlight            | ✅     | —                                                                | ❌  |                                  |
| One-pager: who (про)            | ✅     | —                                                                | ❌  |                                  |
| One-pager: contact              | ✅     | форма                                                            | ❌  | контакт-форма                    |
| One-pager: partners             | ✅     | —                                                                | ❌  |                                  |
| One-pager: scale                | ✅     | —                                                                | ❌  |                                  |
| Project page `/work/:slug`      | ✅     | problem/solution/approach/metrics/before-after/stack/testimonial | ❌  | case study, ~500–800 слів        |
| Company page `/companies/:slug` | ✅     | bio/projects/testimonial/socials                                 | ❌  | 5 компаній у даних               |
| 404 (ASCII-кіт)                 | ✅     | light/dark, акценти                                              | ❌  | `Terminal404`                    |
| Адаптив                         | ✅     | phone 375 / tablet 768 (container-queries)                       | ❌  |                                  |
| 10 колірних схем                | ✅     | theme+accent+glow                                                | ❌  | перемикач схем                   |
| Blog `/blog`, `/blog/:slug`     | ❌     | артбордів немає                                                  | ❌  | дизайн-гап → `DESIGN_TODO.md` G2 |
| Pricing / Terms / Privacy       | ❌     | артбордів немає                                                  | ❌  | дизайн-гап → `DESIGN_TODO.md` G3 |

### 5.3 Portal — `portal.workflo.space`

Дизайн: `portal-*.jsx`, `inbox-screens.jsx`, `documents-screens.jsx`. Код: [`apps/portal/`](../apps/portal/) — **лише scaffold** (`App.tsx` = `<h1>Workflo Portal</h1>`). Усі рядки нижче в коді = ❌.

**Auth** — [`design/project/portal-auth.jsx`](../design/project/portal-auth.jsx)

| Екран                 | Дизайн | Стани (артборди)                                         |
| --------------------- | ------ | -------------------------------------------------------- |
| `/login` email+пароль | ✅     | default · **error** (невірний пароль)                    |
| `/login` phone+OTP    | ✅     | крок 1 (номер) · крок 2 (код) · **error** (невірний код) |
| `/login` 2FA          | ✅     | OTP-крок після пароля                                    |
| `/register`           | ✅     | крок 1 (профіль) · крок 2 (компанія)                     |
| `/forgot-password`    | ✅     | default · **sent** (лист надіслано)                      |
| `/reset-password`     | ✅     | новий пароль                                             |
| `/invite/:token`      | ✅     | приєднання до компанії                                   |

**Orders** — [`design/project/portal-screens.jsx`](../design/project/portal-screens.jsx), [`portal-order-new.jsx`](../design/project/portal-order-new.jsx)

| Екран                    | Дизайн | Стани / таби / попапи                                                              |
| ------------------------ | ------ | ---------------------------------------------------------------------------------- |
| `/orders` список         | ✅     | filled · **empty** · **loading (skeleton)**                                        |
| `/orders/new`            | ✅     | form-based (final) · **chat-bot intake (alt)**                                     |
| `/orders/:id`            | ✅     | таби: **Чат** (+ банер `pending_approval`) · **Файли** (drag&drop) · **Документи** |
| `/orders/:id` alt-layout | ✅     | focused-варіант: таб Чат · таб Деталі                                              |

**Billing** — `portal-screens.jsx`

| Екран      | Дизайн | Стани                                                                                                      |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `/billing` | ✅     | таби: Рахунки · Платежі (loyalty/referral маркування) · Recurring; sticky-картка реквізитів; empty/loading |

**Loyalty / Referrals / Team**

| Екран        | Дизайн | Деталі                                                            | Файл                                                             |
| ------------ | ------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/loyalty`   | ✅     | 5-tier ladder, progress, історія бонусів, spending chart, правила | [`portal-loyalty.jsx`](../design/project/portal-loyalty.jsx)     |
| `/referrals` | ✅     | код+лінк, 3-step explainer, список (masked), правила              | [`portal-referrals.jsx`](../design/project/portal-referrals.jsx) |
| `/team`      | ✅     | учасники компанії + activity                                      | [`portal-team.jsx`](../design/project/portal-team.jsx)           |

**Settings** — [`design/project/portal-settings.jsx`](../design/project/portal-settings.jsx)

| Екран                     | Дизайн | Стани                                           |
| ------------------------- | ------ | ----------------------------------------------- |
| `/settings/profile`       | ✅     | особисті дані + інтерфейс                       |
| `/settings/company`       | ✅     | реквізити (owner only)                          |
| `/settings/members`       | ✅     | invite + зміна ролі                             |
| `/settings/notifications` | ✅     | матриця **14 подій × 3 канали** + тихі години   |
| `/settings/security`      | ✅     | overview · зміна номера (крок 1) · OTP (крок 2) |

**States + Overlays** — [`design/project/portal-states.jsx`](../design/project/portal-states.jsx)

| Елемент                       | Дизайн | Тип                               |
| ----------------------------- | ------ | --------------------------------- |
| 404 / 500 / 403 / Maintenance | ✅     | окремий centered-layout без shell |
| ⌘K палітра                    | ✅     | overlay глобального пошуку        |
| Bell dropdown                 | ✅     | overlay нотифікацій (4 останні)   |
| Company switcher              | ✅     | popover (3 компанії + create)     |
| New company wizard            | ✅     | модал                             |

**Mobile (native, iPhone 390×844)** — [`design/project/portal-mobile.jsx`](../design/project/portal-mobile.jsx)

| Екран                                  | Дизайн |
| -------------------------------------- | ------ |
| `/login` (номер + OTP, 2 кроки)        | ✅     |
| `/orders` + нижній tab-bar             | ✅     |
| `/orders/:id` чат + банер + input-док  | ✅     |
| `/inbox` зведений потік                | ✅     |
| `/billing` рахунки + реквізити         | ✅     |
| `/documents`                           | ✅     |
| `/loyalty`                             | ✅     |
| Bottom-sheet (перемикач компаній / Ще) | ✅     |

**Inbox** — [`design/project/inbox-screens.jsx`](../design/project/inbox-screens.jsx)

| Екран    | Дизайн | Стани                                                                                                               |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `/inbox` | ✅     | master-detail; фільтри: усі · @згадки · system; quick-reply; kind-мітки (chat/mention/status/doc/payment/marketing) |

**Documents index** — [`design/project/documents-screens.jsx`](../design/project/documents-screens.jsx)

| Екран                                       | Дизайн |
| ------------------------------------------- | ------ |
| `/documents` (список усіх док. з фільтрами) | ✅     |

### 5.4 Workspace — `work.workflo.space`

Дизайн: `workspace-*.jsx`. Код: [`apps/workspace/`](../apps/workspace/) — **лише scaffold**. Усі рядки в коді = ❌.

| Екран                   | Дизайн | Стани / таби / модали                                                       | Файл                                                               |
| ----------------------- | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/` Dashboard           | ✅     | Kanban **board / list / timeline**; естетики A+B; empty/loading             | [`workspace-screens.jsx`](../design/project/workspace-screens.jsx) |
| `/orders/intake`        | ✅     | черга нерозподілених; AI-suggest підрозділу + confidence%; **empty**        | [`workspace-tasks.jsx`](../design/project/workspace-tasks.jsx)     |
| `/orders/:id` v2        | ✅     | таби: Огляд · Час (time entries+коментарі) · Специфікація; floating timer   | `workspace-tasks.jsx`                                              |
| `/orders/:id` internal  | ✅     | 3 колонки; internal-notes (жовта стрічка 🔒)                                | `workspace-screens.jsx`                                            |
| `/inbox`                | ✅     | крос-клієнтський; open: mention / payment / order                           | [`inbox-screens.jsx`](../design/project/inbox-screens.jsx)         |
| `/companies`            | ✅     | список + activity heatmap (28 днів); **empty**                              | [`workspace-missing.jsx`](../design/project/workspace-missing.jsx) |
| `/companies/:id`        | ✅     | картка клієнта (таби)                                                       | `workspace-screens.jsx`                                            |
| `/billing`              | ✅     | overview + subtabs                                                          | `workspace-missing.jsx`                                            |
| `/billing/debtors`      | ✅     | age-кольори (свіжий/нагадування/прострочено) + dialog нагадування           | `workspace-screens.jsx`                                            |
| `/billing/payouts`      | ✅     | payroll-таблиця (rate×hours + bonuses), 6 виконавців                        | `workspace-missing.jsx`                                            |
| `/reports` (×6)         | ✅     | Огляд · Виконавці · Клієнти · Підрозділи · Timesheet · Audit log; **empty** | [`workspace-reports.jsx`](../design/project/workspace-reports.jsx) |
| `/settings/departments` | ✅     | CRUD підрозділів + create-card                                              | [`workspace-admin.jsx`](../design/project/workspace-admin.jsx)     |
| `/settings/team`        | ✅     | members + pending invites                                                   | `workspace-admin.jsx`                                              |
| `/settings/permissions` | ✅     | матриця role × permission (superadmin/lead/executor)                        | `workspace-admin.jsx`                                              |
| Модал: Invite member    | ✅     | overlay                                                                     | `workspace-admin.jsx`                                              |
| Модал: Edit member      | ✅     | role/rate/depts                                                             | `workspace-admin.jsx`                                              |
| Модал: Stop timer       | ✅     | 47:12 + опційний коментар                                                   | `workspace-tasks.jsx`                                              |
| Модал: Close task       | ✅     | спека-draft (internal tone) · **AI-polished версія**                        | `workspace-tasks.jsx`                                              |

> **Дизайн-гапи workspace (на допрацювання — `DESIGN_TODO.md` G4):** `/blog` та `/cases` (редактори контенту — у sidebar є, артбордів немає), сейф доступів `/companies/:id/credentials` (owner only). Особисті налаштування виконавця (profile/security/notifications) — ймовірно реюз патернів порталу (§5.3).

### 5.5 Documents / PDF

Дизайн: [`design/project/documents-screens.jsx`](../design/project/documents-screens.jsx) + дані в `product-data.js`. Код: [`packages/templates/src/index.ts`](../packages/templates/src/index.ts) — `generatePdf()` **кидає** «not implemented yet. Planned for Sprint 6». Усі = 🟡 (дизайн ✅, код ні).

| Документ           | Код-тип | Дизайн | Особливості                                                          |
| ------------------ | ------- | ------ | -------------------------------------------------------------------- |
| Invoice (Рахунок)  | INV     | ✅     | розбивка робіт, IBAN+USDT+**QR**, курс НБУ, lime на № і total        |
| Completion Act     | ACT     | ✅     | зелений штамп **SIGNED**, 2 підписи (Caveat)                         |
| Reconciliation Act | REC     | ✅     | помаранчевий штамп **DRAFT**, дебет/кредит/сальдо                    |
| Specification      | SPC     | ✅     | контекст/цілі/скоуп/deliverables/етапи/приймання/out-of-scope/бюджет |
| Contract           | CTR     | ✅     | рамковий, 2-колонкові статті, e-sign                                 |

**Система документів:** A4 (794×1123), margins 56/64, темна шапка таблиці, lime-акцент на № і total, watermark SIGNED/DRAFT, підпис Caveat −3°, QR (IBAN+amount+ref). UA+EN.
**Движок (рішення 2026-05-29): HTML→Puppeteer→PDF** (toolkit DocBrand/DocParties/DocSigs/DocFoot). Реюз HTML/CSS дизайну 1:1 — точне повторення мокапів (QR, watermark, Caveat). `IMPLEMENTATION_PLAN.md` (там стоїть @react-pdf/renderer) — **оновити під Puppeteer**.

### 5.6 Email-шаблони

Код: [`packages/notifications/src/email/templates/`](../packages/notifications/src/email/templates/). **Реалізовані (i18n uk/en):** `welcome`, `inviteExecutor`, `inviteCompanyMember`, `passwordReset` + рендер-хелпери (`render.ts`), mailer, i18n.

| Шаблон                             | Код | Візуальний дизайн                      |
| ---------------------------------- | --- | -------------------------------------- |
| Welcome                            | ✅  | ❌ (немає артборду)                    |
| Invite (executor / company member) | ✅  | ❌                                     |
| Password reset                     | ✅  | ❌                                     |
| Invoice email                      | ❌  | ❌ (бриф просив, немає ні там, ні там) |

> **Гап навпаки (на допрацювання — `DESIGN_TODO.md` G1):** тут код випереджає дизайн. У хендоффі **немає HTML-мокапів листів**. Треба: (1) намалювати email-шаблони у фірмовому стилі §3, (2) переписати наявний inline-CSS під токени §3 (могли робити під сині — див. §2).
> Подій нотифікацій у системі набагато більше (~21, див. `packages/types`), частина потребуватиме email-представлення згодом.

### 5.7 Telegram-шаблони

Код: [`packages/notifications/src/telegram/templates/`](../packages/notifications/src/telegram/templates/). Реалізовані: welcome, invite (×2), password reset, order status changed, new comment, invoice sent. Текстові — окремий візуальний дизайн не потрібен. Статус: ✅.

### 5.8 Shared UI — `packages/ui`

Дизайн-довідник: brandbook (`bb-foundations` + `bb-components`) — [`design/project/brandbook.jsx`](../design/project/brandbook.jsx), [`brandbook-product.jsx`](../design/project/brandbook-product.jsx). Код: [`packages/ui/src/`](../packages/ui/src/).

| Компонент                                        | Дизайн   | Код                          |
| ------------------------------------------------ | -------- | ---------------------------- |
| Button (primary/ghost/danger, sizes, A/B)        | ✅       | ◑ (є базовий, без варіантів) |
| `cn`, `useDebounce`                              | n/a      | ✅                           |
| ThemeProvider / useTheme / useMediaQuery         | потрібні | 🟡 (заглушки)                |
| Input, Textarea, Select, Checkbox, Radio, Toggle | ✅       | ❌                           |
| Badge / Pill / Tag (статуси, tiers, doc-types)   | ✅       | ❌                           |
| Avatar (+ stack), Card, Panel                    | ✅       | ❌                           |
| Modal, Drawer, Popover, Tooltip, Toast, Alert    | ✅       | ❌                           |
| Tabs, Table (sort/filter/paginate), Skeleton     | ✅       | ❌                           |
| Empty states, Pagination                         | ✅       | ❌                           |
| Status badge (internal→client mapping)           | ✅       | ❌                           |
| Company switcher, Bell dropdown, ⌘K palette      | ✅       | ❌                           |
| Timer widget, Chat bubble + composer             | ✅       | ❌                           |
| Kanban card + column, File dropzone              | ✅       | ❌                           |
| Notification matrix, Progress bar                | ✅       | ❌                           |

---

## 6. Черга реалізації коду

> Тут — **тільки код**. Дизайн-допрацювання (що домалювати) ведеться окремо в [`DESIGN_TODO.md`](DESIGN_TODO.md) і передається дизайнеру — у цей план дизайн-задачі **не включаємо**. Гапи дизайну позначені ◑/❌ у §5.

Прив'язка до спринтів з `TRACKER.md`. Порядок = рекомендований. Екран реалізуємо лише там, де дизайн = ✅; якщо ◑/❌ — заблоковано до повернення допрацювання (`DESIGN_TODO.md`).

**Спочатку — фундамент (блокує все інше):**

1. **Оновити `DESIGN_BRIEF.md`** під §2/§3 (візуальна мова зафіксована).
2. **`packages/ui` — токени + ядро компонентів** під §3: ThemeProvider (light/dark + 6 акцентів через `--wf-*`), Button (повний), Input-сімейство, Card, Badge/Pill (статуси/tiers/doc-types), Modal/Drawer/Popover/Toast, Tabs, Table, Skeleton, Empty. Естетика A (термінал-хром) — у shell. Це база для portal+workspace.

**S3 — Portal frontend:** 3. Auth-флоу (7 екранів + усі стани помилок/sent/OTP — §5.3). 4. App-shell портала (sidebar `PORTAL_NAV`, topbar, breadcrumbs, bell, company switcher). 5. Orders (список + new form/chat + detail з 3 табами + банер approval). 6. Billing (3 таби), Documents index, Loyalty, Referrals, Team, Settings (5 підсторінок + матриця 14×3). 7. States/overlays (404/500/403/maintenance, ⌘K, bell, wizard) + empty/loading скрізь. 8. Mobile-екрани (8 native-екранів) + Inbox.

**S4 — Workspace frontend:** 9. App-shell (sidebar `WORKSPACE_NAV`) + Dashboard (Kanban board/list/timeline). 10. Intake, Order detail v2 (+ timer + модали stop/close+AI), internal order view. 11. Companies (+heatmap), Billing/Debtors/Payouts, Inbox. 12. Reports (×6), Admin (departments/team/permissions + 2 модали).

**S6 — Documents:** 13. Toolkit HTML→Puppeteer (§5.5) + 5 PDF-шаблонів + `/documents` UI.

**S7 — Landing:** 14. One-pager (9 секцій) + Project/Company сторінки + 404 + адаптив + колірні схеми. 15. Blog, Pricing, Terms/Privacy — **заблоковано дизайном** (чекаємо `DESIGN_TODO.md` G2/G3), далі код.

**Поперечно:** 16. Email-шаблони — **заблоковано дизайном** (`DESIGN_TODO.md` G1); після повернення реалізувати/оновити inline-CSS під токени §3.

---

## 7. Workflow: тримати код і дизайн поруч

**Гейт перед написанням будь-якого UI / візуального артефакту:**

1. **Знайди екран** у §5 (або в реєстрі [`design/project/product-app.jsx`](../design/project/product-app.jsx) / [`app.jsx`](../design/project/app.jsx)).
2. **Дизайн є (✅)?**
   - **Так** → відкрий відповідний `*.jsx` + `styles.css`/`product-styles.css`, звір токени з §3, реалізуй піксель-в-піксель. Перевір **усі стани**: default / empty / loading / error / а також модали й overlays зі стовпця «Стани».
   - **Ні / частково (◑/❌)** → **стоп**. Не вигадуй UI. Познач дизайн-гап (issue / рядок у §5), узгодь з власником дизайну, домалюй або зафіксуй тимчасове рішення явно.
3. **Онови §5** — постав код-статус (✅/◑/🟡) на рядку екрана + дату.
4. **Code review** перевіряє: відповідність токенам §3, наявність усіх станів, що §5 оновлено.

**Чек-лист «фіча → дизайн» (вставляй у PR-опис):**

```
- [ ] Екран знайдено в DESIGN_SYSTEM.md §5 (або в design/project/*.jsx)
- [ ] Дизайн існує (✅). Якщо ні — гап зафіксовано та узгоджено
- [ ] Токени з §3 (кольори/шрифти/радіуси), без хардкоду hex
- [ ] Реалізовано всі стани: empty / loading / error + модали/overlays
- [ ] Light + Dark + (де треба) адаптив (mobile)
- [ ] §5 оновлено: статус коду + дата
```

**Коли оновлювати цей файл:**

- Новий екран у дизайні → додай рядок у §5 (Дизайн ✅, Код ❌).
- Реалізував екран → переключи код-статус.
- Змінились токени → онови §3 і поміть дату.
- Закрив дизайн-гап → онови §5 (статус) і відміть у [`DESIGN_TODO.md`](DESIGN_TODO.md).

**Цикл допрацювання дизайну:** гапи (◑/❌ у §5) виносимо в [`DESIGN_TODO.md`](DESIGN_TODO.md) → передаємо дизайнеру → отримуємо новий дизайн → я звіряю кожен пункт і оновлюю статуси §5. Так покроково, поки §5 не стане без «Дизайн ◑/❌». Деталі циклу — у `DESIGN_TODO.md`.

**Ціль:** на фінальній стадії бекенду дизайн має бути 100% готовий, а §5 — без рядків «Дизайн ◑/❌». Тоді frontend = механічна реалізація за картою.

---

## 8. Рішення (зафіксовано 2026-05-29)

| #   | Питання                                  | **Рішення**                                                                                                                                                                   |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Візуальна мова (§2)                      | **Лайм + термінал** — офіційно. Токени свапабельні (6 пресетів). `DESIGN_BRIEF.md` оновити під §3.                                                                            |
| 2   | Естетика продукту (§3.6)                 | **A · Terminal — скрізь** (portal + workspace). B — лише fallback.                                                                                                            |
| 3   | Акцент за замовчуванням (§3.3)           | **lime** default; палітра свапабельна через `--wf-*` токени.                                                                                                                  |
| 4   | PDF-движок (§5.5)                        | **HTML→Puppeteer**. `IMPLEMENTATION_PLAN.md` оновити.                                                                                                                         |
| 5   | Email-дизайн (§5.6, `DESIGN_TODO.md` G1) | **Домалювати 5 листів + переписати inline-CSS** під токени §3. У пріоритет.                                                                                                   |
| 6   | Дизайн-гапи                              | **Усі 4 (G1–G4) — у пріоритет**, винесені в окремий handoff [`DESIGN_TODO.md`](DESIGN_TODO.md) для дизайнера (emails, Blog, Pricing+Legal, Workspace Blog/Cases+Credentials). |

Похідні TODO (не блокуючі, трекати окремо): оновити `DESIGN_BRIEF.md` (§2), оновити `IMPLEMENTATION_PLAN.md` під Puppeteer (§5.5).

---

_Цей файл — живий. Тримай §5 синхронним з кодом при кожному UI-PR._
