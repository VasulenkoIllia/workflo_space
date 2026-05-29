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

## 🚀 Нові фічі (не блокують MVP)

- [analytics] Дашборд retention клієнтів (NEW → REGULAR conversion rate, P50 time-to-second-order). (created: 2026-04-15)
- [ux] Темна тема у portal — зараз тільки у workspace; портал у legacy "always light". (created: 2026-04-16)
- [integrations] Slack notification adapter — паралельно з Telegram, але для команд клієнтів з Slack як основним каналом. (created: 2026-04-16)
- [bot] Inline buttons для швидких відповідей у Telegram (approve/reject/comment) — зараз тільки text. (created: 2026-04-18)
- [reports] Експорт reports у PDF (поточно лише CSV + on-screen). (created: 2026-04-22)
- [credentials] Двофакторне підтвердження для credentials.read (TOTP або email-link), а не лише owner role. (created: 2026-04-23)
- [finance] Фаза 2 модуля фінансів — маржа по кожному клієнту (cost allocation: equal/weighted/by_revenue розподіл спільних витрат на клієнтів). Робимо після наповнення реєстру витрат реальними даними. Див. modules/22-finance-expenses.md. (created: 2026-05-29)

## 🛠 Технічний борг

- [api] Centralized error formatter — зараз кожен handler формує `{error: {...}}` сам, варто винести у helper. (created: 2026-04-14)
- [db] Migration smoke test — script що накатує всі міграції на чистий PG і запускає seed (для CI). (created: 2026-04-15)
- [notifications] Bulk send для масових розсилок (newsletter, system maintenance) — поточно `notify()` per-profile, для 1000+ recipient'ів буде overkill. (created: 2026-04-22)
- [auth] Захоплення геолокації + UA при login + audit-log запис для security. (created: 2026-04-22)
- [orders] Soft-delete UI для відновлення deleted orders (admin-only, 30d window). (created: 2026-04-18)

## 🧪 Потребує дослідження

- [billing] Stripe vs LiqPay для прийому платежів у production. Зараз manual + bank transfer. (created: 2026-04-15)
- [storage] Перейти з local FS на S3-compatible (Cloudflare R2)? Backups+CDN з коробки. Вартість vs Hetzner volume. (created: 2026-04-16)
- [rbac] Чи потрібен повноцінний CASL? Чи `can()` shim вистачить навіть для enterprise? (task #24) (created: 2026-04-19)

## 📚 Документація

- [docs] Сторінка статусів `/status` (uptime, last deploy, planned maintenance). (created: 2026-04-15)
- [docs] Public API docs — Swagger UI для майбутніх integration партнерів. (created: 2026-04-20)
- [docs] Runbook для on-call: "що робити коли SMTP/Telegram/DB лягло". (created: 2026-04-22)

## 🔬 Post-S1 аудит — follow-ups (29 травня 2026)

> Знайдено аудитом (code-reviewer + database-reviewer + architect). КРИТИЧНІ security + migration-safety вже виправлено (commit 711f506). Нижче — те, що варто зробити, але не блокувало.

### «Do now» seams (дешево зараз, дорого пізніше — рекомендація архітектора)

- [D1] **`can()` має читати `CompanyMember.permissions`** (колонка існує, не використовується). Модуль 05 вже вимагає `can_view_billing` per-member. Найвищий пріоритет — поки actions ~18, не 100. Це НЕ повний RBAC (task #24), а навчити shim читати наявну колонку. (created: 2026-05-29)
- [D2] **profileId-free `notify()` overload** (`notifyRecipient(deps, {recipient})`) — тип `Recipient` вже є у dispatch.ts. Розблоковує зовнішніх гостей календаря + прибирає дубль у inviteEmail.ts (який шле в обхід матриці). (created: 2026-05-29)
- [D3] **Спільний date-range primitive для leave + calendar** — leave як підтип календарної події / availability, щоб не будувати дві системи дат. (created: 2026-05-29)
- [D4] **Уніфікувати recurring-billing** на `CompanyService`/`ServiceCharge`; відкинути чернетку `company_billing_subscription`; додати `frequency`+`nextChargeAt` у CompanyService якщо потрібна квартальна/річна. (зроблено в доку 05; код — S5) (created: 2026-05-29)
- [D5] **enum-drift guard test** — тест, що `@workflo/types` enums === Prisma enums (IMPLEMENTATION_PLAN вже розійшовся). (created: 2026-05-29)

### S1.5 schema prep (additive міграція до того, як з'являться нові таблиці)

- [db] `Payment.status` enum {pending|confirmed|failed|refunded} — P&L-запит у модулі 22 фільтрує `status='confirmed'`, а колонки немає. (created: 2026-05-29)
- [db] `ExecutorRate`: додати `currency`, `effectiveFrom`/`effectiveUntil`, `hireDate` — потрібні для P&L (історична ЗП) і leave accrual. (created: 2026-05-29)
- [db] Вирішити дубль `Profile.telegramChatId` vs `NotificationSettings.telegramChatId` (одне джерело істини). (created: 2026-05-29)
- [db] Відсутні FK-індекси: `Invite.invitedById`, `PasswordResetToken.email`, `Referral.referredId`, `Payment.confirmedBy`, `Document.createdById/executorId`, `BlogPost.authorId`, `OrderComment.authorId`. (created: 2026-05-29)
- [db] Прибрати марний `OtpToken @@index([code, purpose])`. (created: 2026-05-29)
- [db] Явний `onDelete` на `Order.company` (зараз implicit NO ACTION — конфліктує з cascade-патерном). (created: 2026-05-29)
- [db] `Decimal(8,4)` → `Decimal(10,4)` для exchange-rate колонок (headroom). (created: 2026-05-29)

### Менш термінове (з аудиту)

- [api] **DRY session helper** — `createSession(tx, profileId, reply)` для register/login/refresh (membership + claims + token + cookie дублюється 3×). Тести покривають → рефактор безпечний. (created: 2026-05-29)
- [api] **`can()` executor-management під admin-guard** — зараз будь-який executor може запросити/деактивувати executor'а. (created: 2026-05-29)
- [api] **Auto-apply міграцій на деплої** — у pipeline немає `prisma migrate deploy`; матричні таблиці можуть не існувати на staging до ручного запуску. (created: 2026-05-29)
- [db] High-volume таблиці (notification_logs, audit_logs, activity_logs, time_logs) на UUIDv4 PK → фрагментація індексу. Розглянути UUIDv7/BIGINT для НОВИХ таблиць. (created: 2026-05-29)
- [db] `Expense` (модуль 22): immutable history / `validFrom`/`validUntil` щоб історичний P&L не «їхав» при редагуванні; реальний FK замість `sourceRef` рядка; soft-delete. (created: 2026-05-29)

## 💬 Chat @-mention picker (29 травня 2026)

- [chat] `GET /orders/:id/participants` + frontend @-автокомпліт + explicit `mentionedUserIds` (замість крихкого regex по імені). Задокументовано в 03-chat-comments.md; реалізація з чатом у S2. (created: 2026-05-29)

## 🐛 Виявлені баги (без severity SEV0/1)

- _(порожньо — критичні з аудиту виправлено в 711f506)_

---

> **Правило:** якщо ідея сидить у BACKLOG > 90 днів без обговорень — видаляємо її. Не реалізовано = не потрібно зараз.
