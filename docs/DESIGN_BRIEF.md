# DESIGN BRIEF — Workflo.space

> Для дизайнера. ТЗ на UI/UX для трьох додатків: Landing, Portal, Workspace.
> Версія: 1.0 | Оновлено: 27 травня 2026

---

> ## ⚠️ ЧАСТКОВО SUPERSEDED (2026-05-29)
>
> Після ітерацій з Claude Design дизайн пішов **іншою візуальною мовою**, ніж описано в §1 (Brand identity) цього файлу.
>
> **Канонічне джерело візуальної мови** — [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) (зокрема §3 токени):
>
> - **Акцент:** лайм `#A3D90D` / `#C5F82A` (не `#0F62FE`)
> - **Нейтралі:** теплі stone `#FAFAF9` / `#E7E5E4` / `#0C0A09` (не сіро-сині)
> - **Шрифти:** **Geist** (body) + **JetBrains Mono** (mono) + **Caveat** (підписи) — не Inter
> - **Семантика:** success `#059669` · warning `#D97706` · destructive `#DC2626`
> - **Естетика:** «Engineer's Cut» — термінал (режим A), `[ … ]`-кнопки, `// group`-лейбли
> - **Палітра свапабельна:** 6 акцент-пресетів (lime / amber / cyan / indigo / rose / emerald) + custom-picker через token-injection seam (white-label SaaS)
>
> **Що з цього брифу досі актуальне:**
>
> - §0 — контекст продукту (3 додатки, аудиторії, tone)
> - §2–§4 (Landing / Portal / Workspace структура)
> - §6 (responsive)
> - §7–§9 (states / accessibility / deliverables)
>
> **Що superseded:**
>
> - §1 повністю (кольори + типографіка + dark theme) — заміна в `DESIGN_SYSTEM.md §3`
> - §5 (Компоненти) — заміна в `DESIGN_SYSTEM.md §3.6` + brandbook у `design-v2/project/brandbook*.jsx`
>
> Для нових модулів (Leads / Integrations / Client-Mgmt / Support / SaaS white-label) — окремий бриф [`DESIGN_BRIEF_GROWTH.md`](DESIGN_BRIEF_GROWTH.md).

---

## 0. Контекст продукту

**Workflo.space** — платформа для управління замовленнями digital-агенції. Три "обличчя":

| App           | Домен                | Аудиторія                           | Тон                                   |
| ------------- | -------------------- | ----------------------------------- | ------------------------------------- |
| **Landing**   | workflo.space        | Потенційні клієнти, SEO             | Маркетинговий, яскравий, переконливий |
| **Portal**    | portal.workflo.space | Клієнти агенції                     | Простий, дружній, прозорий            |
| **Workspace** | work.workflo.space   | Команда агенції (owner + executors) | Щільний, продуктивний, data-dense     |

Дизайн має бути **єдиним brand language** (кольори, шрифти, лого), але різна щільність інформації.

---

## 1. Brand identity

> ⚠️ **SUPERSEDED** (див. банер на початку файлу). Канонічні токени — у [`DESIGN_SYSTEM.md §3`](DESIGN_SYSTEM.md). Залишено для історичної довідки.

### ~~Кольори~~ (superseded)

| Token (старий) | Hex старий    | Реальне рішення (DESIGN_SYSTEM.md §3)    |
| -------------- | ------------- | ---------------------------------------- |
| `primary`      | ~~`#0F62FE`~~ | `--wf-accent` лайм `#A3D90D` / `#C5F82A` |
| `text`         | ~~`#1F2933`~~ | `--wf-fg` `#0C0A09` (stone)              |
| `text-muted`   | ~~`#6B7785`~~ | `--wf-fg-muted` `#78716C`                |
| `border`       | ~~`#E5E9F0`~~ | `--wf-border` `#E7E5E4` (stone)          |
| `bg`           | ~~`#F4F6FA`~~ | `--wf-bg` `#FAFAF9` (stone)              |
| `surface`      | ~~`#FFFFFF`~~ | `--wf-surface` `#FFFFFF`                 |
| `success`      | ~~`#24A148`~~ | `--wf-success` `#059669`                 |
| `warning`      | ~~`#F1C21B`~~ | `--wf-warning` `#D97706`                 |
| `danger`       | ~~`#DA1E28`~~ | `--wf-destructive` `#DC2626`             |

