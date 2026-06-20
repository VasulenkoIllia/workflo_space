# SETTINGS MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль налаштувань включає: профіль користувача, налаштування компанії (Portal), системні налаштування (Workspace/Owner), нотифікації, безпека (пароль, Telegram).

---

## Налаштування профілю (обидва apps)

Доступно всім авторизованим користувачам.

### `GET /settings/profile`

```typescript
{
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  language: 'uk' | 'en'
  theme: 'light' | 'dark' | 'system'
  telegramLinked: boolean
  telegramUsername: string | null
}
```

### `PATCH /settings/profile`

```typescript
{
  displayName?: string    // max 100 символів
  language?: 'uk' | 'en'
  theme?: 'light' | 'dark' | 'system'
}
```

### `POST /settings/profile/avatar`

```
multipart/form-data, file max 5MB, JPEG/PNG/WebP
→ Upload через StorageAdapter → URL зберігається в profiles.avatarUrl
```

### `POST /settings/change-password`

```typescript
{
  currentPassword: string
  newPassword: string // min 8 символів
  confirmPassword: string
}
```

---

## Налаштування нотифікацій

### `GET /settings/notifications`

Повертає `NotificationSettings` об'єкт (деталі в модулі 07-notifications.md).

### `PATCH /settings/notifications`

Оновлює будь-яке поле `NotificationSettings`.

---

## Telegram прив'язка

### `POST /settings/telegram/link`

1. Генерує OTP в `otp_tokens` (`purpose=telegram_link`, `channel=telegram`, `expiresAt = now + 10 min`)
2. Повертає `{ botUrl: "https://t.me/workflo_bot?start=CODE" }`

### `DELETE /settings/telegram/unlink`

Очищає `profiles.telegramChatId = null`, `profiles.telegramUsername = null`.

---

## Налаштування компанії (Portal — Company Owner)

Company Owner може редагувати налаштування своєї компанії.

### `GET /settings/company`

```typescript
{
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  website: string | null
  phone: string | null
  address: string | null
  taxId: string | null // ЄДРПОУ/ІПН для документів
  preferredLanguage: 'uk' | 'en'
  referralCode: string // workflo-XXXXXX (readonly)
  createdAt: string
}
```

### `PATCH /settings/company`

```typescript
{
  name?: string
  description?: string
  website?: string
  phone?: string
  address?: string
  taxId?: string
  preferredLanguage?: 'uk' | 'en'
}
```

### `POST /settings/company/logo`

```
multipart/form-data, max 5MB → StorageAdapter → company.logoUrl
```

---

## Управління членами компанії (Portal — Company Owner)

### `GET /settings/company/members`

```typescript
{
  members: {
    id: string
    email: string
    displayName: string
    role: 'owner' | 'member'
    isActive: boolean
    joinedAt: string
    permissions: CompanyMemberPermissions
  }
  ;[]
}
```

### `POST /settings/company/members/invite`

```typescript
{
  email: string
  role: 'member'
  permissions?: CompanyMemberPermissions
}
```

### `PATCH /settings/company/members/:memberId`

```typescript
{
  isActive?: boolean
  permissions?: CompanyMemberPermissions
}
```

### `DELETE /settings/company/members/:memberId`

Видаляє `company_members` запис. Профіль залишається.

### CompanyMemberPermissions

```typescript
// Канон — packages/types tokens.ts (snake_case, рівно 5 ключів). Старі camelCase-набори — видалено.
interface CompanyMemberPermissions {
  can_create_tasks: boolean // default: true
  can_view_all_tasks: boolean // default: false (інакше — лише свої)
  can_view_billing: boolean // default: false
  can_approve_estimates: boolean // default: false
  can_invite_members: boolean // default: false
}
```

---

## Системні налаштування (Workspace — тільки Owner)

### `GET /settings/system`

```typescript
{
  exchangeRate: {
    usdToUah: number
    lastUpdated: string    // коли останній раз оновлено з НБУ
    source: 'nbu_api'
  }
  billing: {
    defaultServicePrice: number  // USD
    vatPercent: number           // 0 в MVP
  }
  workspace: {
    defaultExecutorId: string | null  // виконавець за замовчуванням для нових замовлень
    ipWhitelist: string[]             // readonly, з ENV
  }
}
```

### `PATCH /settings/system`

```typescript
{
  billing?: {
    defaultServicePrice?: number
    vatPercent?: number
  }
  workspace?: {
    defaultExecutorId?: string | null
  }
}
```

> `exchangeRate` — тільки читання в UI (оновлюється автоматично через cron). Owner може примусово тригернути оновлення кнопкою "Оновити курс".

### `POST /settings/system/refresh-rate`

Вручну тригерить запит до НБУ API і оновлює `exchange_rates` таблицю.

---

## Лог активності (Workspace — Owner)

### `GET /settings/activity-log`

```typescript
// Query
{
  entityType?: 'order' | 'payment' | 'company' | 'profile'
  actorId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

// Response
{
  items: {
    id: string
    entityType: string
    entityId: string
    action: string
    actorId: string
    actorName: string
    meta: Record<string, any>
    createdAt: string
  }[]
  total: number
}
```

---

