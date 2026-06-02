# EMAIL MODULE (канал notify-матриці)

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
