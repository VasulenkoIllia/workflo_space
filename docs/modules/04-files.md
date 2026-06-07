# FILES & STORAGE MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (portal.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/storage`
> Оновлено: 1 червня 2026 (doc-sync)

---

## Огляд

Модуль відповідає за завантаження, зберігання та видачу файлів. В MVP файли зберігаються на Docker Volume (локальний диск сервера). Архітектура побудована на `StorageAdapter` патерні — перехід на Hetzner Object Storage в Phase 2 не вимагає змін у бізнес-логіці.

---

## StorageAdapter патерн

```typescript
// packages/storage/src/StorageAdapter.ts
interface StorageAdapter {
  upload(file: Buffer, path: string, mimeType: string): Promise<string> // returns public URL
  download(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
}

// packages/storage/src/LocalStorageAdapter.ts (MVP)
class LocalStorageAdapter implements StorageAdapter {
  constructor(private basePath: string) {} // /data/uploads

  async upload(file: Buffer, path: string): Promise<string> {
    const fullPath = join(this.basePath, path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, file)
    return `/files/${path}` // relative URL → API serves it
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

> **Канонічний layout — див. «## S1 alignment update → Storage layout» + «## Аудит-фіналізація A» нижче.** Стисло: tenant-prefixed `agencies/<agencyId>/orders/<orderId>/<fileId>.<ext>`, аватари `agencies/<agencyId>/avatars/<profileId>.<ext>`. Права `0640` файли / `0750` теки.
>
> ⚠️ **Застарілий не-tenant layout видалено** (`/data/uploads/orders/{orderId}/comments/{commentId}/...`) — суперечив agency-ізоляції.

---

## Бізнес-логіка

### Завантаження файлу

1. Клієнт відправляє `POST /files` з `multipart/form-data`
2. Fastify парсить через `@fastify/multipart`
3. Валідація: розмір ≤ ліміту, MIME-тип в allowlist
4. Генеруємо tenant-prefixed ключ: `agencies/<agencyId>/orders/<orderId>/<fileId>.<ext>` (`buildOrderFileKey`)
5. Передаємо буфер до `storage.upload()`
6. Зберігаємо метадані в таблицю `file_attachments`
7. Повертаємо `{ id, url, fileName, fileSize, mimeType }`

### Прив'язка файлу

Файл прив'язаний до замовлення (`orderId` — **NOT NULL** у реальній `OrderFile`). Прив'язка до коментаря (`commentId`) та документа (`documentId`/`context`) — **відкладено** до відповідних фіч (comment-attachments / S5-документи), див. «## Аудит-фіналізація A».

### Ліміти

| Контекст               | Макс. розмір  | Макс. кількість      |
| ---------------------- | ------------- | -------------------- |
| Коментар               | 50 МБ / файл  | 10 файлів            |
| Замовлення (вкладення) | 100 МБ / файл | 20 файлів            |
| Аватар                 | 5 МБ          | 1 файл               |
| Документ (PDF)         | —             | генерується сервером |

### Дозволені MIME-типи

> **Канонічний allowlist — «## S1 alignment update → MIME allowlist (SVG removed)» нижче** (джерело: `packages/types/src/files.ts`). Стисло: png/jpeg/webp/gif, pdf, txt/csv, zip, office (docx/xlsx/pptx + ms-excel/msword), video/mp4·webm. **`image/svg+xml` ВИКЛЮЧЕНО** (stored-XSS). Інше → 415.

### Видача файлів (serving)

> **Канонічно — id-based serve** (`GET /files/:id/content`): lookup `storedAs` з БД (НЕ шлях з URL), traversal-guard (`safeResolve`, див. «## S1 alignment → Path traversal guard»), `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`. Access-check `canAccessFile` (tenant + participant + internal-comment confidentiality).
>
> ⚠️ **Застарілий `GET /files/*` зі шляхом-з-URL + `findFirst({storagePath})` + `Content-Disposition: inline` видалено** — це саме той анти-патерн (path-from-URL + inline-XSS), який S1 прибрав.
>
> **Phase 2 (S3-адаптер, «## Аудит-фіналізація C»):** presigned URL з TTL; API авторизує + редіректить, не проксіює бінарь.

### Видалення файлів

- Soft delete в `file_attachments.deletedAt`
- Фізичне видалення з диску — окремий cron job (щодня, видаляє файли де `deletedAt < now() - 7 days`)

---

## API Endpoints

| Метод    | URL                  | Опис                                 |
| -------- | -------------------- | ------------------------------------ |
| `POST`   | `/orders/:id/files`  | Завантажити файл (multipart, 1 файл) |
| `GET`    | `/orders/:id/files`  | Всі файли замовлення                 |
| `GET`    | `/files/:id`         | Метадані файлу                       |
| `GET`    | `/files/:id/content` | Завантажити бінарний контент         |
| `DELETE` | `/files/:id`         | Soft delete файлу                    |

> **Стан реалізації (S2-09/10/11, 31.05.2026):** ✅ усі 5 ендпоінтів вище.
> Реальні шляхи: upload/list — **order-scoped** (`/orders/:id/files`, природно tenant+participant-guarded через `requireOrderParticipant`); serve — `/files/:id/content` (id-based lookup → `storedAs` з БД, НЕ шлях з URL), `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, traversal-guarded read. MIME-allowlist (`@workflo/types`, **SVG прибрано**) → 415; ліміт 100MB/файл → 413; 20 файлів/замовлення → 409; sha256 + tenant-prefixed key `agencies/<agencyId>/orders/<orderId>/<fileId><ext>`; `0640`.
> **OrderFile reconcile — S2-підмножина:** додано `agencyId`/`deletedAt`/`sha256`. Поля `commentId`/`documentId`/`context` **відкладено** до їхніх фіч (comment-attachments / S5-документи), бо потребують Document-моделі + comment-attachment-флоу.

---

## DTO

### `POST /orders/:id/files` (multipart/form-data)

```
file: <binary>           // 1 файл; orderId — зі шляху (order-scoped, participant-guarded)
```

> `commentId`/`context` form-поля — відкладено (див. «## Аудит-фіналізація A»). Реальний upload — order-scoped, не bare `/files`.

### File Response (`FILE_META_SELECT`)

```typescript
{
  id: string
  filename: string // не `fileName`
  mimeType: string
  sizeBytes: number // не `fileSize`
  sha256: string
  uploadedBy: string // profileId
  createdAt: string
  // без `url`/`storagePath`/`context`/`commentId` — контент через GET /files/:id/content
}
```

---

## DB Schema

> **Канонічна модель — `OrderFile` у `packages/db/prisma/schema.prisma`** (стара `FileAttachment` видалена з doc-sync).
> Поля: `id, agencyId, orderId, filename, storedAs, mimeType, sizeBytes, sha256, deletedAt?, createdAt`. **`storedAs`** канонічне (не `url`/`storagePath`); `commentId`/`documentId`/`context`/`thumbStoredAs` — план foundation-міграції (див. «## Аудит-фіналізація A/B»).

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
      device: /srv/workflo/uploads # шлях на хості
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

| Модуль        | Зв'язок                              |
| ------------- | ------------------------------------ |
| **Orders**    | Вкладення до замовлення              |
| **Chat**      | Вкладення до коментарів              |
| **Documents** | PDF зберігається як `FileAttachment` |
| **Auth**      | Перевірка доступу при завантаженні   |

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

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

> Авторитетна секція. Стара `FileAttachment`-модель + дубль storage-layout вище → видалити в doc-sync.

### A. Обов'язкові reconcile

- **`OrderFile` → реальна модель**: поля `commentId String?`, `documentId String?`, `context('order'|'comment'|'document'|'avatar')`, `deletedAt`, `sha256`, `storedAs` (не `url`/`storagePath`). Comment-attachments тепер представлені (`commentId`).
- **Один storage-layout** (видалити stale `/data/uploads/...comments/`): tenant-prefixed `agencies/<agencyId>/orders/<orderId>/<fileId>.<ext>`, аватари `agencies/<agencyId>/avatars/<profileId>.<ext>`.
- **Disk-cleanup при cascade**: hard-delete order/comment → видалити blob з диску/сховища (cron + on-delete hook). C04 виправити під реальні поля.
- **`agencyId`** + access-check `canAccessFile` (tenant + participant + internal-comment confidentiality).
- Path-traversal guard + SVG-removal + `Content-Disposition: attachment` (вже є).

### B. Image preview / тумбнейли ✅

- На upload зображення/PDF → async генерація прев'ю (`sharp`): `thumbnail` (256px) + `preview` (1024px) варіанти; `OrderFile.thumbStoredAs String?`.
- `GET /files/:id?variant=thumb|preview|original` (з access-check). UI: тумбнейли в чаті/галереї + lightbox.
- PDF: перша сторінка як прев'ю (`pdf-thumbnail`/`pdftoppm`).

### C. S3/R2 storage adapter ✅

- `packages/storage` `StorageAdapter` (вже інтерфейс + `LocalStorageAdapter`) → додати `S3StorageAdapter` (Cloudflare R2 / Hetzner Object Storage, S3 API). Вибір через env `STORAGE_TYPE=local|s3`.
- **Signed-URL serving**: замість стрімінгу через API — time-limited presigned URL (напр. 5хв) на download; API лише авторизує + редіректить. Tenant-prefixed keys.
- Env: `STORAGE_S3_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY/REGION`. Backups/CDN з коробки.

### Schema-зміни (foundation-міграція)

```
OrderFile: + commentId, documentId, context, deletedAt, sha256, thumbStoredAs, agencyId
           (storedAs канонічне; url/storagePath видалити)
```

> **→ BACKLOG (не обрано зараз):** virus-scan (ClamAV + `scanStatus` колонка — зарезервувати при бажанні), file versioning.
