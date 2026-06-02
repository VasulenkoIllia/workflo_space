# WORKFLO.SPACE — Єдина продуктова специфікація (SPEC)

> **Статус:** консолідовано 30 травня 2026 після фіналізації всіх 25 модулів (+26-27 інтеграції / ліди 1.06) (вікторина A-D) + очистки беклогу.
> **Призначення:** єдина точка входу й джерело істини. Концепція/візія — `CONCEPT_v2.md`; деталі модуля — `modules/NN-*.md`; рішення — `adr/*`; план — `TRACKER.md` (спрінти).
> **Як читати:** цей файл = ЩО будуємо (інвентар + наскрізна архітектура + schema-delta). `TRACKER.md` = У ЯКОМУ ПОРЯДКУ (спрінти).

---

## 1. Що це

**workflo.space** — «цифровий офіс» агенції автоматизації: один продукт, де клієнт замовляє/оплачує/спілкується (Portal), команда виконує (Workspace), а сайт/блог залучає (Landing). Telegram-бот і email — канали сповіщень.

**Принцип розробки (узгоджено):** будуємо **повноцінний продукт**, не MVP-заглушку. Складні етапи **архітектурно закладаємо зараз** (інтерфейси/колонки), а реалізуємо поетапно. Приклади: онлайн-оплата (інтерфейс `PaymentProvider` зараз, ручна оплата по рахунку — діюча; провайдери — S5+); recurring/підписки (модель зараз, автоматизація пізніше); multi-tenant (tenant-ready зараз, SaaS пізніше).

---

## 2. Актори й застосунки

| Застосунок    | Хто                        | Призначення                                           |
| ------------- | -------------------------- | ----------------------------------------------------- |
| **landing**   | відвідувач                 | сайт + блог/кейси + контакт-форма (Next.js ISR)       |
| **portal**    | клієнт (owner компанії)    | замовлення, чат, файли, рахунки, гаманець, лояльність |
| **workspace** | owner агенції + executor   | управління замовленнями, командою, фінансами, адмінка |
| **api**       | —                          | Fastify 5 backend (увесь домен)                       |
| **bot**       | клієнт/executor у Telegram | OTP-логін, сповіщення, інтерактивні команди           |

