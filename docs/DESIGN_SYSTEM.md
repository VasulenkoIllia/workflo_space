# WORKFLO.SPACE — Design System & Coverage

> **Це головний документ зв'язку «дизайн ↔ код».**
> Версія: 1.8 · Створено: 2026-05-29 · R1–R6 ✅ · **R7-design (2026-06-20): новий бандл `design-v2/` — фінмодель 2.0, Проєкт/Клієнт 360°, дошка задач, order-chat, EU-документи, хаби + рольова IA. Скоуп РОЗШИРЕНО (реалізує спеку власника `DESIGN_TZ_2026-06` / `DESIGN_SPEC_FULL`, 29 модулів). «R6 закрито» — більше не актуально; див. §5.13.** · Статус коду: snapshot на 2026-06-20
>
> **Джерело правди для візуалу — новий бандл [`design-v2/`](../design-v2/)** (імпорт через Claude Design MCP, 2026-06-20). Старий [`design/`](../design/) (R6) лишено поряд для diff/історії. Шляхи у §5.2–§5.12 нижче мігровано на `design-v2/project/`.
> Джерело правди для статусу коду — сам код (цей файл — карта, а не заміна `git`/читання коду).

---

## 0. Як користуватися цим файлом

Цей файл відповідає на три питання:

1. **Який у нас дизайн?** → §3 (токени) + §5 (повний інвентар екранів).
2. **Що вже зроблено в коді, а що ні?** → §5 (матриця покриття) + §6 (черга коду).
3. **Я додаю фічу — чи є під неї дизайн?** → §7 (workflow-гейт). Це обов'язковий крок перед кодом.
4. **Що треба домалювати / передати дизайнеру?** → окремий файл [`DESIGN_TODO.md`](DESIGN_TODO.md) (handoff на допрацювання).

**Правило проєкту:** жоден UI не пишемо «з голови». Спочатку дивимось сюди → знаходимо екран → відкриваємо відповідний файл у [`design/project/`](../design-v2/project/) → реалізуємо піксель-в-піксель у нашому стеку (React/Vite або Next.js) → оновлюємо статус у §5. Якщо дизайну немає — це стоп-сигнал (див. §7).

---

## 1. Джерело правди (хендофф)

**Канонічний бандл — [`design-v2/`](../design-v2/)** (159 source-файлів, імпорт 2026-06-20 через Claude Design MCP, entry `design-v2/project/workflo-prototype.html`). Старий [`design/`](../design/) (R6, 113 файлів) лишено для порівняння. Це HTML/CSS/JS-прототип (React 18 + Babel standalone, рендериться у браузері без збірки). Його **не треба запускати** — читаємо вихідний код напряму. **Нові 17 модулів design-v2 — §5.13.**

| Що                                                       | Файл                                                                                                                                           | Призначення                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Інструкція хендоффу                                      | [`design-v2/README.md`](../design-v2/README.md)                                                                                                | Що робити з бандлом                                                                                                                      |
| **Інтерактивний прототип** (r3 entry)                    | [`design/project/workflo-prototype.html`](../design-v2/project/workflo-prototype.html)                                                         | **Кликабельний end-to-end:** лендинг / Портал / Workspace / Компоненти з реальною sidebar-навігацією, ⌘K, bell. Поточний головний entry. |
| Артборди продукту (portal+workspace+documents+brandbook) | [`design/project/workflo-product.html`](../design-v2/project/workflo-product.html)                                                             | Канвас з усіма артбордами/станами/модалями (для дизайн-ревʼю)                                                                            |
| **Лендинг**                                              | [`design/project/workflo-landing.html`](../design-v2/project/workflo-landing.html)                                                             | Маркетинг-сайт                                                                                                                           |
| Реєстр екранів продукту                                  | [`design/project/product-app.jsx`](../design-v2/project/product-app.jsx)                                                                       | Список **усіх** артбордів (екран = `<DCArtboard>`)                                                                                       |
| Реєстр екранів лендингу                                  | [`design/project/app.jsx`](../design-v2/project/app.jsx)                                                                                       | Артборди лендингу                                                                                                                        |
| Дані-заглушки                                            | [`design/project/product-data.js`](../design-v2/project/product-data.js), [`design/project/pages-data.js`](../design-v2/project/pages-data.js) | Моделі даних, статуси, матриці                                                                                                           |
| Токени (CSS-змінні)                                      | [`design/project/styles.css`](../design-v2/project/styles.css)                                                                                 | `--wf-*` змінні — джерело §3                                                                                                             |
| Стилі продукту                                           | [`design/project/product-styles.css`](../design-v2/project/product-styles.css)                                                                 | `.wfp-*` / `.wfd-*` компоненти                                                                                                           |
| Інтент (переписка)                                       | [`design/chats/`](../design/chats/)                                                                                                            | 8 транскриптів — лише у старому `design/chats/` (design-v2 імпортовано через MCP, без chats)                                             |

**Префікси класів** (важливо для розуміння файлів):

- `.wf-*` — лендинг + спільна основа (типографіка, кольори, кнопки).
- `.wfp-*` — продукт (portal + workspace shell, картки, таблиці).
- `.wfd-*` — документи (PDF-шаблони).

**Аркуш екранів:** ~**120 артбордів** на 4 канвасах (`portal`, `workspace`, `documents`, `brandbook`) + ~25 на лендингу. **design-v2 додав ще ~17 модулів** (board, project360, client360, fin-projects, order-chat, documents-eu, hubs…) — інвентар у §5.13.

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

Джерело: [`design/project/styles.css`](../design-v2/project/styles.css). Тема перемикається через `data-theme`, акцент — `data-accent`.

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

Перемикач `data-accent`. Джерело: `ACCENT_PRESETS` у [`design/project/product-shell.jsx`](../design-v2/project/product-shell.jsx).

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

**Офіційно: режим A · Terminal — для обох поверхонь** (portal і workspace). Shell ([`design/project/product-shell.jsx`](../design-v2/project/product-shell.jsx)) завжди рендериться у термінал-вікні:

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

> 🗺️ **Канон РЕАЛЬНОГО per-екранного стану коду — [`DESIGN_COVERAGE.md`](DESIGN_COVERAGE.md)** (наскрізний
> аудит 2026-06-22, adversarial-verified: 567 екранів по 29 модулях — 🟢 85 реалізовано / 🟡 30 заглушок /
> ⚪ 452 нема · ⚠️ 47 conformance-RISK · 180 drift). Таблиці §5.x нижче — оглядові; **за конфлікту канон =
> DESIGN_COVERAGE.md**. Тут ✅ часто означає «дизайн готовий», у DESIGN_COVERAGE — реальний `codeState`.

### 5.1 Загальна картина

