# SETTINGS MODULE
> App: Portal (app.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
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
  newPassword: string    // min 8 символів
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
  taxId: string | null        // ЄДРПОУ/ІПН для документів
  preferredLanguage: 'uk' | 'en'
  referralCode: string        // workflo-XXXXXX (readonly)
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
  }[]
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
interface CompanyMemberPermissions {
  canCreateOrders: boolean      // default: true
  canViewBilling: boolean       // default: false
  canViewDocuments: boolean     // default: true
  canViewAllOrders: boolean     // default: false (тільки свої)
  canInviteMembers: boolean     // default: false
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

| Метод | URL | Хто |
|---|---|---|
| `GET/PATCH` | `/settings/profile` | Всі |
| `POST` | `/settings/profile/avatar` | Всі |
| `POST` | `/settings/change-password` | Всі |
| `GET/PATCH` | `/settings/notifications` | Всі |
| `POST` | `/settings/telegram/link` | Всі |
| `DELETE` | `/settings/telegram/unlink` | Всі |
| `GET/PATCH` | `/settings/company` | Company Owner |
| `POST` | `/settings/company/logo` | Company Owner |
| `GET` | `/settings/company/members` | Company Owner |
| `POST` | `/settings/company/members/invite` | Company Owner |
| `PATCH/DELETE` | `/settings/company/members/:id` | Company Owner |
| `GET/PATCH` | `/settings/system` | Owner (Workspace) |
| `POST` | `/settings/system/refresh-rate` | Owner (Workspace) |
| `GET` | `/settings/activity-log` | Owner (Workspace) |

---

## Зв'язки з іншими модулями

| Модуль | Зв'язок |
|---|---|
| **Auth** | Зміна паролю, Telegram link через OTP |
| **Files** | Upload аватару та логотипу |
| **Notifications** | Налаштування каналів нотифікацій |
| **Team** | Управління командою через Settings |
| **Billing** | Системні налаштування білінгу (курс, ціни) |
