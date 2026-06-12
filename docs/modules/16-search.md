# SEARCH & FILTERS MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`
> Оновлено: 12 квітня 2026

---

## Огляд

Пошук і фільтрація по основних сутностях системи: замовлення, компанії, коментарі, блог. Реалізується через PostgreSQL full-text search (`tsvector` + GIN індекси) без додаткових сервісів (Elasticsearch — Phase 3).

---

## Архітектура

### PostgreSQL Full-Text Search

```sql
-- Автоматично оновлюваний tsvector через trigger

-- Для orders:
ALTER TABLE orders ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('ukrainian', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX orders_search_idx ON orders USING GIN(search_vector);

-- Для companies:
ALTER TABLE companies ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('ukrainian', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX companies_search_idx ON companies USING GIN(search_vector);

-- Для blog_posts:
ALTER TABLE blog_posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('ukrainian', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX blog_posts_search_idx ON blog_posts USING GIN(search_vector);
```

> `GENERATED ALWAYS AS ... STORED` — PostgreSQL 12+. Автоматично оновлюється при `INSERT`/`UPDATE`, не потрібно trigger.

### Пошуковий запит

```typescript
// apps/api/src/utils/search.ts
export function buildSearchQuery(query: string): string {
  // "автоматизація звіт" → "автоматизація & звіт"
  // Додаємо :* для prefix search ("авт" → знаходить "автоматизація")
  const words = query.trim().split(/\s+/)
  return words.map((w) => `${w}:*`).join(' & ')
}

// Використання в Prisma raw query:
const results = await db.$queryRaw`
  SELECT id, title, ts_rank(search_vector, query) AS rank
  FROM orders
  WHERE search_vector @@ to_tsquery('ukrainian', ${buildSearchQuery(searchQuery)})
    AND deleted_at IS NULL
    AND company_id = ${companyId}
  ORDER BY rank DESC
  LIMIT ${limit}
  OFFSET ${offset}
`
```

---

## Global Search (Workspace)

Глобальний пошук в workspace дозволяє шукати по всіх сутностях одночасно.

### `GET /search`

```
Query params:
  q=автоматизація    // рядок пошуку, min 2 символи
  types=orders,companies,blog  // які типи шукати (default: orders,companies)
  limit=5            // результатів кожного типу
```

### Response

```typescript
{
  query: string
  results: {
    orders: {
      items: {
        id: string
        title: string
        status: OrderStatus
        companyName: string
        rank: number          // relevance score
        highlight: string     // фрагмент тексту з підсвіченим збігом
      }[]
      total: number
    }
    companies: {
      items: {
        id: string
        name: string
        slug: string
        activeOrdersCount: number
        rank: number
      }[]
      total: number
    }
    blog?: {
      items: {
        id: string
        title: string
        slug: string
        excerpt: string
        rank: number
      }[]
      total: number
    }
  }
}
```

### Highlight (підсвічування збігів)

```sql
SELECT
  id,
  title,
  ts_headline('ukrainian', title || ' ' || coalesce(description, ''),
    to_tsquery('ukrainian', $query),
    'MaxWords=15, MinWords=5, StartSel=<mark>, StopSel=</mark>'
  ) AS highlight,
  ts_rank(search_vector, to_tsquery('ukrainian', $query)) AS rank
FROM orders
WHERE search_vector @@ to_tsquery('ukrainian', $query)
```

---

## Фільтрація замовлень (Orders)

Фільтри по замовленнях детально описані в модулі 02-orders.md. Тут — загальний патерн побудови запитів.

### Query Builder патерн

```typescript
// apps/api/src/utils/buildOrdersWhere.ts
export function buildOrdersWhere(query: OrdersQuery, userRole: Role, userId: string) {
  const where: Prisma.OrderWhereInput = {
    deletedAt: null, // завжди
  }

  // Роль-залежна фільтрація
  if (userRole === 'executor') {
    where.executors = { some: { userId } }
  } else if (userRole === 'client') {
    where.companyId = getUserCompanyId(userId)
  }

  // Фільтри
  if (query.status) {
    where.status = { in: query.status.split(',') as OrderStatus[] }
  }
  if (query.priority) {
    where.priority = { in: query.priority.split(',') as Priority[] }
  }
  if (query.companyId) {
    where.companyId = query.companyId
  }
  if (query.executorId) {
    where.executors = { some: { userId: query.executorId } }
  }
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined,
    }
  }
  if (query.search) {
    where.searchVector = {
      search: buildSearchQuery(query.search),
    }
  }

  return where
}
```

---

## Пошук по блогу (Landing)

Пошук на публічному лендингу (workflo.space/blog) — client-side фільтр по завантажених постах (в MVP постів мало). При масштабуванні переходимо на API.

### `GET /blog/search`

```
q=автоматизація
language=uk
limit=10
```

---

## Autocomplete (Workspace)

Для деяких полів — autocomplete з dropdown (наприклад, вибір компанії при фільтрації):

### `GET /search/autocomplete`

```
q=рома       // мінімум 2 символи
type=companies|executors|orders
limit=5
```

```typescript
// Response
{
  items: {
    id: string
    label: string      // відображуваний текст
    subtitle?: string  // додатковий текст
  }[]
}
```