Dark theme: `--wf-bg` `#0A0A0A` / `--wf-surface` `#161616` / `--wf-fg` `#FAFAF9` (повна таблиця у DESIGN_SYSTEM.md §3.2).

### ~~Типографіка~~ (superseded)

- ~~Headings/Body: Inter~~ → **Geist** (300–700)
- Monospace: **JetBrains Mono** (✅ збігається)
- Підписи в документах: **Caveat** (нове — для PDF e-signature)
- Scale, line-height — див. DESIGN_SYSTEM.md §3.4

### Лого

- Wordmark "Workflo" з акцентом на "flo" (можливо градієнт primary→info).
- Icon-only варіант для favicon + sidebar collapsed (літера W у rounded square).

### Spacing scale

4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px (8px base grid).

### Radius

- Buttons / inputs: 8px.
- Cards: 12px.
- Modals: 16px.
- Pills / badges: 999px (full round).

---

## 2. Landing (workflo.space)

### Сторінки

- `/` — головна.
- `/services` — послуги.
- `/cases` — портфоліо/кейси.
- `/blog` + `/blog/:slug` — блог.
- `/pricing` — тарифи.
- `/contact` — контакти.
- `/about` — про нас.
- `/terms`, `/privacy` — legal.

### Головна — секції (зверху вниз)

1. **Hero**: H1 value prop + subheading + CTA "Почати" + ілюстрація/скріншот portal.
2. **Social proof**: логотипи клієнтів / "X замовлень виконано".
3. **Як це працює**: 3-4 кроки з іконками (Замовлення → Робота → Контроль → Оплата).
4. **Послуги**: grid карток (web, automation, design, marketing).
5. **Кейси**: 2-3 featured case studies з результатами.
6. **Чому ми**: переваги (прозорість, real-time, нотифікації).
7. **Тарифи preview**: 3 плани з CTA.
8. **CTA блок**: фінальний заклик + форма / кнопка реєстрації.
9. **Footer**: nav, контакти, legal, мова (uk/en).

### Особливості

- **Bilingual** (uk/en) — toggle у header.
- SEO-критичний: SSR/ISR, schema.org markup, OG-зображення per page.
- Швидкий (Lighthouse 90+).
- Анімації scroll-reveal (subtle, не distracting).

---

## 3. Portal (portal.workflo.space)

### Призначення

Клієнт бачить свої замовлення, статуси, рахунки, чати, лояльність. Просто й прозоро.

### Layout

- Top bar: лого + company switcher + notification bell + avatar menu.
- Sidebar (collapsible): Dashboard / Замовлення / Повідомлення / Рахунки / Лояльність / Реферали / Налаштування.
- Content area: responsive, max-width 1200px центрований.

### Екрани

#### `/dashboard`

- Привітання + швидка статистика (активних замовлень N, до оплати $X).
- Список останніх замовлень (картки зі статусом).
- Pending дії (рахунок чекає оплати, потрібне ваше схвалення).

#### `/orders` + `/orders/:id`

- List: фільтр по статусу (4 client statuses), search.
- Картка замовлення: title, статус badge (color-coded), deadline, ціна.
- Detail: опис, прогрес (stages), файли, чат (вбудований), історія статусів, кнопки дій ("Схвалити" коли pending_approval).

#### `/messages` (Chat Hub)

- 2-колонковий: список conversations зліва, активна розмова справа.
- Unread badges.
- Telegram-style. Mobile: 2-screen flow.

#### `/invoices`

- Список рахунків: status (pending/paid/overdue), сума, due date.
- Detail: позиції, total, кнопка "Оплатити" / реквізити.
- Download PDF.

#### `/loyalty`

- Tier картка (badge + назва + discount%).
- Progress bar до next tier ("До VIP залишилось $7,750").
- Список переваг.

#### `/referrals`

