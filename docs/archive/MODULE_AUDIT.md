# MODULE AUDIT — повний аналіз модулів (травень 2026) · ⚠️ ІСТОРИЧНИЙ

> **⚠️ ІСТОРИЧНИЙ ЗНІМОК (до S1.6/S2). НЕ джерело істини.** Більшість 🟠ADD-NOW / 🟡drift пунктів (agencyId-scoping, `OrderComment.editedAt`, `OrderFile.sha256`, `OrderChatRead`, `Payment.status`, OTP `attempts`) **вже виконано** в S1.5-S2. Актуальний стан: `SPEC.md` + `AUDIT_S0_S2.md` + код. Цей файл лишено для історії рішень.
>
> Результат паралельного аудиту 4 рецензентами (identity / work / money / platform) проти схеми/коду станом на травень 2026 (тоді 25 модулів; зараз 29).
> Мета (на той момент): що додати/доробити в кожному модулі, поки не почали S2.

---

## Три категорії знахідок

1. **🔴 Shipped-code issues (S1)** — реальні баги/витоки у вже задеплоєному коді.
2. **🟠 Foundational ADD-NOW** — рішення схеми, дешеві зараз / дорогі ретрофітити (роблять до S2, разом з tenancy-міграцією).
3. **🟡 Doc↔reality drift** — багато квітневих доків описують поля/моделі/enum'и, яких НЕМАЄ в `schema.prisma` (деякі cron'и й report-SQL фізично не запустяться).

---

## 🔴 Shipped-code issues (S1) — виправити скоро

| #    | Проблема                                                                                                                                                | Файл                                   | Дія                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| SC-1 | `notify()` пише `metadata: { vars }` у `notification_logs` — а vars містять **живі токени** (`resetUrl`, `invoiceUrl`) + PII. Персистяться у БД.        | `packages/notifications/src/notify.ts` | Scrub/allowlist vars перед записом (прибрати \*Url/token поля)                 |
| SC-2 | Telegram split-brain: `Profile.telegramChatId` (пише bot) vs `NotificationSettings.telegramChatId` (читає notify). Розійдуться → linked-але-не-отримує. | schema + 15-bot + notify               | Одне джерело істини (NotificationSettings для dispatch); bot пише туди. До S6. |
| SC-3 | `notify()` ніколи не консультує `CRITICAL_EVENTS` для profile-less `notifyRecipient` — межу задокументувати.                                            | notify.ts                              | Документувати + (опц.) застосувати lock                                        |

---

## 🟠 Foundational ADD-NOW (схема — до S2, разом з tenancy)

> Це «хребет» — повторюється у всіх 4 кластерах. Найдешевше закласти зараз (БД мала/порожня), найдорожче потім.

### T1. `agencyId` скрізь (ADR-004 Фаза 0, task #45)

Денормалізувати `agencyId` на гарячі таблиці (orders, order_comments, order_files, time_logs, payments, documents, wallet_transactions, audit_logs, notification_logs) + composite-індекси `(agencyId, …)`. Singleton'и → per-agency (`payment_settings`, `exchange_rates`, `pdf_branding`, `notification_templates`, `smtp_senders`, `referral_settings`, `service_nomenclature`, `departments`, `document_counters`). Без цього: cross-tenant витоки у reports/search/audit + найдорожчий ретрофіт.

### T2. TimeLog — уніфікувати модель (02/12/19 конфліктують)

Жива схема = старе `{date, hours, comment}`. Orders-footer + reports вимагають `{startedAt, endedAt, durationSec, autoStopped, autoStopReason, internalTaskId, description, billingMode}` + partial-unique «1 активний таймер». **Report-SQL не запуститься** проти поточної схеми. Обрати одну модель (таймерну) → міняти timer, auto-stop cron C15, reports.

### T3. Фінансовий фундамент (money-кластер)

