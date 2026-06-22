# ADMIN SETTINGS MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> App: Workspace (admin/superadmin only)
> Статус: S5+ (post-MVP)
> Залежить від: `packages/db`, `packages/notifications`, `packages/templates`
> Оновлено: 27 травня 2026

> ⚠️ **Легенда «✅» у цьому доку = SPECCED (дизайн), НЕ shipped.** Канон побудованого —
> `schema.prisma` + `TRACKER.md` (✅/🧪/🚀). Станом на аудит 2026-06 у схемі **НЕ існують**:
> `WebhookEndpoint`, `WebhookDelivery`, `ApiKey`, config export/import (`AgencyFeatureFlag`
>
> - `UsageCounter` — вже побудовані, Block 1). `PdfBranding` тут показано як `id="singleton"`
>   — **застаріло**: settings-таблиці мусять нести `agencyId` + scoped `@@unique` з дня 1 (F6).
>   Не копіювати singleton-схему.

---

## Огляд

Admin-секція workspace, де superuser (`role=executor + email = ADMIN_EMAIL`) налаштовує:

1. **Templates editor** — заголовки/тексти notification email + telegram messages.
2. **Multi-sender SMTP** — до 3 окремих відправників (e.g. `noreply@`, `billing@`, `support@`).
3. **PDF branding** — лого, кольори, фірмові шрифти для invoices / acts.
4. **Nomenclature** — system-level коди послуг (`SVC-001` etc) + per-order overrides.
5. **Departments CRUD** — додавання/редагування відділів.
6. **Cron monitoring** — статус, last run, manual trigger.

---

## 1. Templates editor

### Сценарій

Owner хоче змінити текст welcome-email на ласкавіший. Без deploy.

### Storage

Таблиця `notification_templates`:

```prisma
model NotificationTemplate {
  id        String   @id @default(uuid())
  event     String   // NotificationEvent literal
  channel   String   // NotificationChannel literal
  locale    String   // 'uk' | 'en'
  subject   String?  // тільки для email
  body      String   // template body з {variables} плейсхолдерами
  isDefault Boolean  @default(false)  // baseline, не editable
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  updatedBy String?

  @@unique([event, channel, locale])
  @@map("notification_templates")
}
```

### Resolution priority

`renderEmailForEvent(event)` спершу шукає user-override у `notification_templates`. Якщо нема — fallback на hardcoded template з `packages/notifications/src/email/templates/`.

### UI

`/workspace/admin/templates`:

- List of 27 events × 3 channels × 2 locales = 162 slots (більшість default).
- Per slot: "Edit" → modal з:
  - Subject input (email only).
  - Body textarea з syntax highlight плейсхолдерів `{name}`, `{portalUrl}`.
  - Variables hint sidebar (показує що доступне per event).
  - Preview pane (render з sample data).
  - "Save & test" — надсилає на admin's email/telegram з sample data.
  - "Reset to default" — видалити override.

### Validation

- Server validates всі required placeholders присутні (e.g. `welcome` має містити `{name}` AND `{portalUrl}`).
- Reject submission якщо HTML невалідний (DOM parse).

---

## 2. Multi-sender SMTP

### Сценарій

Owner хоче розділити транзакційні vs invoice vs support emails (різні reply-to).

### Storage

`smtp_senders`:

```prisma
model SmtpSender {
  id        String   @id @default(uuid())
  slug      String   @unique  // 'noreply', 'billing', 'support'
  name      String   // 'Workflo Billing'
  email     String   // 'billing@workflo.space'
  host      String
  port      Int
  secure    Boolean  @default(false)
  username  String?
  passwordEncrypted Bytes?  // envelope encryption як credentials vault
  passwordIv Bytes?
  passwordAuthTag Bytes?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  @@map("smtp_senders")
}
```

### Routing

Кожен event має `senderSlug` mapping (configurable у admin):

- `billing.*` → `billing@`
- `auth.*` → `noreply@`
- `system.*` → `support@`

`sendEmail()` приймає optional `from` override → admin layer передає на основі mapping.

### UI

