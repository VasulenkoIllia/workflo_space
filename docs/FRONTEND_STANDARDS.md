# FRONTEND STANDARDS
> Стандарти і рішення для Portal та Workspace (React Vite SPA)
> Версія: 1.0 | Оновлено: 12 квітня 2026

---

## ЗМІСТ

1. [Стек рішення](#1-стек-рішення)
2. [API клієнт](#2-api-клієнт)
3. [Auth стан](#3-auth-стан)
4. [Управління станом](#4-управління-станом)
5. [packages/ui — компонентна бібліотека](#5-packagesui--компонентна-бібліотека)
6. [Loading states](#6-loading-states)
7. [In-app нотифікації (Bell)](#7-in-app-нотифікації-bell)
8. [Обробка помилок на frontend](#8-обробка-помилок-на-frontend)
9. [Дати та timezone](#9-дати-та-timezone)
10. [Default аватари](#10-default-аватари)
11. [Тестова стратегія](#11-тестова-стратегія)

---

## 1. СТЕК РІШЕННЯ

Принцип: **прості, перевірені інструменти з великою спільнотою**. Без експериментів.

| Задача | Рішення | Чому |
|---|---|---|
| Server state | **TanStack Query v5** | Кешування, refetch, loading/error стани — з коробки |
| Client state | **Zustand** | Мінімум бойлерплейту, простий API |
| Routing | **React Router v6** | Найзріліший, великий ecosystem |
| Форми | **React Hook Form + Zod** | Мінімум ре-рендерів, Zod схеми вже є в packages/types |
| Таблиці | **TanStack Table v8** | Headless, гнучкий, сортування/фільтрація |
| Дати | **date-fns + date-fns-tz** | Tree-shakeable, без глобального стану |
| Toast | **Sonner** | Найпростіший, гарний, dark mode |
| Drag & Drop | **dnd-kit** | Сучасний, доступний (замість abandon react-beautiful-dnd) |
| UI primitives | **Radix UI** | Accessible без стилів, стилізуємо через Tailwind |
| Файли | **react-dropzone** | Стандарт для upload |
| Онбординг тур | **react-joyride** | Lightweight tooltip tour |
| Іконки | **lucide-react** | Консистентний набір, tree-shakeable |

### Vite конфіг (portal + workspace ідентично)

```typescript
// apps/portal/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,  // 3002 для workspace
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

---

## 2. API КЛІЄНТ

> Простий fetch wrapper без Axios. Живе в `src/lib/api.ts` кожного додатку (portal/workspace).
> Shared типи беремо з `packages/types`.

```typescript
// apps/portal/src/lib/api.ts (аналогічно в workspace)
import type { ApiErrorCode } from '@workflo/types'

const BASE_URL = import.meta.env.VITE_API_URL  // http://localhost:4000 або https://api.workflo.space

// Access token живе в модульній змінній (не в стані — щоб не перемальовувати всі компоненти)
let _accessToken: string | null = null
let _isRefreshing = false
let _refreshQueue: Array<() => void> = []

export function setAccessToken(token: string | null) {
  _accessToken = token
}

// Клас для API помилок — можна catch і перевірити code
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public message: string,
    public details?: unknown,
    public status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',  // відправляє httpOnly cookie
    })
    if (!res.ok) return false
    const { data } = await res.json()
    setAccessToken(data.accessToken)
    return true
  } catch {
    return false
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
      ...options.headers,
    },
  })

  // 401 → спробуємо refresh один раз
  if (res.status === 401 && _retry) {
    if (_isRefreshing) {
      // Якщо вже йде refresh — ставимо в чергу
      await new Promise<void>((resolve) => _refreshQueue.push(resolve))
      return request<T>(endpoint, options, false)
    }

    _isRefreshing = true
    const ok = await refreshAccessToken()
    _isRefreshing = false
    _refreshQueue.forEach((fn) => fn())
    _refreshQueue = []

    if (ok) return request<T>(endpoint, options, false)

    // Refresh не вдався → редирект на логін
    setAccessToken(null)
    window.location.href = '/login'
    throw new ApiError('TOKEN_EXPIRED' as ApiErrorCode, 'Сесія закінчилася. Будь ласка, увійдіть знову.')
  }

  // 204 No Content
  if (res.status === 204) return null as T

  const body = await res.json()

  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, body.error.details, res.status)
  }

  return body.data as T
}

// Зручний API об'єкт
export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { method: 'GET', ...options }),

  post: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body), ...options }),

  patch: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  put: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body), ...options }),

  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { method: 'DELETE', ...options }),

  // Для multipart/form-data (файли)
  upload: <T>(url: string, formData: FormData) =>
    request<T>(url, {
      method: 'POST',
      body: formData,
      headers: {},  // НЕ встановлюємо Content-Type — браузер сам додасть boundary
    }),
}
```

### TanStack Query інтеграція

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // дані свіжі 5 хвилин
      retry: (failureCount, error) => {
        // Не ретраємо 401, 403, 404 — це очікувані помилки
        if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) return false
        return failureCount < 2
      },
    },
    mutations: {
      onError: (error) => {
        // Глобальний toast для всіх mutation помилок
        if (error instanceof ApiError) {
          toast.error(error.message)
        } else {
          toast.error('Щось пішло не так. Спробуйте ще раз.')
        }
      },
    },
  },
})
```

