# CREDENTIALS VAULT MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: API + Workspace
> Статус: S5+ (post-MVP)
> Залежить від: `packages/db`, `packages/types`, KEK через env
> Оновлено: 27 травня 2026

---

> 🔄 **design-v2 (2026-06-20):** доставлено **portal-secrets** — клієнтський перегляд/шеринг доступів (3 екрани: список ресурсів, reveal з 2FA, журнал доступу): [`portal-secrets.jsx`](../../design-v2/project/portal-secrets.jsx). Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).
>
> ✅ **UPDATE 2026-07-01 — agency-side MVP збудовано** (банер «бекенд greenfield» застарів): `CredentialVault` модель + RLS, envelope AES-256-GCM (`credentialCrypto.ts`, KEK у env), ендпоінти list/create/reveal/revoke/delete + глобальний `/vault` + per-secret журнал доступів + **step-up повторним паролем** на reveal (grant 5хв) + per-owner reveal-throttle (10/год). UI: таб «Секрети» картки 360° + екран `/vault`. **Ще НЕ збудовано:** `PUT`/inline-edit секрету (§122/§179), portal self-service (17-А) + 2FA-модал на порталі, типізовані картки (17-Д), executor-share (`CredentialShare`), нагадування про ротацію.

## Огляд

Сейф для зберігання чутливих даних клієнта (CRM логіни, API keys, FTP-доступи, банкінг credentials etc) **прив'язаний до картки компанії**. Шифрування envelope: AES-256-GCM з master KEK у env + per-record DEK у БД.

**Access control:** ТІЛЬКИ owner компанії може bачити plaintext. Виконавці (executor role) — НЕ мають доступу навіть якщо назначені на orders цієї company.

---

## Чому envelope encryption

- Master KEK у env (`CREDENTIALS_KEK_BASE64`) ніколи не торкається БД.
- Кожен запис має свій DEK, зашифрований KEK. Якщо KEK rotated — перешифровуємо лише DEKs (швидко), не всі ciphertexts.
- Compromise однієї БД-таблиці ≠ compromise credentials (бо KEK у env, не в БД).

---

## Schema (Prisma)

```prisma
model CredentialVault {
  id           String    @id @default(uuid())
  companyId    String
  company      Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  label        String    // "Bitrix24 admin", "FTP клієнта", etc — plain
  service      String?   // "bitrix24" | "ftp" | "wordpress" | ...  — for filter/icon
  url          String?   // login URL — plain (UI шукає за URL)
  username     String?   // plain (для preview без reveal)
  encryptedDek Bytes     // DEK encrypted з KEK (AES-256-GCM)
  dekIv        Bytes     // 12-byte IV для DEK encryption
  dekAuthTag   Bytes     // 16-byte GCM auth tag для DEK
  ciphertext   Bytes     // password (or full JSON blob) encrypted з DEK
  ciphertextIv Bytes
  ciphertextAuthTag Bytes
  notes        String?   // plain notes (без секретів!)
  revokedAt    DateTime? @db.Timestamptz(3)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(3)
  createdById  String
  createdBy    Profile   @relation("CredentialCreatedBy", fields: [createdById], references: [id])

  @@index([companyId, revokedAt])
  @@map("credential_vault")
}
```

---

## Crypto flow

### Створення

```typescript
import { randomBytes, createCipheriv } from 'node:crypto'

function encryptCredential(plainPassword: string, kek: Buffer) {
  // 1. Generate fresh DEK + IVs
  const dek = randomBytes(32) // 256-bit
  const dekIv = randomBytes(12)
  const ctIv = randomBytes(12)

  // 2. Encrypt DEK with KEK
  const dekCipher = createCipheriv('aes-256-gcm', kek, dekIv)
  const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()])
  const dekAuthTag = dekCipher.getAuthTag()

  // 3. Encrypt ciphertext with DEK
  const ctCipher = createCipheriv('aes-256-gcm', dek, ctIv)
  const ciphertext = Buffer.concat([ctCipher.update(plainPassword, 'utf8'), ctCipher.final()])
  const ciphertextAuthTag = ctCipher.getAuthTag()

  // 4. Wipe DEK from memory
  dek.fill(0)

  return { encryptedDek, dekIv, dekAuthTag, ciphertext, ciphertextIv: ctIv, ciphertextAuthTag }
}
```

### Reveal (decrypt)

```typescript
function decryptCredential(row: CredentialVault, kek: Buffer): string {
  // 1. Decrypt DEK
  const dekDecipher = createDecipheriv('aes-256-gcm', kek, row.dekIv)
  dekDecipher.setAuthTag(row.dekAuthTag)
  const dek = Buffer.concat([dekDecipher.update(row.encryptedDek), dekDecipher.final()])

  // 2. Decrypt ciphertext
  const ctDecipher = createDecipheriv('aes-256-gcm', dek, row.ciphertextIv)
  ctDecipher.setAuthTag(row.ciphertextAuthTag)
  const plain = Buffer.concat([ctDecipher.update(row.ciphertext), ctDecipher.final()]).toString(
    'utf8'
  )

  dek.fill(0)
  return plain
}
```

---

## Endpoints

| Method   | Path                                        | Auth                 | Опис                                                                |
| -------- | ------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| `GET`    | `/companies/:id/credentials`                | **owner of company** | List (без plaintext — лише label/service/url/username/notes)        |
| `POST`   | `/companies/:id/credentials`                | owner                | Create new (приймає plain password у body, encrypts before store)   |
| `PUT`    | `/companies/:id/credentials/:credId`        | owner                | Update (full re-encrypt if password changed; partial if just label) |
| `POST`   | `/companies/:id/credentials/:credId/reveal` | owner                | Returns plaintext одноразово; audit-logged + rate-limited           |
| `POST`   | `/companies/:id/credentials/:credId/revoke` | owner                | revokedAt = now                                                     |
| `DELETE` | `/companies/:id/credentials/:credId`        | owner                | Hard delete після 2FA confirmation                                  |
| `GET`    | `/companies/:id/credentials/:credId/audit`  | owner                | History reveal-ів + updates                                         |

