# EMAIL MODULE (канал notify-матриці)

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: API (api.workflo.space) / Mailcow · Залежить від: **07-notifications** (notify-матриця), `packages/notifications`, `packages/i18n`.
> Статус: **REWRITE-done** (doc-sync 1.06) · Оновлено: 1 червня 2026
> ⚠️ Стара версія цього доку (EmailLog-модель, file-HTML-шаблони, 9 листів, `replaceAll`-без-escape) — **фікція**, видалена. Канон нижче.

---

## 0. Суть: email — це **канал**, а не окремий модуль

Email не має власного «модуля відправки». Це **один із каналів матриці сповіщень** (модуль **07-notifications**). Жоден доменний модуль не викликає Nodemailer напряму — усе йде через `notify()`:

```
notify(event, recipients, payload)
  → resolver (матриця 07 × NotificationPreference × ADR-003 CRITICAL_EVENTS email-lock)
    → dispatch.renderEmailForEvent()  (лише для подій, що мають email-шаблон)
      → EmailAdapter.sendEmail()
        → getMailer() → Nodemailer → Mailcow SMTP → клієнт
```

> Наслідок: «хто шле email» вирішує **матриця + преференції користувача**, а не доменний код. Більшість подій (order/payment/document/referral) ідуть **telegram/in-app**; email мають лише події, для яких є шаблон (нижче).

---

## 1. Шаблони — TypeScript-функції (не HTML-файли)

Шаблони живуть у `packages/notifications/src/email/templates/*.ts` як **render-функції**, зібрані з примітивів `render.ts` (`renderLayout` / `renderButton` / `renderHeading` / `renderParagraph` / `renderMuted`). Реально існують **4**:

| Функція                          | Подія                           | Змінні (приклад)                          |
| -------------------------------- | ------------------------------- | ----------------------------------------- |
| `renderWelcomeEmail`             | `auth.welcome`                  | `name`, `portalUrl`                       |
| `renderPasswordResetEmail`       | `auth.password_reset`           | `name`, `resetUrl`, `expiresIn`           |
| `renderInviteExecutorEmail`      | `system.invite_sent` (executor) | `inviterName`, `acceptUrl`                |
| `renderInviteCompanyMemberEmail` | `system.invite_sent` (member)   | `inviterName`, `companyName`, `acceptUrl` |

- **XSS:** усі змінні екрануються `escapeText` / `escapeAttr` (`render.ts`) — **обов'язково**. Жодного `replaceAll`-без-escape.
- **Layout:** `renderLayout()` (програмний, inline-CSS для сумісності) — preheader, бренд із i18n `common.brand`, кольори `PRIMARY_COLOR/TEXT_COLOR/MUTED_COLOR`.
- Подія без email-шаблону → email просто **не надсилається** (канал пропускається; залишаються telegram/in-app).

> Нові email-шаблони додаються як render-функції + рядок у матриці 07, не як HTML-файли.

### 1.1. Заплановані шаблони (за дизайном r2 — `DESIGN_SYSTEM.md §5.6`)

Дизайн повернув **15 HTML-мокапів** ([`design-v2/project/email-templates.jsx`](../../design-v2/project/email-templates.jsx)). 4 з них реалізовані вище; **11 — заплановані** для S3+ (frontend integration phase). Кожен має готовий мокап у фірмовому стилі (лайм/stone/Geist) — імплементація = пере-вираження мокапу через `render*`-примітиви + reuse `renderLayout()`.

**Transactional (5):**

| Функція (план)                | Подія (07)                               | Реалізовано? | Дизайн                    |
| ----------------------------- | ---------------------------------------- | ------------ | ------------------------- |
| `renderInvitePortalEmail`     | `system.invite_sent` (member)            | ✅ (= вище)  | `email-invite`            |
| `renderOrderReceivedEmail`    | `orders.created` (підтвердження клієнту) | ❌           | `email-order`             |
| `renderInvoiceSentEmail`      | `billing.invoice_sent`                   | ❌           | `email-invoice` (pay CTA) |
| `renderPaymentOkEmail`        | `billing.invoice_paid`                   | ❌           | `email-payment` (receipt) |
| `renderDeadlineReminderEmail` | `billing.invoice_overdue` (warning)      | ❌           | `email-deadline`          |