- Реферальний код + copy button + share.
- Список запрошених + статус + отриманий бонус.

#### `/settings`

- Profile (name, email, avatar, мова, тема).
- `/settings/notifications` — матриця 7×3 (категорія × email/telegram/in_app), Telegram link button. Критичні events email column disabled з tooltip.
- Companies management (для multi-company).

### Тон

- Мінімум jargon. "Замовлення в роботі", не "internal_status: in_progress".
- Кольорові status badges зрозумілі без легенди.
- Empty states з ілюстраціями + CTA.

---

## 4. Workspace (work.workflo.space)

### Призначення

Команда агенції керує всім: orders, executors, billing, документи, репорти, адмінка. Data-dense, продуктивно.

### Layout

- Top bar: лого + company switcher + global search + timer widget + notification bell + avatar.
- Sidebar (груповане):
  - **Робота**: Dashboard / Triage / Замовлення / Inbox / Kanban.
  - **Фінанси**: Рахунки / Платежі / Документи / Репорти.
  - **Команда**: Виконавці / Departments / Time tracking.
  - **Адмін** (admin only): System / Templates / SMTP / Branding / Nomenclature / Crons.
- Content: full-width, data tables.

### Timer widget (top bar, persistent)

```
┌──────────────────────────┐
│ ⏱ 01:23:45  "Order title" │  ← active timer running
│ [Stop]                    │
└──────────────────────────┘
```

- Завжди видно якщо timer active.
- Click → перехід до order.
- Перемикання на інший order auto-stops + showкає toast.

### Екрани

#### `/dashboard`

- KPI cards: revenue MTD, active orders, overdue invoices, team utilization.
- Charts: revenue trend, orders by status.
- Recent activity feed.

#### `/triage` (owner only)

- Список unassigned orders (нові від клієнтів).
- Швидке призначення executor (dropdown) + priority + перший статус.
- Count badge у sidebar.

#### `/orders` + `/orders/:id`

- Powerful table: всі колонки (internal status, executor, company, deadline, amount, billing type).
- Bulk actions.
- Detail: повна картка з усіма tabs (Overview / Time logs / Files / Chat / Stages / Specification / Documents / Activity).
- Owner-only кнопки: done, revision, cancel.

#### `/kanban`

- Колонки = internal statuses.
- Drag-drop між статусами (з validation rules).
- Card: title, executor avatar, deadline, priority dot.

#### `/inbox` (Chat Hub для executors)

- Як portal /messages але з фільтрами assigned/mentioned/all + company column.

#### Billing

- `/invoices` — таблиця + create.
- `/payments` — підтвердження платежів (manual), historія.
- `/reports/time|revenue|debtors` — звіти з charts + CSV export.

#### Team

- `/executors` — список + rates + departments.
- `/time-tracking` — overview активних таймерів + manual entry.

#### `/companies/:id/credentials` (owner only)

- Таблиця credentials: label / service icon / url / username / actions.
- Reveal modal з 2FA + 10s autohide + copy.
- Add/edit/revoke.

#### Admin (admin only)

- `/admin/system` — monitoring dashboard (health cards, cron table, audit feed, error log).
- `/admin/templates` — 162 template slots, edit з preview.
- `/admin/smtp` — sender cards + test connection.
- `/admin/branding` — logo/color/font + live invoice preview.
- `/admin/nomenclature` — CRUD table + bulk import.
- `/admin/departments` — CRUD table.
- `/admin/crons` — cron status + manual trigger.

### Тон

- Технічна точність OK (internal statuses, codes видимі).
- Keyboard shortcuts (J/K navigation, C create, / search).
- Dense tables з sort/filter/column toggle.
- Dark theme support.

---

## 5. Компоненти (shared design system)

Будуються у `packages/ui`. Дизайнер має передбачити всі стани (default/hover/active/disabled/loading/error).

### Базові