---

## 3. AUTH СТАН

> Простий AuthContext + TanStack Query для отримання профілю. Без Redux.

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, setAccessToken } from '@/lib/api'
import type { ProfileDto } from '@workflo/types'

interface AuthContextValue {
  user: ProfileDto | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (accessToken: string, user: ProfileDto) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false)

  // Крок 1: При завантаженні — намагаємось відновити сесію через refresh
  useEffect(() => {
    api.post<{ accessToken: string; user: ProfileDto }>('/auth/refresh')
      .then(({ accessToken, user }) => {
        setAccessToken(accessToken)
        queryClient.setQueryData(['auth', 'me'], user)
      })
      .catch(() => {
        // Не залогінений — окей
      })
      .finally(() => setInitialized(true))
  }, [])

  // Крок 2: Отримуємо актуальний профіль
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<ProfileDto>('/auth/me'),
    enabled: initialized,
    staleTime: Infinity,  // профіль не застаріває (оновлюємо вручну після PATCH /profile)
    retry: false,
  })

  const login = (accessToken: string, userData: ProfileDto) => {
    setAccessToken(accessToken)
    queryClient.setQueryData(['auth', 'me'], userData)
  }

  const logout = async () => {
    await api.post('/auth/logout')
    setAccessToken(null)
    queryClient.clear()
    window.location.href = '/login'
  }

  if (!initialized) return <SplashScreen />  // Логотип + spinner поки перевіряємо сесію

  return (
    <AuthContext.Provider value={{
      user: user ?? null,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

### Protected Route

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <PageSkeleton />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
```

### Auto-refresh access token

Access token живе 15 хвилин. Замість перехоплення 401 — можна додатково refresh за 1 хв до expire:

```typescript
// В AuthProvider useEffect:
// JWT decode → exp field → setTimeout на (exp - 60s) → виклик /auth/refresh
// Це опційно — 401 interceptor вже вирішує проблему
```

---

## 4. УПРАВЛІННЯ СТАНОМ

**Правило: 2 рівні стану — server та client.**

| Тип стану | Інструмент | Приклади |
|---|---|---|
| Server state | TanStack Query | Замовлення, профіль, нотифікації |
| UI / client state | Zustand | Відкриті модалі, sidebar collapsed, theme |
| Form state | React Hook Form | Форма замовлення, форма профілю |
| URL state | React Router | Фільтри, активна вкладка, сторінка пагінації |

### Zustand store (приклад)

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand'

interface UiStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  activeModal: string | null
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}))
```

### Фільтри в URL (React Router)

```typescript
// /orders?status=in_progress&priority=high&page=2
// Читаємо з useSearchParams — фільтри зберігаються при F5 і можна шерити посилання

const [searchParams, setSearchParams] = useSearchParams()
const status = searchParams.get('status') ?? undefined
const page = Number(searchParams.get('page') ?? 1)

// При зміні фільтру:
setSearchParams({ status: 'in_progress', page: '1' })
```

---

## 5. PACKAGES/UI — КОМПОНЕНТНА БІБЛІОТЕКА

> Всі компоненти підтримують light та dark теми через Tailwind CSS variables.
> Базові примітиви — Radix UI (accessibility). Стилізація — Tailwind.

### Структура

```
packages/ui/src/
├── components/
│   ├── Button/
│   ├── Input/
│   ├── Textarea/
│   ├── Select/
│   ├── Checkbox/
│   ├── Switch/
│   ├── Badge/
│   ├── StatusBadge/          ← специфічний для статусів замовлень
│   ├── Avatar/
│   ├── Card/
│   ├── Modal/
│   ├── DropdownMenu/
│   ├── Tooltip/
│   ├── Tabs/
│   ├── Alert/
│   ├── Spinner/
│   ├── Skeleton/
│   ├── EmptyState/
│   ├── ConfirmDialog/
│   ├── Progress/
│   ├── Table/
│   ├── Pagination/
│   ├── FileDropzone/
│   ├── DatePicker/
│   ├── SearchInput/
│   └── NotificationBell/
├── providers/
│   └── ThemeProvider.tsx
├── hooks/
│   ├── useTheme.ts
│   ├── useMediaQuery.ts
│   └── useDebounce.ts
├── lib/
│   └── cn.ts                 ← clsx + tailwind-merge
└── index.ts
```

### CSS Variables (globals.css)

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --primary: 238 83% 67%;       /* #4f46e5 indigo */
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;
    --accent: 210 40% 96%;
    --destructive: 0 84% 60%;     /* red */
    --warning: 38 92% 50%;        /* amber */
    --success: 142 76% 36%;       /* green */
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 238 83% 67%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222 47% 8%;
    --foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --primary: 238 83% 67%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --accent: 217 33% 17%;
    --destructive: 0 63% 55%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 238 83% 67%;
  }
}
```

### Компоненти — специфікація

#### Button

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean         // показує spinner, блокує клік
  disabled?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
}

// Використання:
<Button variant="primary" loading={isPending}>Зберегти</Button>
<Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />}>Видалити</Button>
```

#### Input

```tsx
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string            // текст помилки під полем (червоний)
  hint?: string             // підказка під полем (сірий)
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  required?: boolean
}

// Інтеграція з React Hook Form:
<Input
  label="Назва замовлення"
  error={errors.title?.message}
  required
  {...register('title')}
/>
```

#### Badge

```tsx
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

interface BadgeProps {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean             // кольорова крапка перед текстом
  children: ReactNode
}
```

#### StatusBadge (специфічний для замовлень)

```tsx
// Автоматично визначає колір і текст за статусом
interface StatusBadgeProps {
  status: OrderClientStatus | OrderInternalStatus
  view: 'client' | 'internal'
}

// Приклад:
<StatusBadge status="in_progress" view="client" />
// → зелений бейдж "В роботі"

// Маппінг статусів → кольори і тексти — в packages/types/src/constants.ts
```

#### Avatar

```tsx
interface AvatarProps {
  src?: string | null
  name: string              // для initials fallback
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showOnline?: boolean      // зелена крапка
}

// Логіка:
// 1. Якщо src — показуємо img
// 2. Якщо src null/undefined — показуємо initials з брендовим кольором
// Колір = BRAND_COLORS[hashCode(name) % BRAND_COLORS.length]
```

#### Modal (Radix Dialog)

```tsx
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: ReactNode
  footer?: ReactNode        // кнопки внизу
}

// Використання:
<Modal open={isOpen} onClose={() => setIsOpen(false)} title="Нове замовлення" size="lg">
  <CreateOrderForm onSuccess={() => setIsOpen(false)} />
</Modal>
```

#### ConfirmDialog

```tsx
// Для деструктивних дій — "Ви впевнені?"
interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string     // default: "Підтвердити"
  confirmVariant?: 'primary' | 'danger'  // default: 'danger'
  loading?: boolean
}

// Використання:
<ConfirmDialog
  open={showDeleteConfirm}
  title="Видалити замовлення?"
  description="Цю дію неможливо скасувати."
  confirmLabel="Так, видалити"
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteConfirm(false)}
  loading={isDeleting}
/>
```

#### Skeleton

```tsx
// Замінює контент під час завантаження
interface SkeletonProps {
  className?: string
  lines?: number           // для тексту — кілька рядків
}

// Приклади:
<Skeleton className="h-8 w-48" />           // заголовок
<Skeleton className="h-4 w-full" lines={3} /> // текст

// Готові компоненти-скелетони:
<OrderCardSkeleton />
<TableRowSkeleton columns={6} rows={10} />
<OrderDetailSkeleton />
```

#### EmptyState

```tsx
type EmptyIcon = 'orders' | 'documents' | 'notifications' | 'files' | 'search' | 'generic'

interface EmptyStateProps {
  icon: EmptyIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void; variant?: ButtonVariant }
}
```

#### FileDropzone

```tsx
interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void
  accept?: Record<string, string[]>    // MIME types
  maxSize?: number                     // bytes, default 50MB
  maxFiles?: number                    // default 10
  disabled?: boolean
  uploading?: boolean                  // показує progress
  existingFiles?: FileDTO[]            // вже завантажені файли
  onRemoveExisting?: (fileId: string) => void
}
```

#### Table

```tsx
// Тонка обгортка навколо TanStack Table з нашими стилями
interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  loading?: boolean
  emptyState?: ReactNode
  onRowClick?: (row: TData) => void
  stickyHeader?: boolean
  className?: string
}
```

#### ThemeProvider

```tsx
// packages/ui/src/providers/ThemeProvider.tsx
type Theme = 'light' | 'dark' | 'system'

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Зчитуємо з user profile (при логіні) або localStorage (fallback)
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) || 'system'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

---

## 6. LOADING STATES

**Принцип: Skeleton для початкового завантаження, inline spinner для мутацій.**

### Правила

| Ситуація | Підхід |
|---|---|
| Перше завантаження сторінки | Skeleton (компонент-скелетон) |
| Повторне завантаження (refetch) | Нічого не показуємо — старі дані залишаються |
| Кнопка Submit / Save | Spinner всередині кнопки, кнопка disabled |
| Завантаження файлу | Progress bar |
| Видалення рядка в таблиці | Рядок стає прозорим (opacity-50) |
| Глобальний стан | НЕ використовуємо глобальний spinner |

### Skeleton приклади

```tsx
// Список замовлень
function OrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })

  if (isLoading) return <OrdersTableSkeleton />
  if (!data?.items.length) return <EmptyState icon="orders" title="Замовлень ще немає" ... />

  return <OrdersTable orders={data.items} />
}

