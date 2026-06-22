# NOTIFICATIONS MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: API (api.workflo.space) + всі consumer-додатки
> Статус: S1 (multi-channel matrix architecture)
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 27 травня 2026

---

> 🔄 **design-v2 (2026-06-20):** доставлено **notification center** — 10 екранів (стрічка нотифікацій, loyalty-tiers, announcements, digest config, wait-thresholds): [`workspace-notify.jsx`](../../design-v2/project/workspace-notify.jsx) + data. 🟡 **частково** (звірено): `Notification` модель + write-path є, але **read-feed/mark-read API нема**; announcements — greenfield. Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).

## Огляд

Централізований сервіс нотифікацій з **матричною архітектурою**: 7 категорій × 6 каналів × 27 events. Все надсилається через єдину функцію `notify()` з `@workflo/notifications`. MVP підтримує **email + telegram + in_app**; sms / push / webhook зареєстровані в `CHANNELS` registry але `enabled: false` (готові до S7+).

Дивись також: **ADR-003** (channels strategy + critical events lock).

---

## 1. Категорії (NotificationCategory)

7 категорій з `@workflo/types`:

| Category    | Опис                                | Приклади events                                                                                                         |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `auth`      | автентифікація, відновлення доступу | welcome, password_reset, email_verification, login_from_new_device                                                      |
| `orders`    | життєвий цикл замовлень             | created, status_changed, assigned, file_uploaded, due_soon, overdue, specification_ready                                |
| `chat`      | коментарі та згадки                 | new_comment, mention                                                                                                    |
| `billing`   | фінансові події                     | invoice_sent, invoice_paid, invoice_overdue, payment_failed, refund_issued, subscription_charged, subscription_expiring |
| `documents` | згенеровані документи               | completion_act_ready, reconciliation_act_ready                                                                          |
| `loyalty`   | програма лояльності                 | tier_upgraded, discount_applied                                                                                         |
| `system`    | системні події                      | maintenance_planned, invite_sent, company_member_added                                                                  |

Event → Category mapping — у `EVENT_TO_CATEGORY` (`packages/types/src/constants.ts`).

---

## 2. Канали (NotificationChannel)

| Channel    | enabled  | cost | requiresUserOptIn | Note                                      |
| ---------- | -------- | ---- | ----------------- | ----------------------------------------- |
| `email`    | ✅ true  | low  | false             | Базовий канал; mailcow прод, mailpit dev. |
| `telegram` | ✅ true  | low  | true              | grammY bot; opt-in через `/start <code>`. |
| `in_app`   | ✅ true  | free | false             | Запис у `notifications` table; SSE push.  |
| `sms`      | ❌ false | high | true              | S7+; Twilio або SMSC.                     |
| `push`     | ❌ false | free | true              | S8+; PWA / native app.                    |
| `webhook`  | ❌ false | free | true              | Enterprise; per-tenant webhook URL.       |

`disabled` канали мовчки пропускаються resolver'ом (forward-compat).

---

## 3. User preferences (matrix)

Таблиця `notification_preferences`:

```
settingsId × category × channel → enabled
```

Тобто 7 × 6 = до 42 рядків на користувача (реально 7 × 3 = 21 рядок для MVP-каналів).

При `POST /auth/register` створюється `NotificationSettings` + дефолтні preferences (all categories × {email, telegram, in_app} = enabled by default).

UI у `/profile/settings/notifications`:

- Матриця 7×3 (категорія × email/telegram/in_app).
- Чекбокси.
- Кнопка "Підключити Telegram" якщо `telegramChatId` ще не linked.
- **Disabled state** для auth+billing email column з tooltip: "Критичні події завжди надходять на email (ADR-003)".

---

## 4. Critical events (lock)

Список у `CRITICAL_EVENTS` (`packages/types/src/constants.ts`):

```
auth.password_reset
auth.email_verification
auth.login_from_new_device
billing.invoice_sent
billing.invoice_paid
billing.invoice_overdue
billing.payment_failed
billing.refund_issued
```

Для цих events **email завжди надсилається**, незалежно від user preferences (resolver додає email у targetChannels override).