| Поверхня                         | Дизайн                                                      | Код | % коду | Вердикт                                                                                                                |
| -------------------------------- | ----------------------------------------------------------- | --- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Landing (`workflo.space`)        | ✅ (r2: +blog/pricing/legal/cookies/about/contact/services) | 🟡  | ~5%    | layout+health є, секцій немає                                                                                          |
| Portal (`portal.workflo.space`)  | ✅                                                          | ❌  | 0%     | scaffold `App.tsx`                                                                                                     |
| Workspace (`work.workflo.space`) | ✅ (r2: +vault/blog/cases/services-admin/onboarding)        | ❌  | 0%     | scaffold `App.tsx`                                                                                                     |
| Documents / PDF                  | ✅                                                          | 🟡  | 0%     | `generatePdf()` кидає «not implemented»                                                                                |
| Email-шаблони                    | ✅ (r2: 15 шаблонів)                                        | ◑   | ~30%   | у коді 4 шаблони (welcome/invite×2/reset), новий дизайн = **15** — треба домалювати + переписати CSS                   |
| Telegram-шаблони                 | n/a (текст)                                                 | ✅  | ~85%   | 7 рендерерів готові                                                                                                    |
| Notification core                | n/a                                                         | ✅  | ~85%   | notify/resolver/dispatch готові                                                                                        |
| Shared UI (`packages/ui`)        | ✅ (r2: +notif-center, toasts, avatars)                     | 🟡  | ~10%   | Button + утиліти; ~35+ компонентів треба                                                                               |
| Onboarding flow (5-step)         | ✅ (r2 new)                                                 | ❌  | 0%     | first-run wizard для нового workspace                                                                                  |
| **Module screens 17 / 20-25**    | ✅ (r3 all delivered)                                       | ❌  | 0%     | див. §5.9 — admin-settings / monitoring / calendar / wallet / finance / leave + minors усі ✅                          |
| **Phase 2 / SaaS-mode**          | ◑ (r3: switcher+booking; rest ❌)                           | ❌  | 0%     | див. §5.10 — multi-agency switcher ✅, public booking ✅, але signup / SaaS-plans / SaaS-billing / limits / paywall ❌ |
| **Interactive prototype** (r3)   | ✅                                                          | ❌  | 0%     | `workflo-prototype.html` — кликабельний end-to-end                                                                     |