**Ролі (ADR-002 `can()` shim → task #24 повний RBAC):** `owner` агенції, `executor`, `client` (owner компанії-клієнта), `member` (член компанії з `permissions`). Admin = `can(user,'admin.access')` (не email-збіг).

---

## 3. Мультитенантність (ADR-004) — tenant-ready

- **Agency = корінь тенанта.** `agencyId` на всіх agency-scoped таблицях. `Profile` лишається глобальною ідентичністю; `AgencyMember` — членство в команді.
- **JWT-claims** отримують `activeAgencyId` + `agencyMemberships`; `/auth/switch-agency`.
- **`can()` tenant-guard** — default-deny на крос-тенантний доступ.
- **Зараз** працюємо як одна агенція (single tenant); **пізніше** — SaaS без переробки. Foundation (Agency + agencyId scoping) — **до S2**.

---

## 4. 27 модулів — фіналізований інвентар (+26-leads, +27-integrations 1.06)

> Кожен модуль пройшов: **A** (обов'язковий reconcile зі схемою) + **B/C/D** (обрані у вікторині фічі). Деталі — у `modules/NN-*.md` секція «Аудит-фіналізація».

### Ядро (MVP-критичні)

**01-auth** — реєстрація/логін/JWT(15m)+refresh(30d)/invite/password-reset/profile. Canonical snake*case permissions; tenancy claims; last-owner 409; tokenVersion; audit. *Фічі:* email-verify, **2FA TOTP** (totpSecretEnc/backupCodes/2-step), active sessions (refresh_tokens.{ip,userAgent,lastUsedAt}+reuse-detect), **Google OAuth** (OAuthAccount). *Статус:\_ ✅ S1 (core) / 2FA+OAuth+sessions — S-auth-2.

**02-orders** — CRUD замовлень, 9-станова машина (`ALLOWED_TRANSITIONS`), OrderStage, internal↔client status, triage (variant B), internal tasks, deadlines. agencyId; IDOR-guard; onHold/cancelled reason; TimeLog (unified). _Фічі:_ OrderTag/Assignment, **SlaPolicy**+breach-cron, OrderDependency (cycle-guard), OrderTemplate. _Статус:_ S2 core / фічі — S-orders-2.

**03-chat-comments** — коментарі до замовлень + SSE realtime (multi-instance pg*notify). internal-leak guard; participant IDOR; agencyId. *Фічі:* edit/delete (15-min window), CommentReaction, replyToId, read-receipts (order_chat_reads). *Статус:\_ S2 core / фічі — S-chat-2.

**04-files** — завантаження/видача файлів замовлення (OrderFile: commentId/documentId/context/sha256/deletedAt), tenant-prefixed layout, disk-cleanup, path-traversal guard. _Фічі:_ sharp-thumbnails (?variant), **S3StorageAdapter** (presigned). _BACKLOG:_ virus-scan, версіонування. _Статус:_ S2 core / S3+thumbs — S-files-2.

**13-settings** — профіль/пароль/матриця сповіщень/мова/тема. agencyId-aware; AuditLog; password→session-revoke. _Фічі:_ Profile.timezone+phone, **GDPR data-export**, appearance (density). _Статус:_ S1 (profile) / решта — S-settings.

### Фінанси

**05-billing** — рахунки (ServiceCharge), платежі (Payment), recurring (CompanyService `frequency`+`nextChargeAt`), НБУ-курс, advance. T3-reconcile: VAT, amountUsd, idempotency `UNIQUE(sourceType,sourceId)`, discount/line-items, written*off, refund/credit-note, agencyId, per-agency settings. *Фічі:_ **PaymentProvider** (Monobank/Stripe/WayForPay) + PaymentIntent + webhooks(outbox); **DunningPolicy**+cron; **PaymentSchedule** (розстрочка); multi-currency invoices. \_BACKLOG:_ coupons, LiqPay. _Статус:_ S5.

**25-wallet** — фінансовий центр клієнта: **2 рахунки** — bonus (WalletTransaction ledger) + money/AR (PaymentAllocation, prepaid, moneyBalance, стани overpaid/awaiting/partial). ReferralSettings (редаговані %). Statement (timeline обох). reconcile: agencyId, tenant-guard, інваріант балансу. _Статус:_ bonus+admin — S5; money-account+spending — S5 разом з invoice-flow.

**22-finance-expenses** — облік витрат + P&L (Дохід−Витрати). Фаза 1: реєстр (recurring/one*time, категорії, ЗП з ExecutorRate без дубля). Фаза 2: маржа по клієнтах (cost allocation). *Фічі:* **чеки-attachments**, **Budget**+overspend-alert, expense-approval-workflow, ПДВ/deductible. *Статус:\_ Фаза1 — S5; Фаза2 — post-MVP.

**09-referral** — реферальні бонуси (code `workflo-XXXXXX`), нарахування через wallet (єдиний шлях запису), idempotency. _Фічі:_ дашборд/гейміфікація (ReferralAchievement/leaderboard). _BACKLOG:_ multi-level, cash-out. _Статус:_ S5.

**10-loyalty** — %-знижка за тіром (NEW/REGULAR/PARTNER/VIP @ 0/3/7/12% від $0/1k/5k/15k — **канон у `@workflo/types`**, supersedes 05). RECONCILE-only: ServiceCharge discount-cols, Company.tierOverride, LoyaltyTierHistory, єдиний totalSpent-writer. _Статус:_ S5.

### Документи й комунікації

**06-documents** — інвойси/акти/специфікації, per-agency нумерація (race-safe counter), tax/line-items, immutability+supersede, credit-note, PDF access-check, PaymentAllocation.chargeType. _Фічі:_ **e-signature** (click→Diia/КЕП фазовано, SignatureProvider), DocumentTemplate, bulk(outbox), draft→preview→approve→send. _Статус:_ S6.

**07-notifications** — матриця (7 категорій × 6 каналів × 27 подій), NotificationPreference, CRITICAL*EVENTS email-lock (ADR-003), notify()+notifyRecipient(). reconcile: **outbox** retry/DLQ, per-agency templates, idempotency-key, agencyId на logs. *Фічі:_ **in-app center** API, **Web Push** (PushSubscription+VAPID), **SMS** (SmsAdapter TurboSMS/Twilio). \_S12:_ quiet-hours/digest + bulk-розсилки (промоут із беклогу). _Статус:_ matrix — ✅ S1; in-app/push/sms — S6+.

**08-email** — REWRITE (стара EmailLog/file-templates — фікція). Транзакційний email через notify-матрицю. _Фічі:_ inbound email→task, bounce/suppression+unsubscribe, per-agency sending-domain (DKIM). _Статус:_ baseline S1 / inbound+bounce — post-MVP.

**15-bot** — Telegram OTP-логін (OtpToken code/attempts/ipAddress), сповіщення. reconcile: telegram split-brain (**NotificationSettings authoritative**), webhook update-id dedup. _Фічі:_ інтерактивні команди (/orders /timer /balance), inline-buttons, executor-notifications. _Статус:_ S6.

### Контент і залучення

**14-landing** — сайт (Hero/кейси/команда/FAQ/CTA), контакт-форма (Turnstile/honeypot/ipAddress/status), ISR, locale-switcher. _Фічі:_ cookie-consent, **CMS** (LandingContent), live-chat widget. _Статус:_ S7.

**11-content-blog** — REWRITE (реальна BlogPost: titleUk/En, contentUk/En JSON, tags[], published). _Фічі:_ **AI-генерація** (quota/sanitize/AgencyAiUsage), реальні SEO-поля (metaTitle/Description/ogImage/canonical). _BACKLOG:_ scheduled publishing. _Статус:_ S7.

### Команда й операції

**12-team-executors** — команда (AgencyMember), ставки (ExecutorRate +hourlyRateUsd+departmentId+currency+effectiveFrom/Until+hireDate ✅), Department, lock-timesheets-after-invoice, TimeLog (unified). _Фічі:_ **ExecutorPayout** (auto-calc), timesheet-approval, KPI-dashboard. _BACKLOG:_ skills. _Статус:_ S5.

**19-reports** — 3 канонічні (time/revenue/debtors). reconcile: **agencyId-фільтр (leak-fix!)**, cache-key+agencyId, CSV-injection escape, revenue*monthly_mv. *Фічі:* **scheduled email** (ReportSchedule+cron+outbox), **PDF/XLSX** export, custom **ReportDefinition** builder. *Статус:\_ S-reports (post core).

**16-search** — пошук. reconcile: agencyId у FTS (leak!), websearch*to_tsquery, membership-scope, ukrainian-config. *Фічі:* фазовано Postgres FTS→Meilisearch (**SearchAdapter**), **Cmd+K** command-palette. *Статус:\_ S-search.

**17-credentials** — сейф ключів клієнта (envelope AES-256-GCM, KEK). reconcile: reveal/revoke/delete actions, agencyId+tenant-guard, no-store. _Фічі:_ **2FA-на-reveal**, scoped executor-sharing (CredentialShare, time-limited), rotation-reminders. _Статус:_ S-credentials.

**18-chat-hub** — глобальний inbox (зведені чати). reconcile: OrderChatRead, mention-access (IDOR), tenant-guard, cursor. _Фічі:_ mute/archive (ConversationState), message-search, inbox-filters. _Статус:_ S-chat-hub (після 03+16).

**20-admin-settings** — адмінка (templates/SMTP/branding/nomenclature/departments/cron). reconcile: **can()-admin не email**, per-agency scoping всіх. _Фічі:_ **AgencyFeatureFlag**, **outbound webhooks** (WebhookEndpoint+outbox), **ApiKey**, config export/import. _Статус:_ S-admin.

**21-system-monitoring** — Sentry/dashboard/audit/cron-heartbeat. reconcile: audit/cron agencyId, scoped dashboard. _Фічі:_ **per-agency UsageCounter** (SaaS-ready), public status-page (StatusIncident), SLO/error-budget, InfraCost→P&L. _Статус:_ S-ops (S7-S8+).

### Внутрішні (HR/планування)

**23-leave-tracking** — відпустки/лікарняні (LeaveRequest), executor подає→owner approve, self-vs-others `can()`. _Фіча:_ **LeaveBalance** (accrual від hireDate). _BACKLOG:_ держсвята UA. _Статус:_ S-team-internal.

**24-calendar** — зустрічі команда↔клієнт (CalendarEvent+CalendarAttendee polymorphic), per-event timezone, aggregated view (events+deadlines+leave), reminder-cron. reconcile: agencyId, D2-guests. _Фічі:_ **booking-links** (Calendly-style), auto-video (MeetingProvider). _BACKLOG:_ держсвята, recurrence/ICS/external-guests (Phase 2). _Статус:_ S-calendar.

### Growth / інтеграції (додано 1.06.2026)

**26-leads** — CRM-inbound: воронка лідів (`Lead`+`LeadPipeline`/`LeadStage`/`LeadActivity`), **конфігурований канбан**, мульти-джерельна **атрибуція** (`source`: website*form/telegram/instagram/tiktok/facebook/whatsapp/email/phone/manual/referral), конверсія лід→Company. SSE-дошка, notify. *Статус:\_ P1 — manual+website+telegram; P2 — соц-канали.

**27-integrations** — інтеграційний хаб (adapter-патерн). **Inbound:** Lead Intake API `POST /v1/leads` (ApiKey, форма клієнта) + соц-адаптери. **Outbound:** `WebhookEndpoint`/`WebhookDelivery` (зміни станів→зовні, HMAC, **через outbox**). **ApiKey** (per-agency Bearer). _Статус:_ **P1** — website-form-API + Telegram + outbound-webhooks; P2 — Meta/WhatsApp/TikTok/widget; P3 — marketplace/public-API. (Поглинає `WebhookEndpoint`/`ApiKey` з 20-admin.)

---

## 5. Наскрізна архітектура

- **Auth/Session:** JWT access(15m) + opaque refresh(30d, refresh_tokens); SameSite=Lax+Path=/auth/refresh (ADR-001); reuse-detection; tokenVersion revoke.
- **RBAC:** `can()` shim читає `CompanyMember.permissions` + tenant-guard (ADR-002/004). Повний RBAC — task #24.
- **Сповіщення:** єдиний `notify()` → resolver(матриця+preferences+ADR-003 lock) → dispatch → adapters(email/telegram/in-app/push/sms). `notifyRecipient()` для profile-less.
- **Outbox + domain events** (topic #2-3, _до S6_): надійний retry/DLQ для notifications + webhooks + index-sync + bulk. `OutboxEvent` таблиця + worker.
- **Фінансова модель:** `Payment`(надходження, status enum ✅) → `PaymentAllocation`(куди зараховано) → `ServiceCharge`/`Document`(борг); `WalletTransaction`(бонус-ledger); `Expense`(P&L). Усе в USD через `exchange_rates` (історична точність). idempotency `UNIQUE(sourceType,sourceId)`.
- **Storage:** `LocalStorageAdapter` (MVP) → `S3StorageAdapter` (R2, flip-trigger у BACKLOG). tenant-prefixed keys.
- **Search:** Postgres FTS (agency-scoped GIN) → Meilisearch (`SearchAdapter`, sync via outbox).
- **Provider-інтерфейси (закладені зараз, фазована імплементація):** `PaymentProvider`, `SignatureProvider`, `MeetingProvider`, `SmsAdapter`, `PushAdapter`, `SearchAdapter`, `StorageAdapter`.
- **Crons** (`CRON_JOBS.md`): НБУ-курс, recurring-charges, loyalty-recalc, dunning, SLA-breach, leave-accrual, calendar-reminder, heartbeat-check, retention. Heartbeat (CronRun) + PagerDuty.
- **Спостережуваність:** Sentry (PII-scrub), structured Pino, audit_logs (365d), UsageCounter.

---

## 6. ADR-індекс

| ADR | Рішення                                                                  |
| --- | ------------------------------------------------------------------------ |
| 001 | Refresh-cookie: SameSite=Lax + Path=/auth/refresh                        |
| 002 | RBAC `can()` shim читає CompanyMember.permissions (не повний CASL зараз) |
| 003 | Notification channels MVP: CRITICAL_EVENTS email-lock                    |
| 004 | Multi-tenancy: Agency=tenant-root, agencyId scoping, tenant-ready→SaaS   |

---

## 7. Schema-delta (нове зі фіналізації — для міграцій)

> Зведено з 25 «Аудит-фіналізація» секцій. Деталі — у відповідному модулі.

**Foundation:** `Agency`, `AgencyMember`; `agencyId` на всіх agency-scoped таблицях; `OutboxEvent`.
**Auth:** `OAuthAccount`; auth-поля (totpSecretEnc, backupCodesHash, emailVerifiedAt); refresh*tokens.{ip,userAgent,lastUsedAt}.
**Orders:** `OrderTag`, `OrderTagAssignment`, `SlaPolicy`, `OrderDependency`, `OrderTemplate`; OrderStage; onHold/cancelledReason.
**Chat:** `CommentReaction`, `order_chat_reads`(OrderChatRead), `ConversationState`; comment.{editedAt,deletedAt,replyToId}.
**Billing/Wallet/Finance:** `PaymentIntent`, `DunningPolicy`, `PaymentSchedule`; `WalletTransaction`, `PaymentAllocation`, `ReferralSettings`, Company.moneyBalance; `Expense`, `ExpenseReceipt`, `Budget`, `ExpenseAllocation`; ServiceCharge discount/VAT/line-item cols; Payment.{status✅,amountUsd}.
**Loyalty/Referral:** `LoyaltyTierHistory`, Company.tierOverride; `ReferralAchievement`.
**Documents/Notifications:** `DocumentTemplate`, signature-поля; `PushSubscription`; notification outbox/idempotency.
**Content/Landing:** реальна BlogPost (titleUk/En…), SEO-поля, `AgencyAiUsage`; `LandingContent`, contact-form cols.
**Team:** `Department`, `ExecutorPayout`; ExecutorRate-поля ✅.
**Settings:** Profile.{timezone,phone}.
**Reports/Search:** `ReportSchedule`, `ReportDefinition`, `revenue_monthly_mv`; tsvector/GIN cols, `SearchAdapter`.
**Credentials:** `CredentialShare`; CredentialVault.{agencyId,expiresAt,rotationReminderDays}.
**Admin/Ops:** `AgencyFeatureFlag`, `UsageCounter`, `StatusIncident`, `SloTarget`, `InfraCost`; CronRun ✅.
**Growth/Integrations (26-27):** `Lead`, `LeadPipeline`, `LeadStage`, `LeadActivity`; `ApiKey`, `WebhookEndpoint`, `WebhookDelivery`, `IntegrationConnection`. *Статус:\_ P1 спец.
**HR/Calendar:** `LeaveRequest`, `LeaveBalance`; `CalendarEvent`, `CalendarAttendee`, `BookingLink`.

**db-hardening (BACKLOG):** telegramChatId dedup, відсутні FK-індекси, drop OtpToken[code,purpose], Order.company onDelete, Decimal(10,4) для курсів, UUIDv7 для high-volume.

---

## 8. Поетапність продукту

| Зараз (закладаємо архітектуру)       | Пізніше (фазована реалізація)            |
| ------------------------------------ | ---------------------------------------- |
| Оплата по рахунку (ManualProvider)   | Онлайн-оплата (Monobank/Stripe webhooks) |
| Single tenant (одна агенція)         | SaaS multi-tenant (agencyId вже скрізь)  |
| Recurring як модель (CompanyService) | Авто-списання/підписки                   |
| Postgres FTS                         | Meilisearch                              |
| Local storage                        | Cloudflare R2                            |
| e-sign: click-to-accept              | Diia/КЕП                                 |
| Manual P&L                           | Маржа по клієнтах (cost allocation)      |

---

> **Подальше:** `TRACKER.md` містить перерозбиті спрінти, що реалізують цей SPEC у порядку залежностей. Foundation (tenancy+schema) → ядро (orders/chat/files+frontend) → фінанси → документи/боти → контент → enhancement-фічі → ops/QA.
