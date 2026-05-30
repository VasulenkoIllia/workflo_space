# BACKLOG

**Призначення:** capture-буфер для ідей, фіч та доопрацювань, які не входять у поточний спринт але мають бути зафіксовані, щоб не загубитися. Не плутати з `TRACKER.md` (живі задачі) чи модульними доками (стабільні рішення).

---

## Workflow

1. **Зловив ідею під час кодингу/обговорення** → додав запис у відповідну секцію нижче.
2. **Планування спринту** → переглядаємо BACKLOG, обираємо що тягнемо у `TRACKER.md`, інше залишаємо.
3. **Реалізували** → видаляємо з BACKLOG, додаємо у TRACKER зі статусом done (для аудиту).
4. **Розчарувалися в ідеї** → видаляємо без переходу у TRACKER (раз на місяць).

Формат запису:

```
- [контекст] Короткий опис ідеї. Пояснення user value. (created: YYYY-MM-DD)
```

---

## ✅ Закрито (реалізовано / абсорбовано у модулі) — 30 травня 2026

> Прибрано з активного беклогу. Лишаю слід для аудиту.

- **D1** `can()` читає `CompanyMember.permissions` → реалізовано (`apps/api/src/auth/can.ts`). (S1.5, task #43)
- **D2** `notifyRecipient()` profile-less overload → реалізовано (`packages/notifications/src/notify.ts:276`). (S1.5)
- **D5** enum-drift guard test → `packages/types/tests/enum-drift.test.ts`. (S1.5)
- **Centralized error formatter** → `registerErrorHandlers(app)` (`apps/api/src/plugins/errorHandler.ts`). (S1)
- **schema-prep:** `Payment.status` enum (PaymentStatus) → у схемі. (S1.5)
- **schema-prep:** `ExecutorRate.{currency, effectiveFrom, effectiveUntil, hireDate}` → у схемі. (S1.5)
- **bot inline buttons** → абсорбовано у `15-bot.md` (interactive commands + inline). (фіналізація)
- **reports PDF/XLSX export** → абсорбовано у `19-reports.md` (PDF/XLSX + scheduled). (фіналізація)
- **credentials 2FA на reveal** → абсорбовано у `17-credentials.md`. (фіналізація)
- **/status сторінка** → абсорбовано у `21-system-monitoring.md` (публічна status-page). (фіналізація)
- **S3/R2 storage adapter** → рішення зафіксовано у `04-files.md` (`S3StorageAdapter`); лишається тригер «коли перемикати» нижче.
- **payment providers (Stripe/Mono/WayForPay)** → архітектура у `05-billing.md` (`PaymentProvider`).

---

## 📦 Відкладені фічі з модульного аналізу (вікторина 30.05 — НЕ обрано)

> Свідомо відкладені під час пропрацювання 25 модулів. Кандидати на пізні спринти.

- [calendar/leave] **Календар держсвят (UA)** — авто-виключення держсвят з робочих днів і accrual відпусток. Holiday-таблиця + сид. (modules 23/24) (created: 2026-05-30)
- [files] **Антивірус-скан завантажень** (ClamAV/перед-публікація) + **версіонування файлів**. (module 04) (created: 2026-05-30)
- [notifications] **Quiet-hours / digest** — не слати вночі, агрегувати у дайджест. (module 07) (created: 2026-05-30)
- [billing] **Купони / промокоди** на інвойси + **LiqPay** як ще один провайдер. (module 05) (created: 2026-05-30)
- [referral] **Багаторівневий реферал** (2-й рівень) + **cash-out бонусів** (виведення, не лише списання на оплату). (module 09) (created: 2026-05-30)
- [content] **Заплановані публікації блогу** (scheduled publishing з чергою). (module 11) (created: 2026-05-30)
- [team] **Навички/компетенції виконавців** (skills matrix для авто-розподілу замовлень). (module 12) (created: 2026-05-30)

---

## 🚀 Нові фічі (не блокують MVP)

- [analytics] Дашборд retention клієнтів (NEW → REGULAR conversion rate, P50 time-to-second-order). Кандидат у модуль 19/21. (created: 2026-04-15)
- [ux] Темна тема у portal — зараз тільки у workspace; портал у legacy "always light". Тех-завдання фронту (module 13 appearance). (created: 2026-04-16)
- [integrations] Slack notification adapter — новий канал у матриці поряд з Telegram, для команд клієнтів зі Slack. (created: 2026-04-16)
- [finance] **Фаза 2 модуля фінансів** — маржа по кожному клієнту (cost allocation equal/weighted/by_revenue). Робимо після наповнення реєстру витрат реальними даними. Док готовий (`22-finance-expenses.md`), код пізніше. (created: 2026-05-29)

---

## 🌱 Foundation seams (рішення задокументоване, код пізніше)

- [D3] **Спільний date-range primitive для leave + calendar** — leave як availability-проєкція у календарі, щоб не будувати дві системи дат. (док 23/24 готовий; код у S-calendar) (created: 2026-05-29)
- [D4] **Recurring-billing на `CompanyService`/`ServiceCharge`** (`frequency`+`nextChargeAt`); чернетку `company_billing_subscription` відкинуто. (док 05 готовий; код у S5) (created: 2026-05-29)
- [chat] **@-mention picker** — `GET /orders/:id/participants` + frontend автокомпліт + explicit `mentionedUserIds` (замість regex по імені). (док 03 готовий; код S2) (created: 2026-05-29)
- [api] **DRY session helper** — `createSession(tx, profileId, reply)` для register/login/refresh (дубль 3×, тести покривають). (created: 2026-05-29)
- [api] **`can()` executor-management під admin-guard** — зараз будь-який executor може запросити/деактивувати executor'а. (також у модулях 12/13) (created: 2026-05-29)
- [expense] `Expense` immutability — `validFrom`/`validUntil` щоб історичний P&L не «їхав» при редагуванні; реальний FK замість `sourceRef`-рядка; soft-delete. (module 22) (created: 2026-05-29)

---

## 🛠 Технічний борг

- [db] Migration smoke test — script що накатує всі міграції на чистий PG + seed (для CI). (created: 2026-04-15)
- [notifications] Bulk send для масових розсилок (newsletter, system maintenance) — `notify()` per-profile, для 1000+ recipient'ів треба батч через outbox. (created: 2026-04-22)
- [auth] Геозбагачення login-аудиту (IP→місто) — `refresh_tokens.{ip,userAgent}` вже є (module 01); лишається human-readable geo + alert на нову локацію. (created: 2026-04-22)
- [orders] Soft-delete UI для відновлення deleted orders (admin-only, 30d window). (created: 2026-04-18)

---

## 🗄 DB hardening (additive, до появи нових таблиць)

- [db] Дубль `Profile.telegramChatId` vs `NotificationSettings.telegramChatId` → одне джерело істини (рішення у 15-bot.md: NotificationSettings authoritative; прибрати другу колонку). (created: 2026-05-29)
- [db] Відсутні FK-індекси: `Invite.invitedById`, `PasswordResetToken.email`, `Referral.referredId`, `Payment.confirmedBy`, `Document.createdById/executorId`, `BlogPost.authorId`, `OrderComment.authorId`. (created: 2026-05-29)
- [db] Прибрати марний `OtpToken @@index([code, purpose])`. (created: 2026-05-29)
- [db] Явний `onDelete` на `Order.company` (зараз implicit NO ACTION — конфліктує з cascade-патерном). (created: 2026-05-29)
- [db] `Decimal(8,4)` → `Decimal(10,4)` для exchange-rate колонок (headroom). (created: 2026-05-29)
- [db] High-volume таблиці (notification_logs, audit_logs, activity_logs, time_logs) — UUIDv7/BIGINT PK для НОВИХ таблиць (фрагментація індексу на UUIDv4). (created: 2026-05-29)
- [ops] **Auto-apply міграцій на деплої** — додати `prisma migrate deploy` у pipeline (S1.5-D); матричні таблиці інакше можуть не існувати на staging. (created: 2026-05-29)

---

## 🧪 Потребує дослідження

- [billing] Go-live провайдер: Monobank Acquiring vs Stripe (UA-резиденство, комісії, payout). Архітектура `PaymentProvider` готова — лишається бізнес-рішення. (created: 2026-04-15)
- [storage] Тригер переходу local FS → Cloudflare R2: за яким обсягом/потребою CDN. Адаптер готовий (04). (created: 2026-04-16)
- [rbac] Чи потрібен повноцінний CASL, чи `can()` shim вистачить навіть для enterprise? (task #24) (created: 2026-04-19)

---

## 📚 Документація

- [docs] Public API docs — Swagger UI для integration-партнерів ( tie: API-ключі агенції, module 20; topic #10). (created: 2026-04-20)
- [docs] Runbook для on-call: "що робити коли SMTP/Telegram/DB лягло". (created: 2026-04-22)

---

## 🐛 Виявлені баги (без severity SEV0/1)

- _(порожньо — критичні з аудиту виправлено в 711f506)_

---

> **Правило:** якщо ідея сидить у BACKLOG > 90 днів без обговорень — видаляємо її. Не реалізовано = не потрібно зараз.
