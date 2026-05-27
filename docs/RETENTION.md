# DATA RETENTION POLICY

**Призначення:** скільки часу зберігаємо різні класи даних, з якими діями (purge / anonymize / archive). Виконується нічним кроном `C18:retention_purge`.

---

## Принцип

Кожна сутність має одну з трьох політик:
1. **Forever** — зберігаємо безстроково (фінансові/легальні документи).
2. **N days then purge** — hard delete після N днів від `createdAt` або `deletedAt`.
3. **N days then anonymize** — заміняємо PII на placeholder, зберігаємо id + relations.

---

## Таблиця retention

| Сутність | Політика | TTL | Тригер | Дія |
|---|---|---|---|---|
| **profiles** (deactivated) | anonymize | 30 днів | `isActive=false AND deactivatedAt+30d` | email → `deleted-<id>@deleted.local`, name → `Deleted user`, avatarUrl → null |
| **companies** (soft-deleted) | hard delete | 90 днів | `deletedAt+90d` | Cascade hard delete: members, orders, invoices, etc. |
| **orders** (soft-deleted) | hard delete | 90 днів | `deletedAt+90d` | Hard delete + dependent files, comments, time logs, activity_logs |
| **order_comments** | follows order | — | — | — |
| **order_files** | follows order | — | — | + delete blob on disk |
| **time_logs** (orphaned) | hard delete | follows order | — | — |
| **documents** (invoices) | **forever** | ∞ | — | Финал. документи не видаляються (legal/audit) |
| **payments** | **forever** | ∞ | — | Финал. движения коштів |
| **audit_logs** | hard delete | 365 днів | `createdAt+365d` | Hard delete |
| **notification_logs** | hard delete | 90 днів | `createdAt+90d` | Hard delete |
| **notifications** (in-app) | hard delete | 90 днів | `createdAt+90d AND isRead=true` | Hard delete; unread зберігаємо |
| **password_reset_tokens** | hard delete | 24 години | `expiresAt+24h` | Hard delete |
| **otp_tokens** | hard delete | 24 години | `expiresAt+24h` | Hard delete |
| **invites** (expired/cancelled) | hard delete | 30 днів | `expiresAt+30d OR cancelled` | Hard delete |
| **refresh_tokens** (revoked/expired) | hard delete | 7 днів | `revokedAt+7d OR expiresAt+7d` | Hard delete |
| **credentials_vault** (revoked) | hard delete | 90 днів | `revokedAt+90d` | Hard delete; remaining items lose access to encrypted_dek + ciphertext |
| **blog_posts** (archived) | **forever** | ∞ | — | Tag тільки змінюється на archived; контент зберігаємо |
| **executor_rates** (historical) | **forever** | ∞ | — | Збереження для retro pay calculations |
| **exchange_rates** | hard delete | 365 днів | `createdAt+365d` | Тримаємо рік для repricing audit |
| **referrals** | **forever** | ∞ | — | Зберігаємо для history attribution |
| **activity_logs** | hard delete | 365 днів | `createdAt+365d` | Hard delete; перетинається з audit_logs для security events |

---

## Cron C18: `retention_purge`

**Расписание:** щодня о 03:00 (low-traffic window).

**Послідовність:**
1. **Anonymize stage** (фіз. видалення PII):
   - profiles: `WHERE isActive=false AND COALESCE(deactivatedAt, updatedAt) < NOW() - INTERVAL '30 days'`.
2. **Soft → hard delete stage**:
   - companies: `WHERE deletedAt < NOW() - INTERVAL '90 days'` → DELETE (FK cascade).
   - orders: `WHERE deletedAt < NOW() - INTERVAL '90 days'` → DELETE (FK cascade).
3. **TTL-based purge stage**:
   - notification_logs: `WHERE createdAt < NOW() - INTERVAL '90 days'`.
   - notifications: `WHERE createdAt < NOW() - INTERVAL '90 days' AND isRead = true`.
   - audit_logs: `WHERE createdAt < NOW() - INTERVAL '365 days'`.
   - activity_logs: `WHERE createdAt < NOW() - INTERVAL '365 days'`.
   - password_reset_tokens: `WHERE expiresAt < NOW() - INTERVAL '24 hours'`.
   - otp_tokens: `WHERE expiresAt < NOW() - INTERVAL '24 hours'`.
   - invites: `WHERE expiresAt < NOW() - INTERVAL '30 days' OR (usedAt IS NULL AND createdAt < NOW() - INTERVAL '30 days' AND cancelledAt IS NOT NULL)`.
   - refresh_tokens: `WHERE COALESCE(revokedAt, expiresAt) < NOW() - INTERVAL '7 days'`.
   - exchange_rates: `WHERE createdAt < NOW() - INTERVAL '365 days'`.
   - credentials revoked: `WHERE revokedAt < NOW() - INTERVAL '90 days'`.
4. **Storage purge stage** (file blobs):
   - For each order_file row that was deleted in step 2 → delete physical file from disk.
   - For each completion_act/invoice PDF tied to a deleted order → keep PDF if Document.status='sent' (legal), else delete.
5. **Report**:
   - Cron logs `{anonymized: N, hard_deleted: {entity → N}, files_deleted: N}` to audit_logs with actor=null, action=`retention.purge`.

**Idempotency:** all DELETE статementи safe to re-run (next day's run sees fewer rows).

**Performance budget:** окрема DB connection з 30s statement timeout. If exceeds, partial commit + flag for next-day continuation. Alert via cron heartbeat if 3 consecutive failures.

---

## Backup retention

Окремо від prod data (див. `INFRASTRUCTURE.md` секція "Backups"):

| Бекап | Зберігаємо | Локація |
|---|---|---|
| Daily snapshot | 7 днів | Local + Hetzner Object Storage (GPG AES-256) |
| Weekly snapshot | 4 тижні | Hetzner Object Storage |
| Monthly snapshot | 12 місяців | Hetzner Object Storage |
| Yearly snapshot | 7 років | Cold storage (legal compliance) |

---

## GDPR / "право бути забутим"

Якщо клієнт надсилає запит на видалення своїх даних:
1. **Не блокуємо запит** через legal/billing — приймаємо, але виконуємо part-anonymize:
   - `profiles`: anonymize одразу (не чекаємо 30d).
   - `order_comments` де authorId = цей profile: replace content → `[deleted by user request]`, keep id для thread integrity.
   - `documents` (invoices) пов'язані з його company: **зберігаємо** (legal обов'язок, 7 років в Україні).
   - `payments`: **зберігаємо** (фінансові операції).
   - `audit_logs`: keep (security trail).
2. Видаємо клієнту confirmation: "Ваші персональні дані анонімізовано; фінансові документи зберігаються згідно з законодавством."

Endpoint: `POST /profile/data-deletion-request` (потребує password confirm + email confirm-link).

---

## Перегляд політики

Переглядати раз на квартал. Зміни логуються у git history цього файлу.
