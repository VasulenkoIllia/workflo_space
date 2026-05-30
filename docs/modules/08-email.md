# EMAIL TEMPLATES MODULE

> App: API (api.workflo.space) / Mailcow
> Статус: MVP
> Залежить від: `packages/notifications`, `packages/i18n`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль відповідає за відправку транзакційних email-повідомлень через Nodemailer → Mailcow (self-hosted поштовий сервер на Hetzner). Шаблони email написані на HTML з inline CSS (максимальна сумісність з email клієнтами). Підтримка двох мов: UA + EN.

---

## Інфраструктура

```
API (Nodemailer)
  → Mailcow SMTP (mail.workflo.space:587, STARTTLS)
    → Доставка клієнту
```

### Nodemailer конфігурація

```typescript
// packages/notifications/src/email/mailer.ts
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // mail.workflo.space
  port: Number(process.env.SMTP_PORT), // 587
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER, // noreply@workflo.space
    pass: process.env.SMTP_PASS,
  },
})

// Перевірка при старті
await transporter.verify()
```

### Mailpit (локальна розробка)

В dev середовищі SMTP_HOST=mailpit:1025 → всі листи потрапляють на http://localhost:8025 (Mailpit UI) — не відправляються реальним адресатам.

---

## Шаблони листів

Всі шаблони в `packages/notifications/src/email/templates/`:

```
templates/
├── base.html              // Base layout (header, footer, logo, unsubscribe)
├── welcome/
│   ├── uk.html
│   └── en.html
├── password-reset/
│   ├── uk.html
│   └── en.html
├── invite/
│   ├── uk.html
│   └── en.html
├── order-status/
│   ├── uk.html
│   └── en.html
├── invoice/
│   ├── uk.html
│   └── en.html
├── document-sent/
│   ├── uk.html
│   └── en.html
├── payment-received/
│   ├── uk.html
│   └── en.html
├── subscription-expiring/
│   ├── uk.html
│   └── en.html
└── referral-bonus/
    ├── uk.html
    └── en.html
```

### Template рендеринг

```typescript
// packages/notifications/src/email/renderTemplate.ts
export function renderEmailTemplate(
  templateName: string,
  language: 'uk' | 'en',
  variables: Record<string, string | number>
): string {
  const templatePath = join(__dirname, 'templates', templateName, `${language}.html`)
  let html = readFileSync(templatePath, 'utf8')

  // Простий string replace для MVP: {{variable}}
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, String(value))
  }

  return html
}
```

> В Phase 2 — перехід на Handlebars або Mjml для більш складних шаблонів.

---

## Список листів та їх змінні

### `welcome`

```
{{name}}           — ім'я клієнта
{{loginUrl}}       — посилання на вхід
{{supportEmail}}   — hello@workflo.space
```

### `password-reset`

```
{{name}}
{{resetUrl}}       — https://portal.workflo.space/reset-password?token=...
{{expiresIn}}      — "1 година"
```

### `invite` (для executors і company members)

```
{{name}}
{{inviterName}}    — хто запросив
{{role}}           — "виконавець" або "член команди"
{{inviteUrl}}      — посилання для прийняття
{{expiresAt}}      — дата закінчення запрошення
```

### `order-status`

```
{{orderTitle}}
{{orderNumber}}    — #UUID-short або порядковий номер
{{oldStatus}}
{{newStatus}}
{{orderUrl}}       — посилання на замовлення в portal
{{comment}}        — опціонально, коментар до зміни
```

### `invoice`

```
{{orderTitle}}
{{invoiceNumber}}  — INV-2026-0042
{{totalAmount}}    — $500.00
{{totalAmountUah}} — ₴20,750
{{dueDate}}
{{downloadUrl}}    — посилання на PDF
```

### `document-sent`

```
{{documentType}}   — "Акт виконаних робіт"
{{documentNumber}}
{{orderTitle}}
{{downloadUrl}}
{{signUrl}}        — посилання для підписання (portal)
```

### `payment-received`

```
{{amount}}
{{amountUah}}
{{orderTitle}}
{{paymentDate}}
{{balanceDue}}
```

### `subscription-expiring`

```
{{planName}}
{{expiresAt}}
{{daysLeft}}       — "3 дні"
{{renewUrl}}
```

### `referral-bonus`

```
{{referredCompanyName}}
{{bonusAmount}}
{{bonusType}}      — "знижка 10%" або "бонус $50"
```

---

## Base Layout

```html
<!-- packages/notifications/src/email/templates/base.html -->
<!DOCTYPE html>
<html lang="{{lang}}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{subject}}</title>
    <style>
      /* Inline styles для максимальної сумісності */
      body {
        font-family: -apple-system, Arial, sans-serif;
        background: #f5f5f5;
        margin: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: #fff;
        border-radius: 8px;
      }
      .header {
        background: #1a1a2e;
        padding: 24px;
        text-align: center;
      }
      .logo {
        color: #fff;
        font-size: 24px;
        font-weight: 700;
      }
      .content {
        padding: 32px 24px;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        background: #4f46e5;
        color: #fff;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
      }
      .footer {
        padding: 16px 24px;
        text-align: center;
        color: #999;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">Workflo.Space</div>
      </div>
      <div class="content">{{content}}</div>
      <div class="footer">
        <p>© 2026 Workflo.Space | <a href="{{unsubscribeUrl}}">Відписатися</a></p>
        <p>hello@workflo.space</p>
      </div>
    </div>
  </body>
</html>
```

---

## Логування відправок

```prisma
model EmailLog {
  id         String   @id @default(uuid())
  to         String
  subject    String
  template   String
  status     String   // 'sent' | 'failed'
  error      String?
  profileId  String?
  createdAt  DateTime @default(now())

  @@index([profileId])
  @@index([createdAt])
}
```

Зберігаємо факт відправки для дебагу. Тіло листа **не зберігаємо** (GDPR, розмір).

---

## Дозволи та захист

- **Rate limit:** максимум 5 email / 10 хвилин на один email-адрес (захист від spam abuse)
- **From address:** завжди `noreply@workflo.space`
- **Reply-To:** `hello@workflo.space`
- **SPF/DKIM/DMARC:** налаштовані в Mailcow для `workflo.space`

---

## Мультимовність

Мова листа визначається з `profile.preferredLanguage` (встановлюється при реєстрації, можна змінити в налаштуваннях). Fallback — `uk`.

---

## Зв'язки з іншими модулями

| Модуль            | Що надсилає                                      |
| ----------------- | ------------------------------------------------ |
| **Auth**          | welcome, password-reset, invite                  |
| **Orders**        | order-status                                     |
| **Billing**       | invoice, payment-received, subscription-expiring |
| **Documents**     | document-sent                                    |
| **Referral**      | referral-bonus                                   |
| **Notifications** | `EmailAdapter` — конкретна реалізація відправки  |

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
