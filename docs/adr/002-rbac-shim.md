# ADR-002: RBAC Shim для MVP

**Статус:** Прийнято
**Дата:** 17 квітня 2026
**Контекст:** S1 auth — потрібен прагматичний спосіб робити authz перевірки без повноцінного RBAC.

---

## Контекст

На MVP-фазі ролей мало і вони фіксовані:

- `client` — користувач, який зробив замовлення (profile + 1+ companies, де він owner).
- `owner` — owner компанії (CompanyMember.role='owner').
- `member` — інший член компанії (manager / accountant / viewer — поки що однакові права).
- `executor` — виконавець у Workspace (внутрішній).

Повноцінний RBAC (permissions, policies, attribute-based) описаний у task #24 і відкладений до post all-modules-stable.

Але вже зараз треба:

- захищати endpoints — `requireOwner`, `requireMember`,
- мати uniform API — щоб коли з'явиться RBAC, замінити одну функцію (а не 100+ guards у кожному маршруті),
- логувати denied actions для audit log.

## Розглянуті варіанти

### A. Inline if-statements у кожному handler

```typescript
if (req.user.role !== 'owner') return reply.code(403).send(...);
```

- **Pro:** просто, нуль абстракції.
- **Contra:** копіпаст у 100+ handlers; коли з'явиться RBAC — refactor пекло.

### B. Fastify decorators `requireOwner`, `requireMember`

```typescript
fastify.post('/orders', { preHandler: fastify.requireOwner }, handler)
```

- **Pro:** DRY, легко переключити одну декорацію.
- **Contra:** обмежено перевірками на entry-point рівні, не працює для action-based перевірок усередині service layer.

### C. `can(user, action, resource)` shim ✅

```typescript
if (!can(req.user, 'order.create', { companyId })) {
  return reply.code(403).send({ error: 'forbidden' })
}
```

- **Pro:**
  - uniform API — usable у будь-якому шарі (handler, service, helper),
  - готовий signature для майбутнього RBAC (просто заміна реалізації),
  - centralized — всі правила в одному файлі `auth/can.ts`,
  - тестується ізольовано.
- **Contra:** трохи більше boilerplate для простих кейсів (потрібно описати action у enum).

## Рішення

Обрано варіант **C** з cyhh-обмеженим набором actions для MVP.

## Базова реалізація

```typescript
// packages/api/src/auth/can.ts

export type Action =
  | 'order.create'
  | 'order.update'
  | 'order.delete'
  | 'order.transition_status'
  | 'order.assign_executor'
  | 'invoice.create'
  | 'invoice.send'
  | 'invoice.cancel'
  | 'payment.confirm'
  | 'company.update_settings'
  | 'company.transfer_ownership'
  | 'company.invite_member'
  | 'company.remove_member'
  | 'executor.invite'
  | 'executor.deactivate'
  | 'credentials.read'
  | 'credentials.update'
  | 'admin.access'

export interface AuthContext {
  userId: string
  email: string
  role: 'client' | 'owner' | 'member' | 'executor'
  companyId?: string // активна компанія
  memberships: Array<{ companyId: string; role: 'owner' | 'manager' | 'accountant' | 'viewer' }>
}

export interface ResourceContext {
  companyId?: string
  ownerId?: string
  executorId?: string
}

export function can(user: AuthContext, action: Action, resource: ResourceContext = {}): boolean {
  // MVP rules: всі owner-actions потребують owner role у відповідній company

  if (action.startsWith('admin.')) {
    return user.role === 'executor' && user.email === ADMIN_EMAIL // hardcoded поки що
  }

  if (action === 'company.transfer_ownership') {
    const m = user.memberships.find((m) => m.companyId === resource.companyId)
    return m?.role === 'owner'
  }

  if (action === 'credentials.read' || action === 'credentials.update') {
    // Тільки owner компанії (виконавці credentials не бачать!)
    const m = user.memberships.find((m) => m.companyId === resource.companyId)
    return m?.role === 'owner'
  }

  if (
    action.startsWith('order.') ||
    action.startsWith('invoice.') ||
    action.startsWith('payment.')
  ) {
    // owner або executor мають доступ; client має доступ тільки до своєї компанії
    if (user.role === 'executor') return true
    const m = user.memberships.find((m) => m.companyId === resource.companyId)
    return !!m
  }

  return false // default deny
}
```

## Використання

```typescript
// у handler
if (!can(req.user, 'order.create', { companyId })) {
  await auditDeny(req.user, 'order.create', { companyId })
  return reply.code(403).send({ error: 'forbidden' })
}

// у service layer
export async function transitionOrderStatus(
  actor: AuthContext,
  orderId: string,
  next: OrderInternalStatus
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new NotFoundError('order')
  if (!can(actor, 'order.transition_status', { companyId: order.companyId })) {
    throw new ForbiddenError('cannot transition this order')
  }
  // ... transition logic
}
```

## Audit Log

Кожен `can() === false` має логуватись у `audit_log`:

```typescript
async function auditDeny(user: AuthContext, action: Action, resource: ResourceContext) {
  await prisma.auditLog.create({
    data: {
      actorId: user.userId,
      action,
      resourceType: resource.companyId ? 'company' : 'system',
      resourceId: resource.companyId ?? null,
      result: 'denied',
      metadata: { role: user.role, resource },
    },
  })
}
```

## Майбутній RBAC (task #24)

Коли буде впроваджено повноцінний RBAC:

```typescript
// Future API залишається той самий:
can(user, 'order.create', { companyId })

// Тільки внутрішня реалізація змінюється:
export function can(user: AuthContext, action: Action, resource: ResourceContext): boolean {
  const policies = loadPoliciesForRole(user.role)
  return evaluatePolicies(policies, user, action, resource)
}
```

Всі handlers, services залишаються незмінними — заміна тільки `auth/can.ts`.

## Наслідки

- **Centralization:** всі authz правила в одному файлі (легко audit).
- **Forward compatibility:** API готовий до RBAC drop-in.
- **Audit-ready:** кожен deny логується.
- **MVP velocity:** проста реалізація для < 10 actions.

## Перегляд

Переглянути коли:

- з'явиться > 30 distinct actions (стає важко тримати в одному файлі),
- з'являться custom roles per company,
- буде task #24 (повний RBAC).

---

## Amendment (1.06.2026) — приведено у відповідність до коду

Реальний `can()` (`apps/api/src/auth/can.ts`) розійшовся зі старим текстом ADR; фіксую канон:

- **«Команда vs клієнт» = `isInternalTeam(user)`** (= є `AgencyMember`, executor **АБО** owner; `auth/tokens.ts`), а НЕ `Profile.role === 'executor'`. Старий чек блокував власника агенції від командних дій (аудит C-2/SEC-D5 — виправлено 1.06). `Profile.role` — лише UI-хінт.
- **Platform admin** = `isInternalTeam(user) && email === ADMIN_EMAIL` (не `role === 'executor'`).
- **Company-ролі** — лише `owner | member`. Permissions — canonical **snake_case** (`tokens.ts`/`CompanyPermissions`), не camelCase з 13-settings.
- **Tenant-guard** у кожному правилі (default-deny крос-тенант) — доповнює `assertSameTenant` (ADR-004).
- Відомий борг (BACKLOG M-D1): `deleteOrder`/`assignOrder` поки обходять `can()` (пряма перевірка) — провести через `can('order.delete'/'order.assign')`.