---

## Фільтри для різних розділів

### Companies list (Workspace)

```
search=назва компанії
tier=bronze|silver|gold|platinum    // loyalty tier
hasActiveOrders=true|false
dateFrom=
dateTo=
page=1&limit=20
sortBy=name|createdAt|activeOrders
sortDir=asc|desc
```

### Payments list (Workspace)

```
companyId=
orderId=
status=pending|confirmed|rejected
type=advance|partial|final
dateFrom=
dateTo=
amountMin=
amountMax=
page=1&limit=20
```

### Team members (Workspace)

```
search=ім'я або email
isActive=true|false
```

### Blog (Workspace)

```
search=
status=draft|published|archived
language=uk|en
tagId=
page=1&limit=20
```

---

## Сортування

Стандартний патерн сортування для всіх list endpoints:

```typescript
const SORT_FIELDS = {
  orders: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'totalAmount'],
  companies: ['name', 'createdAt', 'activeOrders'],
  payments: ['createdAt', 'amount'],
}

// Безпечна валідація
const sortBy = SORT_FIELDS.orders.includes(query.sortBy) ? query.sortBy : 'createdAt'
const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
```

---

## Пагінація

Два типи пагінації в системі:

### Offset-based (list views)

```typescript
// Query: page=2&limit=20
const skip = (page - 1) * limit
const [items, total] = await db.$transaction([
  db.order.findMany({ skip, take: limit, where, orderBy }),
  db.order.count({ where }),
])

// Response
{
  items: [...],
  pagination: {
    page: 2,
    limit: 20,
    total: 143,
    totalPages: 8,
  }
}
```

### Cursor-based (chat/comments)

```typescript
// Query: before=commentId&limit=50
const comment = await db.comment.findUnique({ where: { id: before } })
const items = await db.comment.findMany({
  where: { orderId, createdAt: { lt: comment.createdAt } },
  orderBy: { createdAt: 'desc' },
  take: limit,
})

// Response
{
  items: items.reverse(),  // хронологічний порядок
  hasMore: items.length === limit,
  nextCursor: items[0]?.id ?? null,  // для наступного запиту
}
```

---

## Збережені фільтри (Phase 2)

В Phase 2 — можливість зберігати набори фільтрів (наприклад "Мої термінові замовлення") в `profile.savedFilters` JSON поле.

---

## Performance

- GIN індекси на `search_vector` колонках — швидкий full-text пошук
- `EXPLAIN ANALYZE` при додаванні нових запитів
- Query timeout: 5 секунд (Fastify + pg)
- `limit` max: 100 для всіх list endpoints

---

## Зв'язки з іншими модулями

| Модуль        | Пошук/Фільтр                                  |
| ------------- | --------------------------------------------- |
| **Orders**    | Основний об'єкт пошуку, повний набір фільтрів |
| **Companies** | Пошук по назві, фільтр по тайєру              |
| **Blog**      | Full-text пошук по статтях                    |
| **Team**      | Пошук по виконавцях                           |
| **Billing**   | Фільтри по платежах і рахунках                |

---

## Аудит-фіналізація (30 травня 2026) — reconcile + engine

### A. Обов'язкові reconcile

**`agencyId` у FTS DDL** (composite/paired GIN — cross-tenant leak інакше!); `websearch_to_tsquery` (не raw `to_tsquery` — 500 на `&`/`:`); scoping по membership-set (не single `getUserCompanyId`); `ukrainian` text-config migration (інакше 500); post-filter через `can()`; rate-limit на `/search` + autocomplete; soft-delete фільтр для companies/blog.

### B. Engine — фазовано ✅

- **Фаза 1 (MVP): Postgres FTS** — `tsvector` generated columns + GIN, agency-scoped. Достатньо для старту, без зайвої інфри.
- **Фаза 2: Meilisearch/Typesense** — `SearchAdapter` інтерфейс (FTS|meili), swap без зміни викликів; синхронізація індексу через **domain-events/outbox** (order.created/updated → reindex). Typo-tolerance + instant-search.

### C. Command palette (Cmd+K) ✅

- Глобальна палітра (frontend, workspace+portal): пошук замовлень/клієнтів/документів + швидкі дії (створити замовлення, перейти). Б'є по `/search` + actions-registry.

```
New: SearchAdapter (packages/search); tsvector+GIN columns (agency-scoped)
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                                                              | Вплив               | Нюанси власника |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------- |
| 16-А | **Широке охоплення індексу**: замовлення + клієнти + коментарі + документи + файли (далі ліди/тікети) в одному Cmd+K | [бек]               | —               |
| 16-Б | **Пошук у Portal** (клієнт шукає свої замовлення/документи/чати)                                                     | [бек+екран дрібний] | —               |
| 16-В | **Збережені фільтри/views** на списках замовлень                                                                     | [бек дрібний+екран] | —               |

**Майбутнє (зафіксовано):** Г — повнотекст у вкладеннях (після Meilisearch).

**Для ТЗ дизайнеру:** Cmd+K палітра з групами результатів (А); пошук-поле в Portal (Б); UI збережених фільтрів (В).