- **VAT/ПДВ**: `taxRatePct`, `taxAmount`, `netAmount`, tax-inclusive flag + `agency.defaultTaxRatePct`. Зараз НЕМАЄ — ретрофіт на історичні money-рядки найгірший.
- **`Payment.amountUsd` + `amountNative` + captured rate**: 3 модулі (loyalty/finance/wallet) вже читають `amount_usd`, якого НЕМАЄ.
- **Idempotency реальна**: `UNIQUE(sourceType, sourceId)` на `payments` (race-guard зараз нефункціональний — колонок немає), теж на `referral_bonuses`, `wallet_transactions`.
- **Discount + line-items**: `ServiceCharge.{baseAmount, discountPct, discountAmount, totalAmount}` + first-class таблиця рядків (не `meta` JSON) — для per-line tax/discount/аудиту.
- **Refund / credit-note**: `PaymentStatus.refunded` є, але флоу/моделі немає; ефект на debt/loyalty.totalSpent/referral-clawback не визначено. Додати модель.
- **`Company.moneyBalance`** кеш + **`PaymentAllocation.chargeType`** дискримінатор (поліморфний FK без типу).
- **`CompanyService.frequency` + `nextChargeAt`** (квартал/рік) + **`ServiceCharge.status='written_off'`** (bad debt).

### T4. «Feature без колонки» (work-кластер)

- `OrderComment`: `editedAt`/`deletedAt`/`updatedAt` (15-хв edit + soft-delete unbuildable).
- `OrderFile`: `commentId`/`documentId`/`context`/`deletedAt`/`sha256`/`scanStatus` (comment-attachments, doc-PDF, cron C04 — посилаються на неіснуючі поля).
- `Order`: `on_hold.reason`, `cancelled.reason`.
- `OtpToken`: `attempts` + `ipAddress` (документований 3-strikes/rate-limit НЕ працює).
- `Department` table + `ExecutorRate.departmentId` (per-dep reports заблоковані).

### T5. Auth-примітиви (дешеві колонки, дорогі backfill'и)

- `Profile.tokenVersion` (reset/compromise інвалідовує живі access-токени, не лише refresh).
- `refresh_tokens.{ip, userAgent, lastUsedAt}` (sessions UI + reuse-audit).
- Refresh-reuse + login success/fail → пишуть `audit_logs`.

### T6. Моделі, яких доки очікують, а в схемі немає

`CronRun` (21-monitoring heartbeat), `OrderChatRead` (18-chat-hub), `LeaveRequest` (23), `CalendarEvent/Attendee` (24), `WalletTransaction/PaymentAllocation/ReferralSettings/Expense` (22/25) — при додаванні відразу з `agencyId`.

---

## 🟡 Doc↔reality drift (виправити в doc-sync, task #44)

Матеріально неправильні доки (квітневі, не звірені зі схемою):

- **08-email**: `EmailLog` модель + file-HTML-шаблони + 9 шаблонів — нічого з цього немає (4 TS-шаблони, логування через NotificationLog). Приклад `replaceAll` без escape = XSS-антипатерн.
- **11-content-blog**: весь `BlogPost` (Markdown content, SEO-поля, PostStatus enum, BlogTag tables) — фікція vs реальний (`titleUk/En`, `contentUk/En` JSON, `tags String[]`, `published bool`, `BlogPostType`). SEO-поля реально відсутні → landing `generateMetadata` читає `undefined`.
- **15-bot**: OtpToken — `token`/`attempts`/`metadata.ip` не існують (поле `code`, unique `(profileId,purpose)`); інтерактивні команди позначені як готові, але це Phase 3.
- **02/03/04/12**: квітневі тіла описують pre-S1 моделі (Comment/FileAttachment/9-status/`TimeLog.hours`), суперечать S1-футерам у тому ж файлі. **Найдешевша дія: видалити pre-S1 секції, звести з schema.**
- **06-documents**: status enum (`signed`/`cancelled` + `signedAt`), `amount`/`amountUah`/`meta` — у схемі немає; `DocumentCounter.count` vs `counter`; два конкуруючі алгоритми нумерації.
- **05/10 doc-vs-doc**: loyalty тіри $1k/$5k/$15k @ 0/3/7/12% (10-loyalty) vs $500/$2k/$5k @ 0/5/10/15% (05-billing) — **дві різні знижкові машини на тій самій колонці**. Обрати одну (constants у @workflo/types).
- **09-referral**: `ReferralBonus.referrerId`/`referredId` + relation — код агрегує по `referrerId`, якого в схемі немає; `referralCode @default(uuid())` ≠ формат `workflo-XXXXXX`; легасі `increment bonusBalance` лишилось поруч з wallet-шляхом (подвійний запис).
- **13-settings**: `telegramUsername` (немає), notifications PATCH не відповідає матриці 7×6, `/settings/activity-log` читає `entityType` з `ActivityLog` (а він order-only).
- **Permission shapes ×3**: 01 (snake_case), 13 (camelCase), tokens.ts (canonical 5). `can()` знає лише canonical → інші доки зведуть з пантелику. Звести на canonical.