// OrdersTableSkeleton.tsx
function OrdersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}
```

### Оптимістичні оновлення (чат)

```typescript
// При надсиланні коментаря — показуємо одразу, до відповіді сервера
const sendMessage = useMutation({
  mutationFn: (text: string) => api.post(`/orders/${orderId}/comments`, { text }),
  onMutate: async (text) => {
    // Додаємо тимчасовий коментар в кеш
    const optimisticComment = { id: `temp-${Date.now()}`, text, isPending: true, ... }
    queryClient.setQueryData(['comments', orderId], (old) => ({
      ...old,
      items: [...old.items, optimisticComment]
    }))
    return { optimisticComment }
  },
  onError: (_, __, context) => {
    // Відкочуємо якщо помилка
    queryClient.setQueryData(['comments', orderId], (old) => ({
      ...old,
      items: old.items.filter(c => c.id !== context.optimisticComment.id)
    }))
    toast.error('Не вдалося надіслати повідомлення')
  },
  onSettled: () => {
    // Оновлюємо реальними даними
    queryClient.invalidateQueries({ queryKey: ['comments', orderId] })
  }
})
```

---

## 7. IN-APP НОТИФІКАЦІЇ (BELL)

### Архітектура

```
API SSE stream (/notifications/stream)
  → EventSource в NotificationsProvider
  → Zustand store: { items, unreadCount }
  → NotificationBell компонент (badge + dropdown)