---

## 5. Архітектура коду

```
packages/notifications/src/
├── config.ts                       # Zod env validation
├── resolver.ts                     # resolveTargetChannels()
├── dispatch.ts                     # per-channel render + dispatch routers
├── notify.ts                       # main orchestrator (DI via NotifyDeps)
├── index.ts                        # public exports
├── channels.ts (re-exports from @workflo/types)
├── adapters/
│   ├── EmailAdapter.ts             # sendEmail() → typed result
│   └── TelegramAdapter.ts          # sendTelegram() → typed error states
├── email/
│   ├── mailer.ts                   # Nodemailer transport singleton
│   ├── i18n.ts                     # uk/en translate()
│   ├── render.ts                   # HTML layout + escapeText/Attr
│   └── templates/
│       ├── welcome.ts
│       ├── inviteExecutor.ts
│       ├── inviteCompanyMember.ts
│       └── passwordReset.ts
└── telegram/
    ├── bot.ts                      # grammY Bot singleton
    ├── escape.ts                   # HTML parse_mode escape
    └── templates/
        └── index.ts                # 7 telegram templates
```

---

## 6. Flow: `notify(deps, input)` step-by-step

1. Load `NotificationSettings` (через `prisma.notificationSettings.findUnique` за `profileId`).
2. Load `Profile` (для email + name + language).
3. `resolveTargetChannels(prisma, settings.id, event)`:
   - look up category from `EVENT_TO_CATEGORY[event]`,
   - fetch enabled prefs for that category,
   - filter by `CHANNELS[c].enabled === true`,
   - if event in `CRITICAL_EVENTS` → force-add 'email',
   - return stable-ordered array.
4. For each channel:
   - **Email** → `renderEmailForEvent()` → `sendEmail()` → typed result.
   - **Telegram** → `renderTelegramForEvent()` → `sendTelegram()`. If result = `'failed' / reason='blocked'` → call `deps.onTelegramBlocked(profileId)` (API layer auto-disables telegram channel prefs).
   - **in_app** → write row у `notifications` table (якщо `input.inApp = {title, body}` надано).
5. Persist `NotificationLog` row per channel: `{ event, channel, status, errorCode?, metadata }`.
6. Return `NotifyOutcome { results, attempted }`.

`notify()` **ніколи не кидає** — всі помилки збираються у `results`.

---

## 7. Anti-spam: rollup

Якщо для одного `settingsId` за останні **10 секунд** вже є ≥ **3** `NotificationLog` records з тим самим `event` → надсилаємо 1 rollup-message замість N окремих:

- Email: subject "X нових подій у [order/company/etc]" + дайджест.
- Telegram: 1 повідомлення з bullet-list.
- Решта N-1 events маркуються `rollup_target_id` → id master log row.

Параметри: `NOTIFICATION_ROLLUP_WINDOW_MS = 10_000`, `NOTIFICATION_ROLLUP_THRESHOLD = 3` (`@workflo/types/constants`).

Implementation note: rollup-detection query використовує index `notification_logs_rollup_idx ON (settingsId, event, createdAt DESC)`. Запит limit 3 + check first row's `createdAt > now() - 10s`.

---

## 8. Escalation: order overdue

Окремий від rollup механізм. Якщо order має `deadline < now()` і немає transition в done за останні **4 години**:

- надсилаємо `orders.overdue` event owner'у замовлення (escalation),
- логуємо у audit_logs.

Виконується кроном `C16:overdue_escalation` (кожні 30хв; див. `CRON_JOBS.md`).

---

## 9. Telegram opt-in flow

1. User у `/profile/settings/notifications` натискає "Підключити Telegram".
2. API генерує `OtpToken(purpose='telegram_link', value=6-digit code)`, повертає deep link `https://t.me/<bot>?start=<code>`.
3. User відкриває посилання → Telegram bot отримує `/start <code>`.
4. Bot endpoint `/bot/webhook` (`packages/bot`) перевіряє код:
   - валідний + не expired → save `chatId` у `NotificationSettings.telegramChatId` + `telegramLinkedAt = now()`.
   - rate limit: 5 спроб / 15 хв per IP — захист від OTP brute force (`docs/modules/15-bot.md`).