---

## Per-module ADD-NOW (стисло)

- **01-auth**: `/auth/switch-agency`, claims `activeAgencyId`+`agencyMemberships`, email-verify flow (critical-event без флоу), last-owner protection (409 не 500), refresh-reuse audit.
- **13-settings**: канонічний members-endpoint (vs 01), audit на password/permission/system changes, system-settings → per-agency.
- **16-search**: `agencyId` у FTS DDL (composite GIN), membership-set scoping (не single company), `websearch_to_tsquery` (інакше 500 на `&`/`:`), `ukrainian` config migration.
- **17-credentials**: actions `credentials.reveal/revoke/delete` (зараз лише read/update), `agencyId`, tenant-guard, no-store headers на reveal, 2FA-delete contradiction.
- **20-admin**: singleton→`agencyId`-scoped (branding/templates/smtp/nomenclature/departments), per-agency admin (не глобальний ADMIN_EMAIL), SmtpSender envelope-fields.
- **02-orders**: один ALLOWED_TRANSITIONS на 9 станів, `OrderStage` доку, IDOR на `GET/PATCH /orders/:id`, `deadline` vs `dueDate`.
- **03-chat**: SSE re-auth на token-expiry, internal-comment leak guard на stream, participant IDOR.
- **04-files**: один storage layout (видалити stale), disk-cleanup на cascade, avatar storage (де?).
- **07-notifications**: retry/DLQ contract + `C-notify_retry` cron, in-app API (`GET /notifications`, mark-read, unread-count), per-agency templates resolution, idempotency key, vars-scrub (=SC-1).
- **19-reports**: `agencyId` фільтр (cross-tenant leak!), cache-key з agencyId, CSV formula-injection escape, write-off/refund як cache-bust.
- **21-monitoring**: `CronRun` модель, dashboard endpoints, retry endpoint, `/metrics` auth, stuck-in-`running` detection.
- **14-landing**: документувати contact-form (+ Turnstile/honeypot/`ipAddress`/`status`), API-down fallback на ISR.
- **18-chat-hub**: `OrderChatRead` модель, mention-access predicate (IDOR), tenant-guard.

---

## LATER (фічі — у BACKLOG)

order tags/SLA/dependencies/kanban-order; file versioning + virus-scan; calendar recurrence/ICS/conflict; leave accrual/half-days; chat reactions/threads/typing; report scheduling; coupon/promo; bounce/suppression list; cookie-consent; quiet-hours/digest; mobile push.

---

## Рекомендований план реагування

1. **SC-1** (secret-logging) — швидкий fix у shipped-коді.
2. **S1.6 Foundation** (розширити task #45): tenancy `agencyId` + T2 TimeLog + T3 фінанс-колонки + T4/T5/T6 — **одна pre-S2 schema-foundation міграція** (поки БД порожня).
3. **Doc-sync** (task #44): звести квітневі доки зі схемою, прибрати pre-S1 секції, єдині loyalty-constants + permission-shapes.
4. Далі — S2 на чистому фундаменті.