`/workspace/admin/smtp`:

- Cards для кожного sender з status (connected ✓ / failed ✗ / last_check_at).
- "Test connection" button → `verifyMailer(senderId)`.
- "Edit" — все крім password у формі; password окремо з "Update password" дією (з 2FA).
- "Mapping" tab — drag-drop categories у sender buckets.

---

## 3. PDF branding

Settings table `pdf_branding`:

```prisma
model PdfBranding {
  id           String   @id @default("singleton")
  logoUrl      String?  // R2 / local path
  primaryColor String   @default("#0F62FE")
  fontFamily   String   @default("Inter")
  footer       String?  // legal disclaimer text
  letterhead   String?  // signature line
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)

  @@map("pdf_branding")
}
```

Singleton row (id="singleton") — global для всіх документів.

### UI

`/workspace/admin/branding`:

- Logo upload (PNG/JPG, max 2MB).
- Color picker для primary.
- Font dropdown (Inter, Roboto, OpenSans — bundled fonts).
- Live preview: sample invoice render у iframe.

`packages/templates/src/pdf/invoice.tsx` приймає `branding` props → React-PDF render.

---

## 4. Nomenclature

### Сценарій

Owner хоче мати каталог фіксованих позицій ("Audit SEO — $200", "Logo design — $300") з кодами, які з'являються в invoices.

### Storage

`service_nomenclature`:

```prisma
model ServiceNomenclature {
  id            String   @id @default(uuid())
  code          String   @unique   // "SVC-001"
  name          String              // "SEO audit"
  description   String?
  basePriceUsd  Decimal  @db.Decimal(10, 2)
  unit          String   @default("each")  // 'each' | 'hour' | 'month'
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now()) @db.Timestamptz(3)

  charges  ServiceCharge[]  // FK back-ref

  @@map("service_nomenclature")
}
```

### Per-order override

При додаванні позиції до invoice:

1. Owner обирає nomenclature код → автозаповнення name + basePriceUsd.
2. Може переписати price у конкретному рахунку (override).
3. ServiceCharge зберігає `nomenclatureId + finalPrice` (override flag implicit).

### UI

`/workspace/admin/nomenclature`:

- CRUD table.
- "Bulk import" — CSV upload.
- "Activate/Deactivate" — soft hide без видалення (preserved у history charges).

---

## 5. Departments CRUD

### Storage

`departments`:

```prisma
model Department {
  id          String   @id @default(uuid())
  slug        String   @unique  // 'design', 'dev'
  name        String              // "Design"
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)

  executors   ExecutorRate[]  // back-ref

  @@map("departments")
}
```

### Seed

З `DEFAULT_DEPARTMENT_SLUGS` у `@workflo/types/constants`: design / dev / marketing / management / qa / devops / content.

### UI

`/workspace/admin/departments`:

- Simple CRUD table.
- "Deactivate" замість delete — executors зберігають department reference у history.

---

## 6. Cron monitoring

`/workspace/admin/crons`:

- Table з усіма cron jobs (з `CRON_JOBS.md`): name / schedule / last_run / status (success/failed/skipped) / duration.
- "Run now" button per cron — manual trigger (admin-only, audit-logged).
- "Pause" toggle — disabled cron не run by scheduler.

Storage у `cron_runs` (написується кожним cron job як heartbeat):

```prisma
model CronRun {
  id           String   @id @default(uuid())
  cronName     String   // 'C16:loyalty_recalc'
  startedAt    DateTime @db.Timestamptz(3)
  endedAt      DateTime? @db.Timestamptz(3)
  status       String   // 'running' | 'success' | 'failed' | 'skipped'
  durationMs   Int?
  errorMessage String?
  metadata     Json?

  @@index([cronName, startedAt DESC])
  @@map("cron_runs")
}
```

Alert: якщо очікуваний run відсутній > 2× expected interval → PagerDuty.

---

## Access control

```typescript
function isAdmin(user: AuthContext): boolean {
  return user.role === 'executor' && user.email === env.ADMIN_EMAIL
}
```