5. Bot відповідає "✅ Telegram підключено!" + надсилає welcome telegram via `notify()`.

---

## 10. Telegram blocked handling

Коли bot заблокований користувачем (Telegram повертає 403):

- `TelegramAdapter` повертає `{ status: 'failed', reason: 'blocked' }`.
- `notify()` викликає `deps.onTelegramBlocked(profileId)`.
- API-callback виконує: `UPDATE notification_preferences SET enabled=false WHERE settings_id=$1 AND channel='telegram'` (всі категорії).
- Audit log: `notifications.telegram_auto_disabled` з reason='blocked_by_user'.
- Email-fallback автоматично активується для критичних events (CRITICAL_EVENTS).

User може знову увімкнути в `/profile/settings/notifications` (це reset bot block через unblock у Telegram).

---

## 11. Адаптери

### EmailAdapter

```typescript
type EmailSendResult =
  | { status: 'sent'; messageId?: string; response?: string }
  | { status: 'rejected'; reason: 'address_rejected'; rejectedAddresses: ReadonlyArray<string> }
  | { status: 'failed'; reason: 'transport_error'; error: string }
```

Ніколи не throws. Помилки SMTP → status='failed'.

### TelegramAdapter

```typescript
type TelegramSendResult =
  | { status: 'sent'; messageId: number }
  | { status: 'skipped'; reason: 'bot_not_configured' }
  | { status: 'failed'; reason: 'blocked'; error: string }
  | { status: 'failed'; reason: 'invalid_chat'; error: string }
  | { status: 'failed'; reason: 'rate_limited'; retryAfter: number; error: string }
  | { status: 'failed'; reason: 'transport_error'; error: string }
```

Distinguishes між:

- 403 → `blocked` (user заблокував bot),
- 400 + "chat not found" → `invalid_chat` (chatId недійсний),
- 429 → `rate_limited` (з `retryAfter` секунд для backoff).

---

## 12. Тести

`packages/notifications/tests/`:

- `config.test.ts` — Zod env validation, missing/short/coerce paths.
- `i18n.test.ts` — locale lookup + fallback uk→en→key + var interpolation.
- `render.test.ts` — escape helpers + layout structure.
- `templates.test.ts` — render output, XSS escape in vars (welcome/invites/reset + 7 telegram).
- `escape.test.ts` — Telegram HTML parse_mode compliance.
- `resolver.test.ts` — critical lock, disabled-channel filter, ordering, dedup.
- `notify.test.ts` — missing settings/profile graceful exit, log persistence, telegram-no-chat skip.

`pnpm --filter @workflo/notifications test`

---

## 13. Метрики (production)

Збирати в `audit_logs` через cron + експонувати:

- `notify.dispatch.total{event, channel, status}` — лічильник.
- `notify.dispatch.duration_ms{channel}` — histogram.
- `notify.rollup.applied{event}` — скільки разів спрацював rollup.
- `notify.telegram.blocked_total` — auto-disable events.

Алерт: `notify.dispatch.failed_rate{channel=email} > 5%` за 10хв → PagerDuty.

---

## 14. Migration path для нових каналів

Щоб додати SMS:

1. Поставити `enabled: true` для `sms` у `CHANNELS` registry (`@workflo/types/constants.ts`).
2. Створити `packages/notifications/src/adapters/SmsAdapter.ts` з тим самим shape result-union.
3. Додати dispatch branch у `notify.ts`.
4. Додати SMS templates у `src/sms/templates/` (короткі, 160-char limit, без HTML).
5. Опціонально: додати UI картку "SMS" у `/profile/settings/notifications`.
6. `requiresUserOptIn: true` → потрібен phone verification flow (відрізняється від email — SMS може йти лише після SMS OTP).

Решта `notify()` логіки **не змінюється** — resolver автоматично підхопить новий канал.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові канали

> Авторитетна секція.

### A. Обов'язкові reconcile

