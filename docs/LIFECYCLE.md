# LIFECYCLE

**Призначення:** edge cases для життєвого циклу сутностей (deactivate / delete / restore / transfer). Декрипція кожного стану, переходів, side-effects.

---

## 1. Profile

### States
- `active` (default): isActive=true. Може логуватися, отримувати нотифікації.
- `deactivated`: isActive=false. Не може логуватися; refresh tokens revoked; nothing sent.
- `deleted` (anonymized): hard delete email + name → `deleted-<id>@deleted.local` / `Deleted user`. Зберігаємо id для referential integrity (orders/comments/payments).

### Transitions

**active → deactivated** (user action `/profile/deactivate`):
- isActive ← false
- Revoke all RefreshToken rows (revokedAt = now).
- Cancel active timer (TimeLog autoStop) → log "user_deactivated" as reason.
- Send notification "auth.account_deactivated" → email tільки.
- For owner: блокується якщо є unpaid invoices або active orders. Treba спершу transfer ownership (див. 2).
- For executor: рекомендується переадресувати незакриті орди іншому виконавцю (не блокується автоматично — owner вирішує).

**deactivated → active** (admin action, або self via password reset within 30d):
- isActive ← true
- Email notification "auth.account_reactivated".

**deactivated → deleted** (after 30d grace period, або immediate admin action):
- Anonymize: email = `deleted-<id>@deleted.local`, name = 'Deleted user', avatarUrl = null.
- Keep id + role + createdAt for referential integrity.
- Audit log: `profile.deleted` with reason.

### Edge cases
- **Profile = owner of 1+ companies** → must transfer ownership first (cannot deactivate).
- **Profile = executor with active TimeLog** → auto-stop timer with reason='user_deactivated'.
- **Profile has unaccepted Invites sent by them** → mark invites as 'cancelled' (don't auto-delete — viewer might need history).

---

## 2. Company

### States
- `active`: normal operation.
- `archived`: hidden from active company switcher, but data preserved. Owner can restore. No new orders/invoices.
- `deleted`: soft delete (deletedAt). After 90d → hard delete or anonymize.

### Transitions

**active → archived** (owner action `/companies/:id/archive`):
- Blocked if there are unpaid invoices (must settle first).
- Cancel scheduled cron jobs related to company (recurring billing, reminders).
- No notifications about new events go out.
- Other members lose access to switch into this company.
- Owner can still see in `/companies?include=archived`.

**archived → active** (owner action):
- Restore all access; resume cron jobs.

**any → deleted** (owner only, with 2FA confirmation):
- Set deletedAt.
- Cascade soft-delete: orders, invoices marked deletedAt too.
- Telegram-channel cleanup: send notification "company.deleted" to all members.
- After 90d, cron `C18:retention_purge` checks deletedAt+90d → hard delete or anonymize.

### Edge cases
- **Transfer ownership** (from owner A → owner B):
  - Both A and B must be CompanyMember of the company.
  - B must accept via /companies/:id/accept-ownership endpoint (cannot be unilateral by A).
  - On accept: A's role changes to 'member', B's role to 'owner'.
  - Audit log entry: `company.transfer_ownership` with both ids.
  - Notification "system.company_member_added" to all members.
- **Delete last owner**: blocked. Must transfer first (cycle prevention).
- **Member has active timer on a company order, company gets archived**: timer auto-stops with reason='company_archived'.

---

## 3. Order

### States
- 9 internal: new / clarification / estimating / in_progress / review / revision / done / cancelled / on_hold.
- 4 client-facing: in_progress / pending_approval / completed / cancelled.
- Soft-delete via deletedAt.

### Transitions

**Owner-only:**
- review → done (final approval).
- done → revision (re-open for fixes within 30d of done).
- any → cancelled (with reason).
- any → on_hold (with reason + expected resume date).

**Executor:**
- new → clarification (need more info from client).
- estimating → in_progress (after client approves estimate).
- in_progress → review (work submitted).
- revision → in_progress (continuing work).

**Client (via portal):**
- new → cancelled (within 1h of creation, before any work done).

### Edge cases
- **Order with active timer**: cannot transition to done/cancelled without stopping timer (UI guard + API validation).
- **Order with unpaid advance invoice**: cannot transition new→in_progress; payment required first.
- **Order soft-deleted** (deletedAt set): excluded from all views; only owner can restore within 30d via `/orders/:id/restore`. After 30d, cron purges related files + comments + time logs.

---

## 4. Invoice / Payment

### Invoice states
- `draft`: editable, not sent.
- `generated`: PDF created, not yet sent.
- `sent`: email/Telegram sent to client.

### Payment states (via ServiceCharge)
- `pending`: invoice issued, awaiting payment.
- `paid`: confirmed (manual or auto via bank webhook).
- `overdue`: past dueDate without payment; auto-set by cron C07.

### Edge cases
- **Race condition on payment confirm**: protected by `UNIQUE(sourceType, sourceId)` on Payment + `SELECT FOR UPDATE` on ServiceCharge inside Serializable transaction. Duplicate confirmation returns 409.
- **Partial payment**: allowed (PaymentType=partial); charge stays `pending` until cumulative = total. Audit log records each partial.
- **Refund**: creates Payment with amount=negative + type=refund + reference to original Payment. Charge status → `pending` if refund makes outstanding > 0 again.
- **Invoice for archived company**: cannot create new invoices; existing ones still pay-able.

---

## 5. Credentials Vault

### States
- `active`: in use.
- `revoked`: marked obsolete; not shown in default list view (filter `?include=revoked`).

### Transitions
- active → revoked (owner only): UI shows "Mark as revoked" button.
- revoked → deleted (after 90d auto-purge via cron C18, or manual delete by owner with confirmation).

### Edge cases
- **DEK rotation**: when KEK is rotated (admin emergency procedure), all DEKs are re-encrypted with new KEK in single transaction. Audit log entry.
- **Owner transfers company**: credentials are tied to companyId, not ownerId — new owner gains access automatically. Audit log records the transfer.
- **Reveal action**: each reveal is logged to AuditLog with actor + timestamp. Owner can review reveal history at `/companies/:id/credentials/:credId/audit`.

---

## 6. Invite

### States
- `pending`: created, not yet used.
- `accepted`: usedAt set; cannot be reused.
- `expired`: expiresAt < now AND usedAt null.
- `cancelled` (synthetic): inviter manually cancelled before acceptance.

### Edge cases
- **Same email invited twice**: second invite replaces first (mark first as `cancelled`, new one is `pending`). Avoids duplicate accept.
- **Invite expires while user is on accept page**: validation at submit time returns 410 Gone. UI shows "ask inviter for new invite".
- **Inviter is deactivated**: pending invites are not auto-cancelled — recipient can still accept (they joined the company, not the person).

---

## 7. Internal task

### States
- `todo`, `in_progress`, `done` (3 only; simpler than client orders).

### Billing mode (separate from state):
- `client_paid`: bundled into client invoice.
- `internal_paid`: covered by company budget.
- `unpaid`: tracked but not invoiced.

### Edge cases
- **Convert internal task → client order**: copies title/description/timeLogs, creates new Order with type=client_order, marks internal task as done with metadata.linkedOrderId. Audit log.
- **Time tracked on internal task**: included in executor's monthly time report; billable hours computed per billingMode.

---

> **Source of truth для статусів:** `packages/types/src/enums.ts` + INTERNAL_TO_CLIENT_STATUS у `constants.ts`. Цей доc описує **поведінку при переходах**; самі значення — там.