> ⚠️ **Оновлення 2026-06-20 (R7-design / `design-v2/`):** рядки таблиці §5.1 вище — стан до нового бандла. Portal/Workspace вже **не «0% scaffold»**: є auth-shell, `AuthContext`, api/sse-бібліотеки, route-дерево (`apps/{portal,workspace}/src/`), а `packages/ui` має Phase A+B (Button/Input/Badge/StatusDot/Card/EmptyState/Skeleton/Avatar/Modal/Tabs/AppShell/AuthShell/Sidebar/Topbar/Icon). Нові **17 модулів** дизайну + їхня бекенд/код-готовність — у **§5.13** (звірено grep'ом по `apps/api` 2026-06-20).

### 5.2 Landing — `workflo.space`

Дизайн: [`design/project/app.jsx`](../design-v2/project/app.jsx), [`design/project/terminal-variant.jsx`](../design-v2/project/terminal-variant.jsx), [`design/project/terminal-pages.jsx`](../design-v2/project/terminal-pages.jsx). Код: [`apps/landing/`](../apps/landing/) (Next.js 15).

| Екран / секція                       | Дизайн      | Стани в дизайні                                                         | Код | Нотатки                                                          |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------- | --- | ---------------------------------------------------------------- |
| One-pager: hero                      | ✅          | 3 варіанти H1, light/dark, 6 акцентів, CRT glow                         | ❌  | `page.tsx` — заглушка                                            |
| One-pager: services                  | ✅          | —                                                                       | ❌  |                                                                  |
| One-pager: work (кейси)              | ✅          | дані з `pages-data.js` (7 проєктів)                                     | ❌  |                                                                  |
| One-pager: process                   | ✅          | —                                                                       | ❌  |                                                                  |
| One-pager: spotlight                 | ✅          | —                                                                       | ❌  |                                                                  |
| One-pager: who (про)                 | ✅          | —                                                                       | ❌  |                                                                  |
| One-pager: contact                   | ✅          | форма                                                                   | ❌  | контакт-форма                                                    |
| One-pager: partners                  | ✅          | —                                                                       | ❌  |                                                                  |
| One-pager: scale                     | ✅          | —                                                                       | ❌  |                                                                  |
| Project page `/work/:slug`           | ✅          | problem/solution/approach/metrics/before-after/stack/testimonial        | ❌  | case study, ~500–800 слів                                        |
| Company page `/companies/:slug`      | ✅          | bio/projects/testimonial/socials                                        | ❌  | 5 компаній у даних                                               |
| 404 (ASCII-кіт)                      | ✅          | light/dark, акценти                                                     | ❌  | `Terminal404`                                                    |
| Адаптив                              | ✅          | phone 375 / tablet 768 (container-queries)                              | ❌  |                                                                  |
| 10 колірних схем                     | ✅          | theme+accent+glow                                                       | ❌  | перемикач схем                                                   |
| Blog `/blog` + `/blog/:slug`         | ✅ (r2)     | список + empty (тег без статей) + стаття (TOC, long-read) + phone (375) | ❌  | G2 закрито · `landing-blog.jsx`                                  |
| Pricing `/pricing`                   | ✅ (r2)     | тарифи + порівняння + FAQ + phone-варіант                               | ❌  | G3 закрито · `landing-pricing.jsx`                               |
| Legal: Terms + Privacy + **Cookies** | ✅ (r2)     | 3 legal-сторінки з TOC, нумерованими секціями, CTA-band                 | ❌  | G3 закрито (+bonus: cookies) · `landing-pricing.jsx` (LegalPage) |
| Services index + detail              | ✅ (r2 new) | `/services` каталог + `/services/:slug` deliverables/проблема/стек      | ❌  | новий — bonus від дизайнера                                      |
| Cases index + detail                 | ✅ (r2 new) | `/cases` grid + `/cases/:slug` метрики + long-read                      | ❌  | окремо від one-pager work                                        |
| About + Contact                      | ✅ (r2 new) | `/about` команда+принципи, `/contact` форма+канали                      | ❌  | окремі сторінки                                                  |
| `/500` server error                  | ✅ (r2 new) | landing-варіант 500                                                     | ❌  |                                                                  |

### 5.3 Portal — `portal.workflo.space`

Дизайн: `portal-*.jsx`, `inbox-screens.jsx`, `documents-screens.jsx`. Код: [`apps/portal/`](../apps/portal/) — **лише scaffold** (`App.tsx` = `<h1>Workflo Portal</h1>`). Усі рядки нижче в коді = ❌.

**Auth** — [`design/project/portal-auth.jsx`](../design-v2/project/portal-auth.jsx)

| Екран                 | Дизайн | Стани (артборди)                                         |
| --------------------- | ------ | -------------------------------------------------------- |
| `/login` email+пароль | ✅     | default · **error** (невірний пароль)                    |
| `/login` phone+OTP    | ✅     | крок 1 (номер) · крок 2 (код) · **error** (невірний код) |
| `/login` 2FA          | ✅     | OTP-крок після пароля                                    |
| `/register`           | ✅     | крок 1 (профіль) · крок 2 (компанія)                     |
| `/forgot-password`    | ✅     | default · **sent** (лист надіслано)                      |
| `/reset-password`     | ✅     | новий пароль                                             |
| `/invite/:token`      | ✅     | приєднання до компанії                                   |

**Orders** — [`design/project/portal-screens.jsx`](../design-v2/project/portal-screens.jsx), [`portal-order-new.jsx`](../design-v2/project/portal-order-new.jsx)

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

| Екран        | Дизайн | Деталі                                                            | Файл                                                                |
| ------------ | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/loyalty`   | ✅     | 5-tier ladder, progress, історія бонусів, spending chart, правила | [`portal-loyalty.jsx`](../design-v2/project/portal-loyalty.jsx)     |
| `/referrals` | ✅     | код+лінк, 3-step explainer, список (masked), правила              | [`portal-referrals.jsx`](../design-v2/project/portal-referrals.jsx) |
| `/team`      | ✅     | учасники компанії + activity                                      | [`portal-team.jsx`](../design-v2/project/portal-team.jsx)           |

**Settings** — [`design/project/portal-settings.jsx`](../design-v2/project/portal-settings.jsx)

| Екран                     | Дизайн | Стани                                           |
| ------------------------- | ------ | ----------------------------------------------- |
| `/settings/profile`       | ✅     | особисті дані + інтерфейс                       |
| `/settings/company`       | ✅     | реквізити (owner only)                          |
| `/settings/members`       | ✅     | invite + зміна ролі                             |
| `/settings/notifications` | ✅     | матриця **14 подій × 3 канали** + тихі години   |
| `/settings/security`      | ✅     | overview · зміна номера (крок 1) · OTP (крок 2) |

**States + Overlays** — [`design/project/portal-states.jsx`](../design-v2/project/portal-states.jsx)

| Елемент                       | Дизайн | Тип                               |
| ----------------------------- | ------ | --------------------------------- |
| 404 / 500 / 403 / Maintenance | ✅     | окремий centered-layout без shell |
| ⌘K палітра                    | ✅     | overlay глобального пошуку        |
| Bell dropdown                 | ✅     | overlay нотифікацій (4 останні)   |
| Company switcher              | ✅     | popover (3 компанії + create)     |
| New company wizard            | ✅     | модал                             |

**Mobile (native, iPhone 390×844)** — [`design/project/portal-mobile.jsx`](../design-v2/project/portal-mobile.jsx)

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

**Inbox** — [`design/project/inbox-screens.jsx`](../design-v2/project/inbox-screens.jsx)

| Екран    | Дизайн | Стани                                                                                                               |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `/inbox` | ✅     | master-detail; фільтри: усі · @згадки · system; quick-reply; kind-мітки (chat/mention/status/doc/payment/marketing) |

**Documents index** — [`design/project/documents-screens.jsx`](../design-v2/project/documents-screens.jsx)

| Екран                                       | Дизайн |
| ------------------------------------------- | ------ |
| `/documents` (список усіх док. з фільтрами) | ✅     |

### 5.4 Workspace — `work.workflo.space`

Дизайн: `workspace-*.jsx`. Код: [`apps/workspace/`](../apps/workspace/) — **лише scaffold**. Усі рядки в коді = ❌.

| Екран                              | Дизайн      | Стани / таби / модали                                                                                  | Файл                                                                                             |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `/` Dashboard                      | ✅          | Kanban **board / list / timeline**; естетики A+B; empty/loading                                        | [`workspace-screens.jsx`](../design-v2/project/workspace-screens.jsx)                            |
| `/orders/intake`                   | ✅          | черга нерозподілених; AI-suggest підрозділу + confidence%; **empty**                                   | [`workspace-tasks.jsx`](../design-v2/project/workspace-tasks.jsx)                                |
| `/orders/:id` v2                   | ✅          | таби: Огляд · Час (time entries+коментарі) · Специфікація; floating timer                              | `workspace-tasks.jsx`                                                                            |
| `/orders/:id` internal             | ✅          | 3 колонки; internal-notes (жовта стрічка 🔒)                                                           | `workspace-screens.jsx`                                                                          |
| `/inbox`                           | ✅          | крос-клієнтський; open: mention / payment / order                                                      | [`inbox-screens.jsx`](../design-v2/project/inbox-screens.jsx)                                    |
| `/companies`                       | ✅          | список + activity heatmap (28 днів); **empty**                                                         | [`workspace-missing.jsx`](../design-v2/project/workspace-missing.jsx)                            |
| `/companies/:id`                   | ✅          | картка клієнта (таби)                                                                                  | `workspace-screens.jsx`                                                                          |
| `/billing`                         | ✅          | overview + subtabs                                                                                     | `workspace-missing.jsx`                                                                          |
| `/billing/debtors`                 | ✅          | age-кольори (свіжий/нагадування/прострочено) + dialog нагадування                                      | `workspace-screens.jsx`                                                                          |
| `/billing/payouts`                 | ✅          | payroll-таблиця (rate×hours + bonuses), 6 виконавців                                                   | `workspace-missing.jsx`                                                                          |
| `/reports` (×6)                    | ✅          | Огляд · Виконавці · Клієнти · Підрозділи · Timesheet · Audit log; **empty**                            | [`workspace-reports.jsx`](../design-v2/project/workspace-reports.jsx)                            |
| `/settings/departments`            | ✅          | CRUD підрозділів + create-card                                                                         | [`workspace-admin.jsx`](../design-v2/project/workspace-admin.jsx)                                |
| `/settings/team`                   | ✅          | members + pending invites                                                                              | `workspace-admin.jsx`                                                                            |
| `/settings/permissions`            | ✅          | матриця role × permission (owner/manager/executor)                                                     | `workspace-admin.jsx`                                                                            |
| Модал: Invite member               | ✅          | overlay                                                                                                | `workspace-admin.jsx`                                                                            |
| Модал: Edit member                 | ✅          | role/rate/depts                                                                                        | `workspace-admin.jsx`                                                                            |
| Модал: Stop timer                  | ✅          | 47:12 + опційний коментар                                                                              | `workspace-tasks.jsx`                                                                            |
| Модал: Close task                  | ✅          | спека-draft (internal tone) · **AI-polished версія**                                                   | `workspace-tasks.jsx`                                                                            |
| **`/vault`** (G4 r2)               | ✅ (r2)     | сейф доступів — 38 секретів × 6 клієнтів; reveal/revoke/edit; журнал доступу; AES-256 · zero-knowledge | [`workspace-screens.jsx`](../design-v2/project/workspace-screens.jsx) (WorkspaceVault)           |
| **`/blog` list + editor** (G4 r2)  | ✅ (r2)     | таблиця статей зі статусами (опубл./чернетка/заплановано) + split-редактор markdown ↔ live-preview     | [`workspace-content.jsx`](../design-v2/project/workspace-content.jsx) (WorkspaceBlogCMS)         |
| **`/cases`** (G4 r2)               | ✅ (r2)     | картки кейсів з результатами; публікація на лендинг                                                    | `workspace-content.jsx` (WorkspaceCases)                                                         |
| **`/services-admin`** (r2 new)     | ✅ (r2 new) | owner-каталог послуг для лендингу: порядок, статуси, ліди з форм                                       | [`workspace-services.jsx`](../design-v2/project/workspace-services.jsx) (WorkspaceServicesAdmin) |
| **`/billing/services`** (r2 new)   | ✅ (r2 new) | recurring-підписки на обслуговування: MRR, призначення виконавців, статуси active/paused               | `workspace-services.jsx` (WorkspaceBillingServices)                                              |
| **Onboarding (5 кроків)** (r2 new) | ✅ (r2 new) | first-run wizard: workspace → галузь (аватарка) → команда → канали → готово                            | [`onboarding.jsx`](../design-v2/project/onboarding.jsx) (OnboardingFlow)                         |

> **G4 закрито.** Залишився минорний gap — особисті налаштування виконавця (profile/security/notifications) у workspace — ймовірно реюз патернів порталу (§5.3).

### 5.5 Documents / PDF

Дизайн: [`design/project/documents-screens.jsx`](../design-v2/project/documents-screens.jsx) + дані в `product-data.js`. Код: [`packages/templates/src/index.ts`](../packages/templates/src/index.ts) — `generatePdf()` **кидає** «not implemented yet. Planned for Sprint 6». Усі = 🟡 (дизайн ✅, код ні).

| Документ           | Код-тип | Дизайн | Особливості                                                          |
| ------------------ | ------- | ------ | -------------------------------------------------------------------- |
| Invoice (Рахунок)  | INV     | ✅     | розбивка робіт, IBAN+USDT+**QR**, курс НБУ, lime на № і total        |
| Completion Act     | ACT     | ✅     | зелений штамп **SIGNED**, 2 підписи (Caveat)                         |
| Reconciliation Act | REC     | ✅     | помаранчевий штамп **DRAFT**, дебет/кредит/сальдо                    |
| Specification      | SPC     | ✅     | контекст/цілі/скоуп/deliverables/етапи/приймання/out-of-scope/бюджет |
| Contract           | CTR     | ✅     | рамковий, 2-колонкові статті, e-sign                                 |

**Система документів:** A4 (794×1123), margins 56/64, темна шапка таблиці, lime-акцент на № і total, watermark SIGNED/DRAFT, підпис Caveat −3°, QR (IBAN+amount+ref). UA+EN.
**Движок (рішення 2026-05-29): HTML→Puppeteer→PDF** (toolkit DocBrand/DocParties/DocSigs/DocFoot). Реюз HTML/CSS дизайну 1:1 — точне повторення мокапів (QR, watermark, Caveat). `IMPLEMENTATION_PLAN.md` оновлено під Puppeteer (2026-06-02).

### 5.6 Email-шаблони

**Дизайн (r2 — G1 закрито):** 15 HTML-шаблонів у [`design/project/email-templates.jsx`](../design-v2/project/email-templates.jsx) + [`email-templates.css`](../design-v2/project/email-templates.css). Mono + lime, з прев'ю всередині поштового клієнта.
**Код:** [`packages/notifications/src/email/templates/`](../packages/notifications/src/email/templates/) — реалізовані 4 шаблони (welcome/inviteExecutor/inviteCompanyMember/passwordReset). Решту 11 треба додати + переписати inline-CSS під фірмовий стиль.

**Transactional (5):**

| Шаблон                             | Дизайн (r2)         | Код                      | Нотатки                          |
| ---------------------------------- | ------------------- | ------------------------ | -------------------------------- |
| Запрошення в портал (set password) | ✅ `email-invite`   | ✅ `inviteCompanyMember` | звірити inline-CSS з токенами §3 |
| Замовлення прийнято в роботу       | ✅ `email-order`    | ❌                       | новий — додати в код             |
| Виставлено рахунок (pay CTA)       | ✅ `email-invoice`  | ❌                       | новий — додати в код             |
| Оплату отримано (receipt)          | ✅ `email-payment`  | ❌                       | новий — додати в код             |
| Нагадування про оплату (warning)   | ✅ `email-deadline` | ❌                       | новий — додати в код             |

**Auth + безпека (6):**

| Шаблон                      | Дизайн (r2)            | Код                | Нотатки                |
| --------------------------- | ---------------------- | ------------------ | ---------------------- |
| Підтвердження пошти (код)   | ✅ `email-verify`      | ❌                 | новий — додати         |
| Скидання паролю             | ✅ `email-reset`       | ✅ `passwordReset` | звірити CSS з токенами |
| Пароль змінено (security)   | ✅ `email-pwd-changed` | ❌                 | новий                  |
| Новий вхід виявлено (alert) | ✅ `email-new-login`   | ❌                 | новий                  |
| Одноразовий код 2FA         | ✅ `email-otp`         | ❌                 | новий                  |
| Підтвердження зміни email   | ✅ `email-change`      | ❌                 | новий                  |

**Системні + інфо (4):**

| Шаблон                          | Дизайн (r2)            | Код                 | Нотатки     |
| ------------------------------- | ---------------------- | ------------------- | ----------- |
| Запрошення в команду (executor) | ✅ `email-team-invite` | ✅ `inviteExecutor` | звірити CSS |
| Згадка / нове повідомлення      | ✅ `email-mention`     | ❌                  | новий       |
| Документ готовий на погодження  | ✅ `email-doc-ready`   | ❌                  | новий       |
| Тижневий дайджест (stat-сітка)  | ✅ `email-digest`      | ❌                  | новий       |

> **TODO коду (поза дизайн-циклом):** додати 11 нових шаблонів у `packages/notifications/src/email/templates/`, переписати inline-CSS існуючих 4 під токени §3 (`render.ts`).

### 5.7 Telegram-шаблони

Код: [`packages/notifications/src/telegram/templates/`](../packages/notifications/src/telegram/templates/). Реалізовані: welcome, invite (×2), password reset, order status changed, new comment, invoice sent. Текстові — окремий візуальний дизайн не потрібен. Статус: ✅.

### 5.8 Shared UI — `packages/ui`

Дизайн-довідник: brandbook (`bb-foundations` + `bb-components`) — [`design/project/brandbook.jsx`](../design-v2/project/brandbook.jsx), [`brandbook-product.jsx`](../design-v2/project/brandbook-product.jsx). Код: [`packages/ui/src/`](../packages/ui/src/).

| Компонент                                                       | Дизайн   | Код                          |
| --------------------------------------------------------------- | -------- | ---------------------------- |
| Button (primary/ghost/danger, sizes, A/B)                       | ✅       | ◑ (є базовий, без варіантів) |
| `cn`, `useDebounce`                                             | n/a      | ✅                           |
| ThemeProvider / useTheme / useMediaQuery                        | потрібні | 🟡 (заглушки)                |
| Input, Textarea, Select, Checkbox, Radio, Toggle                | ✅       | ❌                           |
| Badge / Pill / Tag (статуси, tiers, doc-types)                  | ✅       | ❌                           |
| Avatar (+ stack), Card, Panel                                   | ✅       | ❌                           |
| Modal, Drawer, Popover, Tooltip, Toast, Alert                   | ✅       | ❌                           |
| Tabs, Table (sort/filter/paginate), Skeleton                    | ✅       | ❌                           |
| Empty states, Pagination                                        | ✅       | ❌                           |
| Status badge (internal→client mapping)                          | ✅       | ❌                           |
| Company switcher, Bell dropdown, ⌘K palette                     | ✅       | ❌                           |
| Timer widget, Chat bubble + composer                            | ✅       | ❌                           |
| Kanban card + column, File dropzone                             | ✅       | ❌                           |
| Notification matrix, Progress bar                               | ✅       | ❌                           |
| **Notification center** (🔔 dropdown, tabs unread/all) (r2 new) | ✅       | ❌                           |
| **Toast system** (5 варіантів + action, стек до 3) (r2 new)     | ✅       | ❌                           |
| **Avatars** (тематичні гліф-аватарки: ролі + клієнти) (r2 new)  | ✅       | ❌                           |

---

## 5.9 Module-based screens (модулі 16-25) — **усі закриті (r3 ✅)**

| Модуль                       | Статус | Файл                                                                                | Артборди                                                                                    |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 16 · Search & Filters        | ✅     | `inbox-screens.jsx` + ⌘K (`p-cmdk`)                                                 | mini-рефайнменти у M5                                                                       |
| 17 · Credentials Vault       | ✅ r2  | `workspace-screens.jsx` (WorkspaceVault)                                            | `/vault` — 38 секретів × 6 клієнтів                                                         |
| 18 · Chat Hub                | ✅     | `inbox-screens.jsx` + M5 рефайнменти (`workspace-minors.jsx`)                       | SSE pulse, mute/archive                                                                     |
| 19 · Reports                 | ✅     | `workspace-reports.jsx` + M4 (`workspace-minors.jsx`)                               | revenue line chart додано (M4)                                                              |
| **20 · Admin Settings**      | ✅ r3  | [`workspace-admin-settings.jsx`](../design-v2/project/workspace-admin-settings.jsx) | AdminTemplates · AdminSmtp · AdminBranding · AdminNomenclature · AdminCrons                 |
| **21 · System Monitoring**   | ✅ r3  | [`workspace-monitoring.jsx`](../design-v2/project/workspace-monitoring.jsx)         | SystemMonitoring (5 секцій: health · cron heatmap · notif health · audit · errors)          |
| **22 · Finance / Expenses**  | ✅ r3  | [`workspace-finance.jsx`](../design-v2/project/workspace-finance.jsx)               | FinanceOverview · ExpensesTab · PnlChart · ExpenseModal · PnlReport                         |
| **23 · Leave Tracking**      | ✅ r3  | [`workspace-leave.jsx`](../design-v2/project/workspace-leave.jsx)                   | LeaveExecutor · LeaveAdmin · LeaveRequestModal · LeaveRejectModal                           |
| **24 · Calendar / Meetings** | ✅ r3  | [`workspace-calendar.jsx`](../design-v2/project/workspace-calendar.jsx)             | CalendarMonth/Week/Day · CalEventModal · CalRsvpModal · MobileCalendar · CalendarEmpty      |
| **25 · Client Wallet**       | ✅ r3  | [`workspace-wallet.jsx`](../design-v2/project/workspace-wallet.jsx)                 | WalletPortal · WalletAdminCompanies · WalletAdminLedger · WalletAdjustModal · ReferralTiers |

**Минорі (r3 ✅, файл [`workspace-minors.jsx`](../design-v2/project/workspace-minors.jsx)):**

- **M1** OAuth — `OAuthButtons` (Google + GitHub на `/login`)
- **M2** Orders — `OrderTagsDeps` (tags + dependencies + templates dropdown)
- **M3** Chat — `ChatRefine` (reply-to, emoji reactions, read-receipts, edit affordance)
- **M4** Revenue chart — `RevenueReport` (`/reports/revenue` line chart)
- **M5** Chat hub — `ChatHubRefine` (SSE animation, mute/archive)

---

## 5.10 Phase 2 / SaaS-mode (multi-tenant)

> Відповідь на питання: «якщо це вийде як SaaS на останній фазі — чи готовий дизайн?»
> **Коротка відповідь:** для single-tenant запуску — ✅ повністю. Для SaaS-фази (мульти-агентство, self-service signup, plan billing) — ◑ розпочато, але **не готово**. Деталі:

| Item                                                                                         | Статус | Файл / артборд                                                                                                                           |
| -------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-agency switcher** (ADR-004)                                                          | ✅ r3  | `AgencySwitcherPop` у [`workspace-phase2.jsx`](../design-v2/project/workspace-phase2.jsx) — topbar popover з усіма агенціями користувача |
| **Public booking** `/book/:userSlug` (cal.com-style)                                         | ✅ r3  | [`landing-booking.jsx`](../design-v2/project/landing-booking.jsx) — meeting types + slot picker + confirmed state                        |
| DB metrics extension (G6)                                                                    | ✅ r3  | `DbMetrics` у `workspace-phase2.jsx` — пул зʼєднань, cache hit, slow queries (`pg_stat_statements`)                                      |
| Per-client margin (G9 extension)                                                             | ✅ r3  | `ClientMargin` у `workspace-phase2.jsx` — дохід − собівартість по кожному клієнту                                                        |
| **Agency settings page** (per-agency: custom domain, SMTP override, team limit, danger-zone) | ◑      | Branding `/admin/branding` per-agency є (G5); решта — ❌                                                                                 |
| **Public signup flow** (нове агентство самореєструється)                                     | ❌     | Лендинг `/pricing` показує тарифи для клієнтів агенції, а не для самої SaaS-агенції                                                      |
| **SaaS plan tiers** (Free / Pro / Team / Enterprise для SaaS-підписки)                       | ❌     | —                                                                                                                                        |
| **SaaS billing dashboard** (Stripe-картка, історія SaaS-інвойсів, usage meter)               | ❌     | —                                                                                                                                        |
| **Trial state + paywall + upgrade prompts**                                                  | ❌     | —                                                                                                                                        |
| **Per-agency limits UI** (n orders / n users / storage quota, soft+hard warn)                | ❌     | —                                                                                                                                        |
| **Platform-admin** (workflo team UI, окремо від agency-owner)                                | ❌     | —                                                                                                                                        |
| **Email-to-task** (forward email → автостворення замовлення)                                 | ❌     | —                                                                                                                                        |

**Підсумок:** 2 з 9 SaaS-фічей у дизайні (multi-agency switcher + booking). Решта — **round 5 (deferred)** у [`DESIGN_TODO.md`](DESIGN_TODO.md), малюємо тільки якщо/коли власник вирішить переходити на SaaS-модель.

---

## 5.11 Round-4 non-SaaS gaps — ✅ закрито (2026-06-01)

> Усі 14 пакетів повернулись повними артбордами + nav-пунктами. MVP-скоуп = 100%.

| ID  | Пакет                                       | Статус | Файл                                                                      |
| --- | ------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| G11 | Mobile Workspace                            | ✅ r4  | [`workspace-mobile.jsx`](../design-v2/project/workspace-mobile.jsx)       |
| G12 | Client document signing UX                  | ✅ r4  | [`portal-signing.jsx`](../design-v2/project/portal-signing.jsx)           |
| G13 | Refund / credit-note flow + **CRN PDF тип** | ✅ r4  | [`round4-billing.jsx`](../design-v2/project/round4-billing.jsx)           |
| G14 | Bulk actions framework                      | ✅ r4  | [`round4-bulk.jsx`](../design-v2/project/round4-bulk.jsx)                 |
| G15 | Full `/search` з фасетами                   | ✅ r4  | [`round4-search.jsx`](../design-v2/project/round4-search.jsx)             |
| G16 | Bot admin + broadcast                       | ✅ r4  | [`round4-bot.jsx`](../design-v2/project/round4-bot.jsx)                   |
| G17 | Notification DLQ + retry                    | ✅ r4  | [`round4-dlq.jsx`](../design-v2/project/round4-dlq.jsx)                   |
| G18 | Integrations hub                            | ✅ r4  | [`round4-integrations.jsx`](../design-v2/project/round4-integrations.jsx) |
| G19 | Trash / Undelete                            | ✅ r4  | [`round4-trash.jsx`](../design-v2/project/round4-trash.jsx)               |
| M6  | Executor self-settings (ws)                 | ✅ r4  | `round4-misc.jsx` · R4ExecSettings                                        |
| M7  | CSV export modal + print                    | ✅ r4  | `round4-misc.jsx` · R4Export                                              |
| M8  | Onboarding for company member               | ✅ r4  | `round4-misc.jsx` · R4Onboarding                                          |
| M9  | Workspace 403                               | ✅ r4  | `round4-misc.jsx` · R4Forbidden                                           |
| M10 | Document diff view                          | ✅ r4  | `round4-misc.jsx` · R4Diff                                                |

**Nav розширено (r4):** PORTAL_NAV +4 (`wallet`, `docdiff`, `tour`, `integrations`); WORKSPACE_NAV +15 (`finance`, `refund`, `search`, `bulk`, `export`, `admin-set`, `sysmon`, `bot`, `dlq`, `integrations`, `trash`, `forbidden`, `leave`, `calendar`, `mysettings`).

→ MVP дизайн закрито на момент r4. Документація з тих пір виросла → див. §5.12.

---

## 5.12 Round-6 — ✅ закрито (2026-06-02)

> 5 пакетів повернулись окремими файлами + nav-пунктами. Повний скоуп MVP + модулі 26-29 + white-label config = 100%.

| ID  | Пакет                                   | Статус | Файл                                                                                    |
| --- | --------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| G20 | Leads (kanban + card + pipelines)       | ✅ r6  | [`workspace-leads.jsx`](../design-v2/project/workspace-leads.jsx)                       |
| G21 | Integrations hub — повний (4 таби)      | ✅ r6  | [`workspace-integrations.jsx`](../design-v2/project/workspace-integrations.jsx)         |
| G22 | Client Management                       | ✅ r6  | [`workspace-clients.jsx`](../design-v2/project/workspace-clients.jsx)                   |
| G23 | Support (Portal + Workspace + chat-hub) | ✅ r6  | [`workspace-support.jsx`](../design-v2/project/workspace-support.jsx) + `PortalSupport` |
| G24 | SaaS white-label config (E1–E5)         | ✅ r6  | [`workspace-branding.jsx`](../design-v2/project/workspace-branding.jsx)                 |

**Бонус r6:** Portal `/support` як окремий компонент · 2 live brand variants demo (workflo lime vs Acme indigo) · 6 accent-presets (lime/indigo/amber/cyan/rose/emerald + custom).

**Nav розширено (r6):** PORTAL_NAV +2 (`support`, `integrations`); WORKSPACE_NAV +5 (`leads` з accent-badge, `support`, оновлений `integrations`, `branding`).

→ **Повний скоуп закрито.** Лишається тільки **R7 (SaaS-enablement, deferred)** + **doc-drift cleanup** — повний список у [`DESIGN_TODO.md`](DESIGN_TODO.md).

---

## 5.13 R7-design — новий бандл `design-v2/` (2026-06-20) — РОЗШИРЕННЯ скоупу

> Новий дизайн-бандл [`design-v2/`](../design-v2/) (імпорт через Claude Design MCP) **реабілітує** статус «R6 закрито»: він реалізує спеку власника з проходу по 29 модулях ([`DESIGN_TZ_2026-06.md`](DESIGN_TZ_2026-06.md) + [`DESIGN_SPEC_FULL.md`](DESIGN_SPEC_FULL.md)). +48 нових файлів, 11 суттєво переписаних. **Дизайн НЕ є вузьким місцем** — гейт упирається в бекенд для частини модулів.
>
> Бекенд-статус нижче **звірено grep'ом по `apps/api/src/routes` + `packages/db/prisma/schema.prisma`** (адверсарний verify-прохід аудиту 2026-06-20).

### 5.13.1 ⚠️ Структурна зміна — Інформаційна Архітектура (не екрани!)

Найважливіше в цьому раунді — **переустрій IA**, а не нові екрани:

| Зміна                        | Що                                                                                                                                                                                                                                                                                                                                                         | Бекенд                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Рольова навігація**        | `WORKSPACE_NAV` тегований ролями `o/m/x` (**owner/manager/executor**), фільтрується `navVisibleForRole()` — групи зʼявляються/зникають цілком (`ia-roles.css`)                                                                                                                                                                                             | ✅ `can()` / ADR-008               |
| **Зміна рольового словника** | скрізь `superadmin/lead` → **`owner/manager/executor`** (`product-data.js`, permission-матриця, payouts)                                                                                                                                                                                                                                                   | ✅ узгоджено                       |
| **7 хабів**                  | 5 generic через `makeHub()` у `workspace-hubs.jsx` (`ReportsHub`·`AdminSettingsHub`·`AdminHub`·`AdminTeamHub`·`PortalSettingsHub`) + bespoke в окремих файлах: `WorkspaceBillingHub` (`workspace-billing-hub.jsx`), `WsLandingHub` (`workspace-landing-hub.jsx`), `FinanceHub` (таби у `workspace-finance.jsx`). Згортають екрани під 1 пункт з під-табами | 🟡 **немає задачі в TRACKER**      |
| **view-as**                  | owner дивиться як клієнт/виконавець, read-only banner                                                                                                                                                                                                                                                                                                      | ◑ бекенд+банер є, екран відкладено |

> 🔧 **`p2b`/`p2c` — це НЕ режими B2B/B2C**, а імена код-батчів («Phase-2 block B/C»: capacity/view-as/email-шаблони). `A/B`-естетика та mobile-shells = прототип-скаффолдинг, не продуктові вимоги.

### 5.13.2 Матриця готовності 17 модулів (дизайн ✅ скрізь)

Легенда вердикту: 🟢 готово кодити (дизайн✅ + бекенд✅) · 🟡 частково · 🔴 блок-бекенд / greenfield.

| Модуль                       | Файли (`design-v2/project/`)       | Екрани | Бекенд (звірено)                                                                                                                              | Вердикт                                            |
| ---------------------------- | ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **margin** (22-Д)            | `workspace-margin.jsx`             | 1      | ✅ `finance/margin.ts` (`computeProjectMargin/ClientMargin`)                                                                                  | 🟢 готово                                          |
| **orders-v2** (реєстр)       | `workspace-orders-v2.jsx`          | 2      | ✅ `orders/*` (9 статусів `OrderInternalStatus` збігаються)                                                                                   | 🟢 готово                                          |
| **service-catalog**          | `workspace-svccatalog.jsx` + data  | 2      | ✅ `services/catalog.ts` повний CRUD + `Service` модель                                                                                       | 🟢 готово                                          |
| **order-chat** (core)        | `order-chat.jsx`                   | 9      | ✅ `orders/comments.ts` + `commentsStream.ts` (SSE) + `OrderComment`                                                                          | 🟢 core готово (медіа/lightbox — нове)             |
| **fin-projects** (core)      | `workspace-finprojects.jsx` + data | 9      | ✅ `billing/projects.ts` CRUD + `Project` модель                                                                                              | 🟢 core готово (TeamComp/ContractTemplate — gap)   |
| **board** (kanban)           | `workspace-board*.jsx` + data      | 14     | ✅ `InternalTask` CRUD `/orders/:id/tasks` (фікс. колонки)                                                                                    | 🟢 фікс-колонки готові; **кастомні колонки** — gap |
| **project360**               | `workspace-project360*.jsx` + data | 16     | ◑ ready-таби (overview/team/contract/orders/finance) ✅; tasks/docs — блок                                                                    | 🟡 ready-таби готові                               |
| **reports-v1**               | `workspace-reports-v1.jsx` + data  | 2      | ◑ P&L `finance/reports.ts` ✅; решта звітів — нема aggregation API                                                                            | 🟡 P&L готовий                                     |
| **notifications** center     | `workspace-notify.jsx` + data      | 10     | ◑ `Notification` модель+запис є; **read-feed/mark-read API нема**; announcements — greenfield                                                 | 🟡 частково                                        |
| **client360** 🔴             | `workspace-client360*.jsx` + data  | 15     | ❌ **НЕМА clients CRUD** (`CompanyService` викинуто в P-1e); клієнт = `Company`+`Profile(role:client)`, твориться лише через `/auth/register` | 🔴 блок-бекенд (П1-№1 спеки!)                      |
| **documents-eu** 🔴          | `workspace-documents-eu.jsx`       | 8      | ❌ `Document` модель є, **route/генерації нема** + PDF-движок stub                                                                            | 🔴 блок-бекенд                                     |
| **portal-secrets** (vault)   | `portal-secrets.jsx`               | 3      | ❌ нуль (нема моделі/route)                                                                                                                   | 🔴 greenfield                                      |
| **support-plus** (тікети/KB) | `workspace-support-plus.jsx`       | 7      | ❌ нуль                                                                                                                                       | 🔴 greenfield                                      |
| **calendar-plus**            | `workspace-calendar-plus.jsx`      | 6      | ❌ calendar/booking нуль (leave — частково модуль 23)                                                                                         | 🔴 greenfield                                      |
| **testimonials**             | `workspace-testimonials.jsx`       | 3      | ❌ нуль                                                                                                                                       | 🔴 greenfield                                      |
| **case-editor**              | `workspace-case-editor.jsx`        | 2      | ❌ нуль (`BlogPost` є — частковий overlap)                                                                                                    | 🔴 greenfield                                      |
| ~~audit-map~~                | `workspace-audit.jsx`              | 1      | —                                                                                                                                             | ⚪ прототип-внутрішній інструмент (не будуємо)     |

### 5.13.3 Хвилі реалізації

- **Хвиля 0 (розблоковує все):** порт дизайн-CSS (`design-v2/.../styles.css` + `*-responsive.css`, `ia-roles.css`) у `packages/ui`; примітиви Drawer/Table/Tabs/Kanban-card/Chat-composer; **рольовий hub-shell** (AppShell з рольовим нав + хаб-під-таби). Чистий фронт, бекенд не потрібен.
- **Хвиля 1 (одразу після W0):** 8 🟢-модулів — дизайн ✅ + бекенд ✅.
- **Хвиля 2 (після бекенду):** 🔴-модулі. **Рішення власника (2026-06-20): clients CRUD + Document route НЕ підтягуємо наперед** — лишаються за планом (S6–S13). Див. `TRACKER.md`.

### 5.13.4 Дизайн-гапи (винесено в `DESIGN_TODO.md`)

- `/projects/:id` (НОВИЙ операційно-фінансовий екран з §2.3 ТЗ) живе в `project360`, а не в `client360` — звірити, що це навмисно.
- Standalone attention/risk-дашборд (агрегація at-risk клієнтів, 28-Г) — не намальовано окремо.
- GDPR-export action (видалення члена з referral-звʼязком) — деталізувати.

---

## 6. Черга реалізації коду

> Тут — **тільки код**. Дизайн-допрацювання (що домалювати) ведеться окремо в [`DESIGN_TODO.md`](DESIGN_TODO.md) і передається дизайнеру — у цей план дизайн-задачі **не включаємо**. Гапи дизайну позначені ◑/❌ у §5.

Прив'язка до спринтів з `TRACKER.md`. Порядок = рекомендований. Екран реалізуємо лише там, де дизайн = ✅; якщо ◑/❌ — заблоковано до повернення допрацювання (`DESIGN_TODO.md`).

**Спочатку — фундамент (блокує все інше):**

1. **Оновити `DESIGN_BRIEF.md`** під §2/§3 (візуальна мова зафіксована).
2. **`packages/ui` — токени + ядро компонентів** під §3: ThemeProvider (light/dark + 6 акцентів через `--wf-*`), Button (повний), Input-сімейство, Card, Badge/Pill (статуси/tiers/doc-types), Modal/Drawer/Popover/Toast, Tabs, Table, Skeleton, Empty. Естетика A (термінал-хром) — у shell. Це база для portal+workspace.

**S3 — Portal frontend:** 3. Auth-флоу (7 екранів + усі стани помилок/sent/OTP — §5.3). 4. App-shell портала (sidebar `PORTAL_NAV`, topbar, breadcrumbs, bell, company switcher). 5. Orders (список + new form/chat + detail з 3 табами + банер approval). 6. Billing (3 таби), Documents index, Loyalty, Referrals, Team, Settings (5 підсторінок + матриця 14×3). 7. States/overlays (404/500/403/maintenance, ⌘K, bell, wizard) + empty/loading скрізь. 8. Mobile-екрани (8 native-екранів) + Inbox.

**S4 — Workspace frontend:** 9. App-shell (sidebar `WORKSPACE_NAV`) + Dashboard (Kanban board/list/timeline). 10. Intake, Order detail v2 (+ timer + модали stop/close+AI), internal order view. 11. Companies (+heatmap), Billing/Debtors/Payouts, Inbox. 12. Reports (×6), Admin (departments/team/permissions + 2 модали). **(r3) Розблоковано:** 12a. Admin Settings (templates / SMTP / branding / nomenclature / crons — §5.9 G5). 12b. System Monitoring (§5.9 G6). 12c. Calendar (§5.9 G7). 12d. Wallet — admin side (§5.9 G8). 12e. Finance / P&L (§5.9 G9). 12f. Leave — owner side (§5.9 G10). 12g. Mінорі M1–M5.

**S6 — Documents:** 13. Toolkit HTML→Puppeteer (§5.5) + 5 PDF-шаблонів + `/documents` UI.

**S7 — Landing:** 14. One-pager (9 секцій) + Project/Company сторінки + 404 + адаптив + колірні схеми. 15. **Розблоковано (r2 ✅):** Blog (list/empty/article), Pricing, Legal (terms/privacy/cookies), Services, Cases, About, Contact, 500 — дизайн є.

**Поперечно:** 16. **Розблоковано (r2 ✅):** Email-шаблони — дизайн 15 шаблонів готовий (§5.6). Додати 11 нових у `packages/notifications/src/email/templates/` + переписати CSS існуючих 4 під токени §3. 17. **Onboarding (r2 new):** 5-step wizard після `packages/ui` base. 18. **Workspace bonus (r2 new):** vault, content (blog/cases), services-admin, billing-services — додати в `WORKSPACE_NAV` та реалізувати разом з S4. 19. **(r3 new) Portal `/wallet`** — додати в `PORTAL_NAV` (вже в `prototype.jsx` як `wallet → WalletPortal`).

**Стан гейту:** після r3 в коді **немає заблокованих дизайном екранів** для MVP/Phase-1. Для SaaS-фази див. §5.10 (round 4 опційно).

---

## 7. Workflow: тримати код і дизайн поруч

**Гейт перед написанням будь-якого UI / візуального артефакту:**

1. **Знайди екран** у §5 (або в реєстрі [`design/project/product-app.jsx`](../design-v2/project/product-app.jsx) / [`app.jsx`](../design-v2/project/app.jsx)).
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

| #   | Питання                                  | **Рішення**                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Візуальна мова (§2)                      | **Лайм + термінал** — офіційно. Токени свапабельні (6 пресетів). `DESIGN_BRIEF.md` оновити під §3.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | Естетика продукту (§3.6)                 | **A · Terminal — скрізь** (portal + workspace). B — лише fallback.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Акцент за замовчуванням (§3.3)           | **lime** default; палітра свапабельна через `--wf-*` токени.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | PDF-движок (§5.5)                        | **HTML→Puppeteer**. `IMPLEMENTATION_PLAN.md` оновити.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5   | Email-дизайн (§5.6, `DESIGN_TODO.md` G1) | **Домалювати 5 листів + переписати inline-CSS** під токени §3. У пріоритет.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | Дизайн-гапи (round 1)                    | **Усі 4 (G1–G4) — у пріоритет**, винесені в [`DESIGN_TODO.md`](DESIGN_TODO.md) для дизайнера (emails, Blog, Pricing+Legal, Workspace Blog/Cases+Credentials).                                                                                                                                                                                                                                                                                                                            |
| 7   | **Round 2 повернувся (2026-05-29)**      | **G1–G4 ✅ закрито** + **бонус** (15 emails, onboarding, services, marketing/about/contact/cookies, notification center, toast system, avatars). Нові гапи з модулів 16-25 → §5.9 + handoff G5–G10 у [`DESIGN_TODO.md`](DESIGN_TODO.md).                                                                                                                                                                                                                                                 |
| 8   | **Round 3 повернувся (2026-05-31)**      | **G5–G10 + M1–M5 ✅ закрито** + **бонус:** AgencySwitcherPop (multi-agency, ADR-004), public booking `/book/:userSlug`, DbMetrics, ClientMargin, skeletons, **інтерактивний прототип `workflo-prototype.html`** з реальною sidebar-навігацією. **Для MVP/Phase-1 дизайн = 100% готовий.**                                                                                                                                                                                                |
| 9   | **Round 4 повернувся (2026-06-01)**      | **G11–G19 + M6–M10 ✅ закрито.** Файли: `workspace-mobile.jsx` (G11), `portal-signing.jsx` (G12), `round4-billing.jsx` (G13 + CRN doc), `round4-bulk.jsx` (G14), `round4-search.jsx` (G15), `round4-bot.jsx` (G16), `round4-dlq.jsx` (G17), `round4-integrations.jsx` (G18), `round4-trash.jsx` (G19), `round4-misc.jsx` (M6–M10). PORTAL_NAV +4 пункти, WORKSPACE_NAV +15 пунктів. **MVP дизайн = 100% закрито.**                                                                       |
| 10  | **Round 5 (verification, 2026-06-02)**   | Бандл повернувся **бітово ідентичний r4** (127 файлів, 0 diff). Натомість документація виросла: 4 нові модулі (`26-leads`, `27-integrations`, `28-client-management`, `29-support`), `SAAS.md`, `SAAS_CONFIG.md` (**white-label per-agency**), `DESIGN_BRIEF_GROWTH.md`, ADR-005/006/007 + foundation closure в коді (agencyId NOT NULL, RLS scaffold, web/worker split). → нові гапи виявлено.                                                                                          |
| 11  | **Round 6 повернувся (2026-06-02)**      | **G20–G24 ✅ закрито.** 5 нових файлів: `workspace-leads.jsx` (G20) · `workspace-integrations.jsx` (G21) · `workspace-clients.jsx` (G22) · `workspace-support.jsx` (G23) · `workspace-branding.jsx` (G24). Bonus: Portal `/support` (PortalSupport), 2 live brand variants demo (workflo lime + Acme indigo), 6 accent-presets (lime/indigo/amber/cyan/rose/emerald + custom). PORTAL_NAV +2, WORKSPACE_NAV +5. **Повний скоуп MVP + модулі 26-29 + white-label = 100% дизайн готовий.** |
| 12  | **Round 7 (SaaS-enablement) — deferred** | Повний SaaS: public signup · plan tiers · SaaS billing · trial+paywall · per-agency limits UI · **super-admin** · email-to-task. Малюємо, коли власник дасть відповіді на 5 перевірочних питань (модель / тіри / провайдер / триал / super-admin scope).                                                                                                                                                                                                                                 |

**Нові рішення (2026-06-20):**

| #   | Питання                                  | **Рішення**                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13  | **R7-design — новий бандл `design-v2/`** | Імпорт 2026-06-20 через Claude Design MCP. +17 модулів (board · project360 · client360 · fin-projects · margin · service-catalog · orders-v2 · order-chat · notifications · documents-eu · secrets · support · calendar · testimonials · case-editor · reports-v1 · hubs). Реалізує `DESIGN_TZ_2026-06`. **«R6 закрито» знято.** Готовність — §5.13. Старий `design/` лишено для diff.                       |
| 14  | **Рольова модель + IA (hubs)**           | Словник ролей `superadmin/lead` → **owner/manager/executor** (узгоджено з `can()` / ADR-008). Нав рольова (`ia-roles.css` · `navVisibleForRole()`). **7 хабів** (5 generic у `workspace-hubs.jsx` + Billing/Landing/Finance bespoke — див. §5.13.1) → потребують окремої фронт-задачі (немає в TRACKER). **Рішення власника:** clients-CRUD + Document-route **НЕ** підтягуємо наперед — за планом (S6–S13). |

Похідні TODO (не блокуючі, трекати окремо): оновити `DESIGN_BRIEF.md` (§2), оновити `IMPLEMENTATION_PLAN.md` під Puppeteer (§5.5), синхронізувати `docs/modules/08-email.md` під 15 реальних шаблонів (зараз дрифт — див. `archive/MODULE_AUDIT.md`). Додати `wallet` пункт у `PORTAL_NAV` (вже в `prototype.jsx`).

---

_Цей файл — живий. Тримай §5 синхронним з кодом при кожному UI-PR._