`can(user, 'credentials.read', { companyId })` → потребує `memberships.find(...).role === 'owner'`. **Executor НЕ має доступу навіть для assigned orders.**

---

## Reveal rate limit

- 10 reveals / 60 min per (profileId, companyId) pair.
- Перевищення → 429 + audit_log entry `credentials.reveal_rate_limited`.
- Захист від exfiltration через ущемлений account.

---

## Audit logging

Кожна дія з credentials → `audit_logs`:

| Action                 | Включає                                      |
| ---------------------- | -------------------------------------------- |
| `credentials.created`  | actor, credId, label                         |
| `credentials.updated`  | actor, credId, fields_changed (без значень!) |
| `credentials.revealed` | actor, credId, IP, user_agent                |
| `credentials.revoked`  | actor, credId, reason                        |
| `credentials.deleted`  | actor, credId                                |

Перегляд audit owner може у `/companies/:id/audit?type=credentials`.

---

## KEK rotation procedure

Раз на квартал (або на security incident):

1. Згенерувати новий KEK: `openssl rand -base64 32`.
2. Запустити `pnpm run rotate-credentials-kek --old=$OLD_KEK --new=$NEW_KEK`:
   - For each row: decrypt DEK with OLD_KEK → encrypt with NEW_KEK → update encryptedDek + dekIv + dekAuthTag.
   - Ciphertext НЕ змінюється (DEK той самий, тільки його обгортка).
   - Transaction-safe: всі updates у 1 transaction; rollback at first failure.
3. Replace `CREDENTIALS_KEK_BASE64` у production env → redeploy API.
4. Audit log: 1 row per rotated record + 1 row summary з `actor=admin, action=credentials.kek_rotated`.

Tooling: `tools/rotate-credentials-kek.ts` (admin-only script).

---

## UI у Workspace

Сторінка `/workspace/companies/:id/credentials`:

- Таблиця: label / service icon / url / username / actions.
- "Reveal" button — modal з confirmation + 2FA prompt (якщо налаштовано).
- Reveal результат показується **тимчасово** (10 секунд autohide + clipboard copy кнопка).
- "Edit" — інлайн форма.
- "Revoke" — sets `revokedAt`, з confirm dialog.
- Filter: active / revoked / by service.

**Не показуємо** plaintext у listing — лише label/url/username.

---

## Edge cases

- **Owner transfers company** → новий owner отримує доступ автоматично (credentials прив'язані до company, не до person). Audit log відмічає transfer.
- **KEK loss** → catastrophic, ВСІ credentials втрачені. Backup of KEK кладемо у Vault/1Password (manual procedure).
- **Executor вимагає доступ** → flow: executor → запит owner'у через chat → owner вирішує (можливо створити окремий "executor credentials" з обмеженим scope).
- **Credentials у файлі (PDF з API specs)** → НЕ кладемо в vault; файли у `order_files` без шифрування (захищено лише ACL).

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

Actions `credentials.reveal`/`revoke`/`delete` (окремі gated+audited, не лише read/update); **`agencyId`** + tenant-guard (cross-agency IDOR); `reveal` → `Cache-Control: no-store` + не логувати body; reveal revoked → deny; cascade delete company → audit bulk; KEK per-agency-чи-platform — вирішити (зараз env single → платформний, документувати).

### B. 2FA на reveal ✅

- `reveal` вимагає свіжого 2FA/password re-entry (challenge, valid 5хв) понад owner-роль. Прив'язано до модуля 01 (TOTP). Audit `credentials.revealed` з 2fa-flag.

### C. Шеринг з виконавцями (scoped) ✅

- `CredentialShare { id, credentialId, executorId, grantedBy, expiresAt, revokedAt }`. Owner тимчасово відкриває конкретний credential виконавцю (з терміном). Executor reveal лише в межах share + audit. Авто-revoke по expiry (cron).

### D. Нагадування про ротацію ✅

- `CredentialVault.expiresAt`, `rotationReminderDays`. Cron нагадує owner оновити (event `credentials.rotation_due`).

```
CredentialVault: + agencyId, expiresAt, rotationReminderDays
New: CredentialShare
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID        | Рішення                                                                                                                        | Вплив                                | Нюанси власника            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------------- |
| 17-А      | **Двосторонній ввід секретів**: клієнт додає ключі через Portal у свою картку + команда додає ключі клієнту з Workspace        | [бек+екран]                          |                            |
| 17-ГЛОБАЛ | **Глобальне сховище всіх ключів агенції** — один екран у Workspace: усі секрети всіх клієнтів, фільтри (клієнт / тип / сервіс) | [екран] (бек той самий, view поверх) | вимога власника            |
| 17-Д      | **Типізовані шаблони секретів**: сервер, FTP, «система логін+пароль», API-ключ (структуровані поля, копіювання per-поле)       | [бек дрібний+екран]                  | перелік типів від власника |
| 17-Б      | **Журнал доступів видимий клієнту** («хто з команди і коли відкривав»)                                                         | [бек дрібний+екран]                  |                            |

**Відхилено:** В (one-time secret link для не-користувачів).

**Для ТЗ дизайнеру:** форма додавання секрету в Portal (А); глобальний список ключів з фільтрами в Workspace (ГЛОБАЛ); картки типізованих секретів (Д); журнал доступів у Portal (Б). Нагадування: reveal — лише після 2FA (спека S9-05).