**Auth + безпека (6):**

| Функція (план)               | Подія (07)                               | Реалізовано? | Дизайн                    |
| ---------------------------- | ---------------------------------------- | ------------ | ------------------------- |
| `renderEmailVerifyEmail`     | `auth.email_verification`                | ❌           | `email-verify` (код)      |
| `renderPasswordResetEmail`   | `auth.password_reset`                    | ✅ (= вище)  | `email-reset`             |
| `renderPasswordChangedEmail` | `auth.password_changed` (security alert) | ❌           | `email-pwd-changed`       |
| `renderNewLoginEmail`        | `auth.login_from_new_device`             | ❌           | `email-new-login` (alert) |
| `renderOtpEmail`             | `auth.otp_code` (2FA login)              | ❌           | `email-otp`               |
| `renderEmailChangeEmail`     | `auth.email_change_confirm`              | ❌           | `email-change`            |

**Системні + інфо (4):**

| Функція (план)              | Подія (07)                         | Реалізовано? | Дизайн                      |
| --------------------------- | ---------------------------------- | ------------ | --------------------------- |
| `renderInviteExecutorEmail` | `system.invite_sent` (executor)    | ✅ (= вище)  | `email-team-invite`         |
| `renderMentionEmail`        | `chat.mention`                     | ❌           | `email-mention`             |
| `renderDocReadyEmail`       | `documents.completion_act_ready`   | ❌           | `email-doc-ready`           |
| `renderDigestEmail`         | `weekly_digest` (новий event у 07) | ❌           | `email-digest` (stat-сітка) |

**Інтеграційні (r4, додано в дизайні):**

| Функція (план)                      | Подія (07)              | Реалізовано? | Дизайн                                                     |
| ----------------------------------- | ----------------------- | ------------ | ---------------------------------------------------------- |
| `renderRefundIssuedEmail` (від G13) | `billing.refund_issued` | ❌           | у `round4-billing.jsx`                                     |
| `renderWelcomeEmail`                | `auth.welcome`          | ✅ (= вище)  | _окремого мокапу нема — використовується дефолтний layout_ |

> **Total:** 15 у дизайні · 4 ✅ у коді · **11 todo** + inline-CSS існуючих 4 треба пере-перевірити проти токенів §3 (DESIGN_SYSTEM) — фактично виконано через `render.ts` primitives.
>
> **Імплементація:** для кожного нового шаблону — нова TS-функція + рядок у матриці модуля 07 (`docs/modules/07-notifications.md §матриця`). HTML-структура + inline-CSS береться з відповідного компонента у [`email-templates.jsx`](../../design-v2/project/email-templates.jsx) і перевиражається через `renderLayout`/`renderButton`/`renderHeading`/`renderParagraph`/`renderMuted` для XSS-безпеки.

---

## 2. Транспорт

```typescript
// packages/notifications/src/email/mailer.ts
getMailer(override?)  // Nodemailer singleton; override → per-agency SMTP (white-label)
  → host/port/secure/auth з config.ts (Zod-валідований: SMTP_HOST/PORT/USER/PASS/FROM/FROM_NAME)
verifyMailer()        // verify() на старті
```

- **Прод:** Mailcow SMTP (`mail.workflo.space:587`, STARTTLS). From за замовч. `noreply@workflo.space`, Reply-To `hello@workflo.space`; SPF/DKIM/DMARC у Mailcow.
- **Dev:** Mailpit (`SMTP_HOST=mailpit:1025`) → UI `http://localhost:8025`, реальним адресатам не йде.
- **Multi-tenant:** `getMailer(override)` дозволяє per-agency SMTP (див. §D — per-agency домен).

---

## 3. Логування

Факт відправки — у **`NotificationLog`** (НЕ окрема `EmailLog`): `event`, `channel`, `status(sent|failed|skipped|rolled_up)`, `errorCode`, `rollupTargetId`, `metadata`. **Персистити `messageId`** від SMTP для трасування. Тіло листа не зберігаємо (GDPR/розмір).