- **Retry/DLQ через outbox** (тема #2): `notify()` стає producer'ом події → воркер дispatch'ить з ретраями (Telegram `retryAfter`, email backoff), `NotificationLog.status` re-driven; cron `C-notify_retry`. Idempotency-key на `NotificationLog` (один event двічі → один лист).
- **Per-agency template resolution**: agency-override → agency-default → платформний хардкод. `NotificationLog` + settings отримують `agencyId`.
- **vars-scrub** (✅ SC-1 виправлено). **Rollup** позначити NOT-YET-IMPLEMENTED (модель є, код ні).

### B. In-app центр (дзвіночок) ✅

- `GET /notifications?cursor=&unreadOnly=`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`. `Notification` таблиця є (isRead + індекси). Дзвіночок з лічильником у layout (SSE live +1).

### C. Web Push (PWA/браузер) ✅

- Увімкнути канал `push` у registry. `PushSubscription { id, profileId, agencyId, endpoint, p256dh, auth, userAgent, createdAt }`.
- Service worker + VAPID keys (env `VAPID_PUBLIC/PRIVATE_KEY`). `PushAdapter` (web-push lib). Opt-in: користувач дозволяє в браузері → save subscription. Resolver підхопить канал автоматично.

### D. SMS-канал ✅

- Увімкнути канал `sms`. `SmsAdapter` з провайдером per-agency: TurboSMS/SMSC (UA) або Twilio (intl). `AgencySmsSettings { agencyId, provider, apiKey, sender }`.
- `requiresUserOptIn` + phone-verification flow (SMS OTP) перед увімкненням. Шаблони — короткі (160 chars, без HTML) у `src/sms/templates/`. Лише для критичних подій (cost-aware).

### Schema-зміни (foundation-міграція)

```
NotificationSettings: + timezone, agencyId
NotificationLog: + agencyId, idempotencyKey
New: PushSubscription, AgencySmsSettings; channels push+sms enabled у CHANNELS registry
```

> **→ BACKLOG (не обрано):** quiet-hours + digest mode.

## Беклог-промоут (30.05) → у план

- **Quiet-hours / digest** (S12): per-profile тихі години (не слати некритичні вночі) + агрегація у дайджест-розсилку. `NotificationPreference.{quietFrom, quietTo, digestMode}`. CRITICAL_EVENTS (ADR-003) ігнорують quiet-hours. Знижує notification-fatigue.
- **Bulk-розсилки** (S12): масові розсилки (newsletter/maintenance) батчем через **outbox**, не per-profile `notify()`. `BulkBroadcast {agencyId, segment, channel, templateId, status}` + worker. Сегментація по тіру/статусу.

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

Прийнято власником (усі 5):

| ID   | Рішення                                                                                | Вплив               | Нюанси власника                                                                                                              |
| ---- | -------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 07-А | **Ранкове зведення (дайджест-звіт)** власнику/команді                                  | [бек]               | З налаштуваннями: **ЩО включати, КОЛИ і КОМУ надсилається** (конфігурований дайджест, не хардкод)                            |
| 07-Б | **«Клієнт чекає відповіді»** — нагадування і ескалація                                 | [бек]               | Налаштування порогів: коли не відповіли клієнту → нагадати виконавцю; немає відповіді працівників у чаті → ескалація owner-у |
| 07-В | **In-app оголошення/банери** (всім клієнтам або сегменту, з підтвердженням прочитання) | [бек+екран дрібний] | На SaaS-фазі — також «платформа → тенанти»                                                                                   |
| 07-Г | **Mute конкретного замовлення** (1 год / до завтра / назавжди)                         | [бек] + іконка      |                                                                                                                              |
| 07-Д | **Кнопка «надіслати тестове сповіщення»** у налаштуваннях каналів                      | [бек] копійка       |                                                                                                                              |

Для ТЗ дизайнеру: налаштування дайджесту (що/коли/кому) (А); налаштування порогів невідповіді (Б); банер оголошення + адмін-список оголошень (В); mute-контрол у чаті (Г); кнопка тестового сповіщення (Д).