```

### NotificationsProvider

```typescript
// src/contexts/NotificationsContext.tsx
import { create } from 'zustand'
import type { NotificationDTO } from '@workflo/types'

interface NotificationsStore {
  items: NotificationDTO[]
  unreadCount: number
  addNotification: (n: NotificationDTO) => void
  markRead: (id: string) => void
  markAllRead: () => void
  setInitial: (items: NotificationDTO[], unreadCount: number) => void
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  items: [],
  unreadCount: 0,
  addNotification: (n) => set((s) => ({
    items: [n, ...s.items].slice(0, 50),  // тримаємо max 50 в пам'яті
    unreadCount: s.unreadCount + 1,
  })),
  markRead: (id) => set((s) => ({
    items: s.items.map(i => i.id === id ? { ...i, isRead: true } : i),
    unreadCount: Math.max(0, s.unreadCount - 1),
  })),
  markAllRead: () => set((s) => ({
    items: s.items.map(i => ({ ...i, isRead: true })),
    unreadCount: 0,
  })),
  setInitial: (items, unreadCount) => set({ items, unreadCount }),
}))

// Підключення SSE
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { addNotification, setInitial } = useNotificationsStore()

  // Завантажуємо початкові нотифікації
  useEffect(() => {
    if (!isAuthenticated) return
    api.get<{ items: NotificationDTO[]; unreadCount: number }>('/notifications?limit=20')
      .then(({ items, unreadCount }) => setInitial(items, unreadCount))
  }, [isAuthenticated])

  // SSE підключення
  useEffect(() => {
    if (!isAuthenticated) return

    const BASE_URL = import.meta.env.VITE_API_URL
    const es = new EventSource(`${BASE_URL}/notifications/stream`, { withCredentials: true })

    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === 'new_notification') {
          addNotification(data.notification)
          // Звуковий сигнал (опційно)
          // new Audio('/sounds/notification.mp3').play().catch(() => {})
        }
      } catch {}
    })

    es.addEventListener('error', () => {
      // EventSource автоматично перепідключається — нічого не робимо
    })

    return () => es.close()
  }, [isAuthenticated])

  return <>{children}</>
}
```

### NotificationBell компонент

```tsx
// packages/ui/src/components/NotificationBell/NotificationBell.tsx
export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotificationsStore()
  const [open, setOpen] = useState(false)

  const handleNotificationClick = (notification: NotificationDTO) => {
    if (!notification.isRead) {
      api.patch(`/notifications/${notification.id}/read`)
      markRead(notification.id)
    }
    // Навігація по meta: orderId → /orders/:id
    if (notification.meta?.orderId) {
      navigate(`/orders/${notification.meta.orderId}`)
      setOpen(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-semibold">Сповіщення</span>
          {unreadCount > 0 && (
            <button onClick={() => { api.patch('/notifications/read-all'); markAllRead() }}
              className="text-xs text-primary hover:underline">
              Позначити всі прочитаними
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Немає нових сповіщень
          </div>
        ) : (
          items.map(n => (
            <button key={n.id} onClick={() => handleNotificationClick(n)}
              className={cn('w-full text-left p-3 hover:bg-muted border-b last:border-0 transition-colors',
                !n.isRead && 'bg-primary/5')}>
              <div className="flex items-start gap-2">
                {!n.isRead && <span className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />}
                <div className={!n.isRead ? '' : 'ml-4'}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## 8. ОБРОБКА ПОМИЛОК НА FRONTEND

### Рівні обробки

```
1. TanStack Query onError (глобальний) → toast.error(message)
2. ErrorBoundary (per-page) → fallback UI
3. Inline error в формах (React Hook Form + Zod)
4. Network offline → banner
```

### ErrorBoundary

```tsx
// src/components/ErrorBoundary.tsx
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertTriangle className="text-destructive" size={48} />
      <h2 className="text-xl font-semibold">Щось пішло не так</h2>
      <p className="text-muted-foreground text-sm max-w-sm text-center">
        Спробуйте оновити сторінку. Якщо проблема повторюється — напишіть нам.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={resetErrorBoundary}>Спробувати ще раз</Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>Оновити сторінку</Button>
      </div>
    </div>
  )
}

// Використання — обгортаємо кожну сторінку:
<ReactErrorBoundary FallbackComponent={ErrorFallback}>
  <OrdersPage />
</ReactErrorBoundary>

// Або глобально в Router:
<ReactErrorBoundary FallbackComponent={ErrorFallback} onReset={() => navigate('/')}>
  <Outlet />
</ReactErrorBoundary>
```

### Network offline banner

```tsx
// src/components/OfflineBanner.tsx
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground py-2 text-center text-sm">
      Немає з'єднання з інтернетом. Деякі функції недоступні.
    </div>
  )
}
```

### Переклад API error кодів → повідомлення

```typescript
// packages/i18n/src/uk/errors.json — маппінг кодів на зрозумілі повідомлення
{
  "INVALID_CREDENTIALS": "Невірний email або пароль",
  "ACCOUNT_INACTIVE": "Акаунт деактивовано. Зверніться до підтримки.",
  "EMAIL_TAKEN": "Ця адреса вже використовується",
  "ORDER_NOT_FOUND": "Замовлення не знайдено або у вас немає доступу",
  "INVALID_STATUS_TRANSITION": "Неможливо змінити статус на цьому етапі",
  "FILE_TOO_LARGE": "Файл завеликий. Максимальний розмір: 50 МБ",
  "FILE_TYPE_NOT_ALLOWED": "Цей тип файлу не підтримується",
  "INSUFFICIENT_LOYALTY_POINTS": "Недостатньо бонусних балів",
  "AI_GENERATION_TIMEOUT": "Генерація зайняла надто довго. Введіть текст вручну або спробуйте ще раз.",
  "INTERNAL_ERROR": "Щось пішло не так. Ми вже розбираємося.",
  "SERVICE_UNAVAILABLE": "Сервіс тимчасово недоступний. Спробуйте через хвилину."
}
```

---

## 9. ДАТИ ТА TIMEZONE

```typescript
// packages/types/src/utils/dates.ts
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { uk, enUS } from 'date-fns/locale'

const KYIV_TZ = 'Europe/Kiev'

function getLocale(lang: 'uk' | 'en' = 'uk') {
  return lang === 'uk' ? uk : enUS
}

// Workspace: завжди Kyiv
export function toKyivTime(date: Date | string): Date {
  return toZonedTime(new Date(date), KYIV_TZ)
}

export function formatKyiv(date: Date | string, fmt = 'dd.MM.yyyy HH:mm', lang: 'uk' | 'en' = 'uk'): string {
  return formatTz(toZonedTime(new Date(date), KYIV_TZ), fmt, { timeZone: KYIV_TZ, locale: getLocale(lang) })
}

// Portal: браузерна timezone
export function formatLocal(date: Date | string, fmt = 'dd.MM.yyyy HH:mm', lang: 'uk' | 'en' = 'uk'): string {
  return format(new Date(date), fmt, { locale: getLocale(lang) })
}

// Відносний час: "2 хвилини тому", "вчора", "3 квітня"
export function formatSmart(date: Date | string, lang: 'uk' | 'en' = 'uk'): string {
  const d = new Date(date)
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true, locale: getLocale(lang) })
  if (isYesterday(d)) return lang === 'uk' ? 'вчора' : 'yesterday'
  return format(d, 'd MMMM', { locale: getLocale(lang) })
}

// Тільки дата
export function formatDate(date: Date | string, lang: 'uk' | 'en' = 'uk'): string {
  return format(new Date(date), 'dd.MM.yyyy', { locale: getLocale(lang) })
}

// ISO для API запитів
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
```

### Використання

```tsx
// Workspace (завжди Kyiv)
<span>{formatKyiv(order.createdAt)}</span>              // "12.04.2026 14:30"
<span>{formatSmart(comment.createdAt)}</span>           // "5 хвилин тому"

// Portal (браузерна timezone)
<span>{formatLocal(payment.confirmedAt)}</span>         // за локальним часом

// DatePicker — передаємо Date об'єкт, конвертуємо перед API
const dueDate = toISODate(selectedDate)                 // "2026-05-01" → в API
```

---

## 10. DEFAULT АВАТАРИ

Якщо юзер не завантажив фото — показуємо брендові initials аватари.

### Логіка

```typescript
// packages/ui/src/components/Avatar/getAvatarConfig.ts

// 8 брендових кольорів (підібрані для light і dark тем)
const BRAND_COLORS = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-200' },
  { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-200' },
  { bg: 'bg-sky-100 dark:bg-sky-900',       text: 'text-sky-700 dark:text-sky-200' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-200' },
  { bg: 'bg-amber-100 dark:bg-amber-900',   text: 'text-amber-700 dark:text-amber-200' },
  { bg: 'bg-rose-100 dark:bg-rose-900',     text: 'text-rose-700 dark:text-rose-200' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900',     text: 'text-cyan-700 dark:text-cyan-200' },
  { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-200' },
]

// Детермінований хеш рядка → індекс кольору
function stringHash(str: string): number {
  return str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

// Ініціали з імені
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function getAvatarConfig(name: string) {
  const color = BRAND_COLORS[stringHash(name) % BRAND_COLORS.length]
  return { initials: getInitials(name), ...color }
}

// Avatar компонент:
export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const sizeClasses = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-lg' }

  if (src) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover', sizeClasses[size])} />
  }

  const { initials, bg, text } = getAvatarConfig(name)
  return (
    <div className={cn('rounded-full flex items-center justify-center font-semibold', sizeClasses[size], bg, text)}>
      {initials}
    </div>
  )
}
```

**Результат:** "Іван Петренко" → завжди фіолетовий "ІП". Детермінований — однаковий колір в усіх місцях де показується цей юзер.

---

## 11. ТЕСТОВА СТРАТЕГІЯ

**Принцип: тестуємо бізнес-логіку та критичні flows. Не ганяємося за 100% coverage.**

### Стек

| Інструмент | Призначення |
|---|---|
| **Vitest** | Unit + integration тести (швидкий, ESM, той самий конфіг що і Vite) |
| **React Testing Library** | Компонентні тести |
| **MSW (Mock Service Worker)** | Мокаємо API в frontend тестах |
| **Playwright** | E2E тести тільки критичних flows |

### Що тестуємо

**Unit (Vitest) — packages/types:**
```typescript
// packages/types/src/__tests__/orderStatus.test.ts
describe('mapToClientStatus', () => {
  it('new → pending', () => expect(mapToClientStatus('new')).toBe('pending'))
  it('done → completed', () => expect(mapToClientStatus('done')).toBe('completed'))
})

describe('ALLOWED_TRANSITIONS', () => {
  it('cannot go from done to in_progress', () => {
    expect(ALLOWED_TRANSITIONS['done']).not.toContain('in_progress')
  })
})
```

**Integration (Vitest + реальна DB) — API routes:**
```typescript
// apps/api/src/__tests__/orders.test.ts
// Використовуємо тестову БД (DATABASE_URL_TEST) + seed перед кожним тестом
describe('POST /orders', () => {
  it('creates order for authenticated client', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      headers: { Authorization: `Bearer ${clientToken}` },
      body: { title: 'Test Order', priority: 'medium' }
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.title).toBe('Test Order')
  })

  it('returns 403 for executor', async () => {
    const res = await app.inject({ ... headers: { Authorization: executorToken } ... })
    expect(res.statusCode).toBe(403)
  })
})
```

**Component (RTL + MSW) — критичні компоненти:**
```typescript
// apps/portal/src/__tests__/LoginForm.test.tsx
describe('LoginForm', () => {
  it('shows error on invalid credentials', async () => {
    server.use(http.post('/auth/login', () => HttpResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Невірний email або пароль' } },
      { status: 401 }
    )))
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com')
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    expect(await screen.findByText('Невірний email або пароль')).toBeInTheDocument()
  })
})
```

**E2E (Playwright) — тільки критичні flows:**
```typescript
// e2e/auth.spec.ts
test('client can register, create order, see status', async ({ page }) => {
  await page.goto('http://localhost:3001/register')
  await page.fill('[name=email]', 'newclient@test.com')
  // ...register...
  await expect(page).toHaveURL('/orders')
  await page.click('text=Нове замовлення')
  // ...create order...
  await expect(page.locator('[data-testid=client-status]')).toHaveText('В очікуванні')
})
```

### Coverage ціль

| Пакет | Ціль |
|---|---|
| `packages/types` | **90%** (pure logic, легко тестувати) |
| `packages/notifications` | **80%** |
| `apps/api` (routes) | **70%** (integration tests) |
| `apps/portal` (компоненти) | **50%** (тільки критичні) |
| `apps/workspace` | **50%** |

### vitest.config.ts

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',  // для API тестів
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 70 },
    },
    setupFiles: ['./test/setup.ts'],
  },
})
```