## Небезпечна зона (Workspace — Owner)

### `DELETE /settings/account` (Phase 2)

Видалення акаунту — не в MVP.

### `POST /settings/system/maintenance-mode`

Включає maintenance mode (статична сторінка для клієнтів).

---

## UI/UX деталі

### Portal Settings

Секції (tabs або sidebar):

- "Профіль" — ім'я, аватар, мова, тема
- "Компанія" — дані компанії, лого
- "Команда" — члени компанії, запрошення
- "Нотифікації" — toggles для email/Telegram
- "Безпека" — зміна паролю, Telegram

### Workspace Settings

Секції:

- "Профіль" — ім'я, аватар, мова, тема
- "Команда" — список executors, запрошення (→ модуль 12)
- "Нотифікації" — toggles
- "Безпека" — пароль, Telegram
- "Система" (тільки owner) — курс, налаштування білінгу, лог активності

### Тема (light/dark/system)

```typescript
// packages/ui/src/ThemeProvider.tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useTheme()  // з localStorage + API

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
```

`profiles.theme` зберігається в БД — при логіні підтягується і встановлюється.

---

## API Endpoints Summary

| Метод          | URL                                | Хто               |
| -------------- | ---------------------------------- | ----------------- |
| `GET/PATCH`    | `/settings/profile`                | Всі               |
| `POST`         | `/settings/profile/avatar`         | Всі               |
| `POST`         | `/settings/change-password`        | Всі               |
| `GET/PATCH`    | `/settings/notifications`          | Всі               |
| `POST`         | `/settings/telegram/link`          | Всі               |
| `DELETE`       | `/settings/telegram/unlink`        | Всі               |
| `GET/PATCH`    | `/settings/company`                | Company Owner     |
| `POST`         | `/settings/company/logo`           | Company Owner     |
| `GET`          | `/settings/company/members`        | Company Owner     |
| `POST`         | `/settings/company/members/invite` | Company Owner     |
| `PATCH/DELETE` | `/settings/company/members/:id`    | Company Owner     |
| `GET/PATCH`    | `/settings/system`                 | Owner (Workspace) |
| `POST`         | `/settings/system/refresh-rate`    | Owner (Workspace) |
| `GET`          | `/settings/activity-log`           | Owner (Workspace) |

---

## Зв'язки з іншими модулями

| Модуль            | Зв'язок                                    |
| ----------------- | ------------------------------------------ |
| **Auth**          | Зміна паролю, Telegram link через OTP      |
| **Files**         | Upload аватару та логотипу                 |
| **Notifications** | Налаштування каналів нотифікацій           |
| **Team**          | Управління командою через Settings         |
| **Billing**       | Системні налаштування білінгу (курс, ціни) |

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

Прибрати `telegramUsername` (немає); notifications PATCH → матриця 7×6 (`NotificationPreference`); `/settings/activity-log` читає `AuditLog` (не order-only ActivityLog); **канонічний members-endpoint** = `/companies/:id/members*` (видалити дубль у 13); per-agency system-settings (exchange/billing defaults — не глобальний singleton); password-change → revoke other sessions + `tokenVersion++` + audit + rate-limit; avatar SVG-guard.

### B. Timezone + phone ✅

- `Profile.timezone String @default("Europe/Kyiv")` (для календаря/quiet-hours/рендеру) + `Profile.phone String?` (+ phone-verify через SMS OTP для SMS-каналу).

### C. Data export (GDPR self-service) ✅

- `POST /profile/data-export` → async ZIP/JSON (через outbox) → email-лінк. `POST /profile/data-deletion-request` (password + email confirm; flow з RETENTION.md → anonymize, фін.документи зберігаються).

### D. Appearance ✅

- `theme(light|dark|system)` (є) + `density(compact|comfortable)` + `language(uk|en)` — персистимо на Profile, застосовуємо в усіх 3 apps.

```
Profile: + timezone, phone, density
New: DataExportRequest
```

## Беклог-промоут (30.05) → у план

- **Темна тема в Portal** (S9): зараз dark лише у workspace, портал «always light». `ThemeProvider` (packages/ui) вже існує — потрібно лише підключити токени + перемикач у `/settings`. Low-effort полиш. Промоут із беклогу.

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

Вердикт власника: «додаємо всі» — прийнято всі 4 пункти.

| ID   | Рішення                                     | Вплив               | Нюанси власника                                                                                                |
| ---- | ------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| 13-А | **Робочі години + таймзона**                | [бек+екран дрібний] | Агенційні (модуль 20) + особиста TZ у профілі; враховуються в 07-Б («клієнт чекає»), дайджестах, майбутніх SLA |
| 13-Б | **Матриця сповіщень UI**                    | [екран]             | Підняти з «відкладено» в найближчий UI-прохід (бекенд готовий)                                                 |
| 13-В | **Дефолтна мова нових клієнтів** per-agency | [бек] копійка       | —                                                                                                              |
| 13-Г | **Завантаження аватарки**                   | [бек+екран дрібний] | —                                                                                                              |

Для ТЗ дизайнеру: екран матриці сповіщень (Б); аватар-аплоад у профілі (Г); поля роб. години/TZ в адмінці агенції + TZ у профілі (А).
