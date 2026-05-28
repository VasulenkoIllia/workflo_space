# FILES & STORAGE MODULE
> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/storage`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль відповідає за завантаження, зберігання та видачу файлів. В MVP файли зберігаються на Docker Volume (локальний диск сервера). Архітектура побудована на `StorageAdapter` патерні — перехід на Hetzner Object Storage в Phase 2 не вимагає змін у бізнес-логіці.

---

## StorageAdapter патерн

```typescript
// packages/storage/src/StorageAdapter.ts
interface StorageAdapter {
  upload(file: Buffer, path: string, mimeType: string): Promise<string>  // returns public URL
  download(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
}

// packages/storage/src/LocalStorageAdapter.ts (MVP)
class LocalStorageAdapter implements StorageAdapter {
  constructor(private basePath: string) {}  // /data/uploads

  async upload(file: Buffer, path: string): Promise<string> {
    const fullPath = join(this.basePath, path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, file)
    return `/files/${path}`  // relative URL → API serves it
  }
  // ...
}

// packages/storage/src/HetznerStorageAdapter.ts (Phase 2)
class HetznerStorageAdapter implements StorageAdapter {
  // AWS SDK v3 compatible (Hetzner Object Storage = S3-compatible API)
  // ...
}
```

### Вибір адаптера

```typescript
// apps/api/src/plugins/storage.ts
const storage: StorageAdapter =
  process.env.STORAGE_TYPE === 'hetzner'
    ? new HetznerStorageAdapter({ ... })
    : new LocalStorageAdapter({ basePath: process.env.UPLOAD_DIR })

fastify.decorate('storage', storage)
```

---

## Файлова структура на диску

```
/data/uploads/
├── orders/
│   └── {orderId}/
│       ├── comments/
│       │   └── {commentId}/
│       │       └── {uuid}-{filename}
│       └── attachments/
│           └── {uuid}-{filename}
├── documents/
│   └── {documentId}/
│       └── {uuid}.pdf
└── avatars/
    └── {profileId}/
        └── {uuid}-{filename}
```

---

## Бізнес-логіка

### Завантаження файлу

1. Клієнт відправляє `POST /files` з `multipart/form-data`
2. Fastify парсить через `@fastify/multipart`
3. Валідація: розмір ≤ ліміту, MIME-тип в allowlist
4. Генеруємо унікальний шлях: `orders/{orderId}/comments/{uuid}-{originalName}`
5. Передаємо буфер до `storage.upload()`
6. Зберігаємо метадані в таблицю `file_attachments`
7. Повертаємо `{ id, url, fileName, fileSize, mimeType }`

### Прив'язка файлу

Файл може бути прив'язаний до:
- `orderId` — пряме вкладення до замовлення
- `commentId` — вкладення в коментар
- `documentId` — джерельний файл документа

Поля `orderId`, `commentId`, `documentId` в `file_attachments` — всі nullable, але хоча б одне має бути встановлено.

### Ліміти

| Контекст | Макс. розмір | Макс. кількість |
|---|---|---|
| Коментар | 50 МБ / файл | 10 файлів |
| Замовлення (вкладення) | 100 МБ / файл | 20 файлів |
| Аватар | 5 МБ | 1 файл |
| Документ (PDF) | — | генерується сервером |

### Дозволені MIME-типи

```typescript
const ALLOWED_MIME_TYPES = [
  // Документи
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Зображення
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  // Архіви
  'application/zip', 'application/x-rar-compressed',
  // Текст
  'text/plain', 'text/csv',
]
```

### Видача файлів (serving)

В MVP — Fastify статично видає файли з `/data/uploads`:

```typescript
// apps/api/src/routes/files.ts
fastify.get('/files/*', async (req, reply) => {
  const filePath = req.params['*']
  // Перевіряємо права доступу: чи має юзер доступ до orderId цього файлу
  const attachment = await db.fileAttachment.findFirst({
    where: { storagePath: filePath }
  })
  if (!attachment) return reply.status(404).send()
  if (!canAccessFile(req.user, attachment)) return reply.status(403).send()

  const buffer = await storage.download(filePath)
  reply.header('Content-Type', attachment.mimeType)
  reply.header('Content-Disposition', `inline; filename="${attachment.fileName}"`)
  return reply.send(buffer)
})
```

> **Phase 2:** Hetzner генерує pre-signed URLs з TTL 1 годину. Fastify тільки видає URL, не проксіює бінарний трафік.

### Видалення файлів

- Soft delete в `file_attachments.deletedAt`
- Фізичне видалення з диску — окремий cron job (щодня, видаляє файли де `deletedAt < now() - 7 days`)

---

## API Endpoints

| Метод | URL | Опис |
|---|---|---|
| `POST` | `/files` | Завантажити файл |
| `GET` | `/files/:id` | Метадані файлу |
| `GET` | `/files/*` | Завантажити бінарний контент |
| `DELETE` | `/files/:id` | Soft delete файлу |
| `GET` | `/orders/:id/files` | Всі файли замовлення |

---

## DTO

### `POST /files` (multipart/form-data)

```
fields:
  orderId?: string       // прив'язка до замовлення (опційно при завантаженні)
  commentId?: string     // прив'язка до коментаря
  context: 'order_attachment' | 'comment' | 'avatar'
file: <binary>
```

### File Response

```typescript
{
  id: string
  fileName: string          // оригінальна назва
  fileSize: number          // bytes
  mimeType: string
  url: string               // /files/{path} або pre-signed URL (Phase 2)
  context: string
  orderId: string | null
  commentId: string | null
  uploadedBy: string        // profileId
  createdAt: string
}
```

---

## DB Schema

```prisma
model FileAttachment {
  id          String    @id @default(uuid())
  fileName    String
  fileSize    Int
  mimeType    String
  storagePath String    // відносний шлях на диску або Hetzner key
  url         String    // публічний URL
  context     String    // 'order_attachment' | 'comment' | 'avatar' | 'document'
  orderId     String?
  commentId   String?
  documentId  String?
  uploadedBy  String
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())

  order    Order?    @relation(fields: [orderId], references: [id])
  comment  Comment?  @relation(fields: [commentId], references: [id])
  uploader Profile   @relation(fields: [uploadedBy], references: [id])

  @@index([orderId])
  @@index([commentId])
  @@index([uploadedBy])
}
```

---

## Docker Volume конфігурація

```yaml
# docker-compose.prod.yml
services:
  api:
    volumes:
      - uploads_data:/data/uploads

volumes:
  uploads_data:
    driver: local
    driver_opts:
      type: none
      device: /srv/workflo/uploads  # шлях на хості
      o: bind
```

> Backup: `/srv/workflo/uploads` включається в щоденний backup скрипт поряд з PostgreSQL dump.

---

## Міграція Local → Hetzner (Phase 2)

1. Встановити env `STORAGE_TYPE=hetzner` + `HETZNER_*` credentials
2. Запустити міграційний скрипт: ітерує `file_attachments WHERE deletedAt IS NULL`, завантажує з диску до Hetzner, оновлює `url` в DB
3. Переключити `STORAGE_TYPE` → новий код використовує HetznerAdapter
4. Старий Volume залишити ще 30 днів як backup, потім видалити

---

## Безпека

- Доступ до файлів перевіряється через бізнес-логіку (чи є юзер в замовленні)
- UUID в імені файлу — unguessable URL (для MVP достатньо)
- Phase 2: pre-signed URLs з TTL + Hetzner bucket private (no public read)
- Не зберігаємо оригінальне ім'я в шляху — санітизація через `slugify(originalName)` + UUID prefix

---

## Зв'язки з іншими модулями

| Модуль | Зв'язок |
|---|---|
| **Orders** | Вкладення до замовлення |
| **Chat** | Вкладення до коментарів |
| **Documents** | PDF зберігається як `FileAttachment` |
| **Auth** | Перевірка доступу при завантаженні |

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### Path traversal guard

Всі file serving endpoints (`GET /files/:id`, `GET /orders/:id/files/:fileId`, etc.) **обов'язково** валідують:

```typescript
import { resolve, sep } from 'node:path'

function safeResolve(uploadsRoot: string, requested: string): string {
  const resolved = resolve(uploadsRoot, requested)
  if (!resolved.startsWith(uploadsRoot + sep) && resolved !== uploadsRoot) {
    throw new ForbiddenError('path_traversal_blocked')
  }
  return resolved
}
```

`requested` ніколи не приходить з URL прямо — це **завжди** `stored_as` колонка з `order_files` row (lookup by id). Захист на випадок SQL injection / data corruption.

### MIME allowlist (SVG removed)

Старий allowlist дозволяв `image/svg+xml`. **SVG видалено** через XSS risk (SVG може містити `<script>` теги, який рендериться браузером якщо відкритий як `Content-Type: image/svg+xml`).

Поточний allowlist:
- `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- `application/pdf`
- `text/plain`, `text/csv`
- `application/zip`
- `application/vnd.openxmlformats-officedocument.*` (docx, xlsx, pptx)
- `application/vnd.ms-excel`, `application/msword`
- `video/mp4`, `video/webm` (max 100MB)

Будь-який інший MIME → 415 Unsupported Media Type.

### Content-Disposition

Завжди `Content-Disposition: attachment; filename="<escaped>"` — навіть для inline-friendly types (PDF, images). Захист від ransom-via-malicious-html.

Single exception: thumbnails preview через `?inline=1` + `attachment-thumbnail` access (still escaped).

### Storage layout

```
/var/lib/workflo/uploads/
  ├── orders/
  │   └── <orderId>/
  │       ├── <fileId>.<ext>   ← stored file
  │       └── ...
  ├── documents/
  │   └── <documentId>.pdf
  └── avatars/
      └── <profileId>.<ext>
```

Permissions: `0640` files, `0750` directories. Owner `workflo`, group `workflo`. Web server has read-only access (`workflo-web` group).

### Backup of uploads

Окремий cron `C13:uploads_backup` (щодня о 04:00):
- `rsync --delete /var/lib/workflo/uploads → /backup/uploads/`
- Compress weekly to `/backup/uploads-weekly-<date>.tar.gz`.
- Encrypt + upload to Hetzner Object Storage (GPG AES-256, див. `INFRASTRUCTURE.md` секція "Backups").