Future: dedicated `role = 'admin'` enum value (`task #24` — повний RBAC).

---

## Audit log

Кожна дія в admin section → `audit_logs` з `action = 'admin.<sub-area>'`:

- `admin.template_updated` (event/channel/locale)
- `admin.smtp_sender_updated` (senderId, field)
- `admin.branding_updated`
- `admin.nomenclature_changed` (code, action)
- `admin.department_updated`
- `admin.cron_manual_triggered` (cronName)

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

- **`isAdmin = email===ADMIN_EMAIL` → `can(user,'admin.access')`** (ADR-002) + tenant-guard (ADR-004). Admin стає per-agency роллю, не глобальним email-збігом.
- **Per-agency scoping всіх таблиць:** `NotificationTemplate`, `SmtpSender`, `ServiceNomenclature`, `Department`, `PdfBranding` → `+ agencyId`; унікальність scoped (`@@unique([agencyId, slug])` / `([agencyId, code])` / `([agencyId, event, channel, locale])`). `PdfBranding` перестає бути `id="singleton"` → один рядок на агенцію.
- `SmtpSender` пароль — через той самий envelope-KEK, що credentials vault (не власна крипта).
- `CronRun.agencyId` nullable (платформні крони — null; per-agency — set).

### B. Feature-флаги (per-agency) ✅

- `AgencyFeatureFlag { agencyId, key, enabled }` + кеш. Гейтить модулі/фічі per-agency → поетапний rollout і майбутні SaaS-тарифи (basic/pro). `isFeatureEnabled(agencyId,key)` helper.

### C. Outbound webhooks ✅

- `WebhookEndpoint { id, agencyId, url, events[], secret, isActive }` + `WebhookDelivery` (статус/спроби). Доставка **через outbox** (retry/DLQ, topic #2-3), HMAC-підпис `X-Workflo-Signature`. Події: order.created, payment.confirmed тощо. Agency інтегрує Zapier/Make/власний бекенд.

### D. API-ключі агенції ✅

- `ApiKey { id, agencyId, name, hashedKey, scopes[], expiresAt, lastUsedAt, revokedAt }`. Bearer-auth-шлях (поряд з JWT), scoped permissions через `can()`. Прев'ю public-API (topic #10). Показуємо plaintext лише раз при створенні.

### E. Export/import конфіга ✅

- JSON-снапшот налаштувань агенції (templates/nomenclature/departments/branding) → бекап/клон/онбординг нової агенції. Import — валідація + dry-run preview.

```
Reconcile: NotificationTemplate/SmtpSender/ServiceNomenclature/Department/PdfBranding + agencyId; CronRun.agencyId
New: AgencyFeatureFlag, WebhookEndpoint, WebhookDelivery, ApiKey
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

Статус у REVIEW: ✅ ПІДТВЕРДЖЕНО — «варто додати все».

| ID   | Рішення                     | Вплив       | Нюанси власника                                                                                              |
| ---- | --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| 20-А | **Роль «менеджер»**         | [бек+can()] | +1 роль без повного RBAC: замовлення/чати/клієнти — так; фінанси/налаштування — ні                           |
| 20-Б | **View-as клієнт**          | [бек+банер] | owner бачить портал очима клієнта, read-only з банером                                                       |
| 20-В | **Журнал змін налаштувань** | [екран]     | екран поверх audit_logs                                                                                      |
| 20-Д | **Кілька юр-осіб агенції**  | [бек+екран] | профілі реквізитів; вибір юр-особи на проєкті/клієнті для договорів і рахунків; реалізувати ДО S6-документів |

### ⭐ ГЛОБАЛЬНА НОТАТКА ВЛАСНИКА (у фінальний план)

**Після проходу всіх модулів — переосмислити систему ролей** (повний RBAC: ролі агенції, права клієнтських членів, нова роль менеджера, view-as, платформні ролі SaaS). Окремий блок у фінальному плані + міні-спека.

**Для ТЗ дизайнеру (попередньо):** банер view-as (Б); екран журналу змін (В); профілі юр-осіб + селектор на проєкті/клієнті (Д).