- Button (primary / secondary / ghost / danger; sm/md/lg; icon-only).
- Input / Textarea / Select / Checkbox / Radio / Toggle / DatePicker.
- Badge / Pill / Tag (status colors).
- Avatar (image / initials fallback; sizes).
- Card / Panel.
- Modal / Drawer / Popover / Tooltip.
- Toast / Alert banner.
- Tabs.
- Table (sortable, filterable, paginated, selectable rows).
- Skeleton loaders.
- Empty states (з ілюстраціями).
- Pagination / Cursor "load more".

### Складні

- Company switcher dropdown.
- Notification bell + dropdown panel.
- Timer widget.
- Chat message bubble + composer.
- Kanban card + column.
- Status badge (з mapping internal→client для portal).
- File upload dropzone + preview.
- Notification preference matrix.
- Progress bar (loyalty / stages).

### Status badge color mapping

**Client statuses (Portal):**

- in_progress → info blue
- pending_approval → warning yellow
- completed → success green
- cancelled → muted grey

**Internal statuses (Workspace):**

- new → grey, clarification → blue, estimating → purple, in_progress → blue (solid),
  review → yellow, revision → orange, done → green, cancelled → grey, on_hold → grey-dashed.

---

## 6. Responsive

- **Landing**: mobile-first, всі секції адаптивні.
- **Portal**: mobile-friendly (клієнти часто з телефону). Sidebar → hamburger drawer. Chat → 2-screen.
- **Workspace**: desktop-first (команда за компʼютерами). Min usable 1280px. Mobile = read-only degraded view (можна дивитися, не редагувати складне).

Breakpoints: 480 / 768 / 1024 / 1280 / 1536 px.

---

## 7. Empty / Error / Loading states

Для кожного списку/екрану дизайнер передбачає:

- **Loading**: skeleton (не spinner де можливо).
- **Empty**: ілюстрація + заголовок + опис + CTA ("Ще немає замовлень. Створіть перше →").
- **Error**: ілюстрація + "Щось пішло не так" + retry button.
- **No access (403)**: "У вас немає доступу" + back button.
- **Not found (404)**: брендована сторінка.

---

## 8. Notifications UI (in-app)

- Bell icon з unread count badge.
- Dropdown: список нотифікацій (icon per category + title + time + read/unread).
- "Mark all read" button.
- Click → перехід до relevant entity.
- Toast для real-time (SSE) подій (auto-dismiss 5s).

---

## 9. Accessibility

- Контраст WCAG AA (4.5:1 для тексту).
- Keyboard navigation для всіх interactive елементів.
- Focus states видимі.
- ARIA labels для icon-only buttons.
- Респект `prefers-reduced-motion`.

---

## 10. Deliverables (що очікуємо від дизайнера)

1. **Design tokens** (Figma variables): кольори, типографіка, spacing, radius.
2. **Component library** (Figma): всі компоненти зі станами.
3. **Landing**: всі сторінки desktop + mobile.
4. **Portal**: всі екрани desktop + mobile.
5. **Workspace**: всі екрани desktop (+ key mobile read-only).
6. **Empty/error/loading states** для key screens.
7. **Prototype** (Figma): основні user flows (register → create order → pay; executor: triage → assign → work → review).
8. **Icon set**: consistent (Lucide-based або custom).
9. **Email templates** mockup (welcome, invite, password reset, invoice) — для `@workflo/notifications`.
10. **Handoff**: Figma dev mode + assets export (SVG icons, logo variants, OG images).

---

## 11. Тех обмеження для дизайну

- Email templates: inline CSS only, table-based layout, no web fonts (system fallback), max 600px width. Дизайн має бути email-client safe (Gmail/Outlook/Apple Mail).
- Telegram messages: text-only з HTML (`<b>`, `<i>`, `<a>`, `<code>`) — без зображень у MVP. Дизайн = текстова структура + emoji.
- PDF документи (invoice/act): A4, friendly до друку, brandable (logo/color/font змінні).
- Charts: recharts/visx — дизайнер дає color palette + style, не custom rendering.

---

## 12. Reference / inspiration

- Linear (workspace density + keyboard UX).
- Stripe Dashboard (billing/reports clarity).
- Notion (clean component system).
- Telegram (chat UX).
- Vercel (landing modern feel).

Не копіюємо — беремо принципи clarity + density balance.