---

## 4. Мультимовність

Мова листа — `recipient.locale ?? 'uk'` (dispatch, i18n `LocaleKey`); fallback `uk`. Переклади — `packages/i18n` (+ PDF-i18n окремо в `packages/templates`).

---

## 5. Зв'язки з іншими модулями

| Модуль                            | Зв'язок                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **07-notifications**              | **Власник** каналу: матриця, resolver, ADR-003 email-lock, dispatch, `EmailAdapter`              |
| **01-auth**                       | Емітить події `auth.welcome` / `auth.password_reset` / `system.invite_sent` (мають email-шаблон) |
| Orders/Billing/Documents/Referral | Емітять `notify()`-події; **резолвер** вирішує email vs telegram/in-app — не шлють email напряму |

---

## Аудит-фіналізація (30 травня 2026) — REWRITE + нові фічі

> ⚠️ Стара частина доку **матеріально неправильна** (EmailLog-модель, file-HTML-шаблони, 9 шаблонів) → ВИДАЛИТИ в doc-sync. Реальність: 4 TS-шаблони (`renderWelcome/PasswordReset/Invite*`), логування через `NotificationLog`, escape через `escapeText/Attr`.

### A. Обов'язкові reconcile

Прибрати `EmailLog` + file-templates + `replaceAll`-без-escape приклад. Per-agency sender (multi-SMTP), `messageId` персистити в NotificationLog для трасування.

### B. Inbound email → задача/коментар ✅ (= арх. тема #14)

- Mailcow inbound → `POST /webhooks/email/inbound` (parse MIME). Routing: `Reply-To`/`+token@` адреса несе `{orderId, profileId}` → створює `OrderComment`; `support@agency` → новий order/тикет (триаж).
- Дедуп по Message-ID; вкладення → OrderFile; spam-фільтр (SPF/SpamAssassin score). `agencyId` з домену отримувача.

### C. Bounce / suppression ✅

- Mailcow bounce-webhook → `SuppressedEmail { agencyId, email, reason(hard_bounce|complaint|unsubscribe), createdAt }`. `sendEmail` пропускає suppressed.
- Unsubscribe-токен + `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click, вимога Gmail/Yahoo). `GET /unsubscribe/:token`.

### D. Per-agency домен відправки ✅ (white-label)

- `AgencyEmailDomain { agencyId, domain, dkimSelector, verifiedAt }`. DNS-верифікація (SPF/DKIM/DMARC records видаються агенції). `from`/`reply-to`/DKIM per-agency. Дефолт — платформний домен поки агенція не верифікувала свій.

```
New: SuppressedEmail, AgencyEmailDomain; NotificationLog + messageId
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                                                                                                                                                                                                                                                                                                                                                                       | Вплив                   | Нюанси власника                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------ |
| 08-А | **Керований SMTP для транзакційних листів** (Postmark/Resend/SES — обрати) поверх/замість Mailcow для критичних подій                                                                                                                                                                                                                                                                                                         | [бек]                   | Mailcow лишається для скриньок |
| 08-В | **Bounce/suppression — підняти пріоритет** (з S12 ближче); звʼязати з трекінгом документів 06-Г                                                                                                                                                                                                                                                                                                                               | [бек]                   |                                |
| 08-Г | **SaaS-пошта тенанта — дворівнева модель** (рішення зафіксовано, питання власника закрито): (1) дефолт — з домену платформи; (2) «свій домен» — тенант додає лише DNS DKIM/SPF (генеруємо через API провайдера), шле наша інфра від його імені; (3) BYO SMTP — тенант підключає власний хост/логін/пароль. + **Матриця «які категорії листів з якого відправника»** (вимога власника). Поштовий сервіс тенанту НЕ розгортаємо | [бек+екран налаштувань] | Розширює наявний smtp_senders  |

**Відхилено:** Б (email-міст у чат: reply на сповіщення → коментар) — остаточно (відкладався з 03).

**Для ТЗ дизайнеру:** налаштування пошти тенанта: 3 рівні підключення + статус DNS-верифікації + матриця категорія→відправник (Г).
