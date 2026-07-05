import { z } from 'zod'
import {
  ApprovalMode,
  BillingType,
  InternalTaskStatus,
  OrderInternalStatus,
  OrderPriority,
  OrderType,
} from '../enums.js'

const dueDateSchema = z
  .string()
  .datetime()
  .refine((value) => new Date(value).getTime() > Date.now(), 'dueDate must be in the future')

const orderStageInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
})

export const createOrderSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(10_000).optional(),
  type: z.nativeEnum(OrderType).default(OrderType.CLIENT_ORDER),
  priority: z.nativeEnum(OrderPriority).default(OrderPriority.MEDIUM),
  dueDate: dueDateSchema.optional(),
  stages: z.array(orderStageInputSchema).max(20).optional(),
})

/**
 * POST /workspace/orders (P-7) — the internal team creates a task FOR a chosen client,
 * without a client request. `companyId` is explicit (not the session). `zeroBilled` is
 * the team's call (included in a subscription vs billable). The client sees it in their
 * portal order list (filtered by company, not type). Defaults to `internal_task`.
 */
export const createWorkspaceOrderSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(3).max(255),
  description: z.string().max(10_000).optional(),
  type: z.nativeEnum(OrderType).default(OrderType.INTERNAL_TASK),
  priority: z.nativeEnum(OrderPriority).default(OrderPriority.MEDIUM),
  projectId: z.string().uuid().nullish(),
  zeroBilled: z.boolean().default(false),
  dueDate: dueDateSchema.optional(),
  // 02-А (legacy): explicit on/off override; when omitted, resolved from the cascade.
  requiresApproval: z.boolean().optional(),
  // P-11: explicit cost-approval mode override (none/upfront/on_actuals); wins over the cascade.
  approvalMode: z.nativeEnum(ApprovalMode).optional(),
})
export type CreateWorkspaceOrderInput = z.infer<typeof createWorkspaceOrderSchema>

/** GET /orders query — comma-separated status/priority, pagination, sort. */
export const listOrdersQuerySchema = z.object({
  status: z.string().max(200).optional(),
  priority: z.string().max(100).optional(),
  companyId: z.string().uuid().optional(),
  assigneeId: z.string().optional(), // uuid, or 'none' for unassigned (workspace)
  search: z.string().max(200).optional(),
  // S10-01: CSV tag-ids фільтр (workspace)
  tags: z.string().max(500).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

/** PATCH /orders/:id/status — target internal status (checked vs ALLOWED_ORDER_TRANSITIONS). */
export const transitionOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderInternalStatus),
  comment: z.string().max(2000).optional(),
})

/**
 * PATCH /orders/:id — edit fields. Clients may set only title/description/
 * priority/dueDate (and only while the order is `new`); the billing fields are
 * internal-team only. Enforced in the handler.
 */
export const updateOrderSchema = z
  .object({
    title: z.string().min(3).max(255).optional(),
    description: z.string().max(10_000).nullable().optional(),
    priority: z.nativeEnum(OrderPriority).optional(),
    dueDate: dueDateSchema.nullable().optional(),
    billingType: z.nativeEnum(BillingType).optional(),
    fixedPrice: z.number().nonnegative().nullable().optional(),
    hourlyRate: z.number().nonnegative().nullable().optional(),
    estimatedHours: z.number().nonnegative().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Потрібно вказати хоча б одне поле для оновлення',
  })

/**
 * POST /workspace/orders/:id/submit-approval (02-А) — the team submits the estimate for the
 * client to approve. Optional note shown to the client alongside the estimate block.
 */
export const submitOrderApprovalSchema = z.object({
  note: z.string().max(2000).optional(),
})

/**
 * POST /portal/orders/:id/approval (02-А) — the client (company owner) decides on the
 * estimate. Rejection MUST carry a reason; approval may carry an optional note.
 */
export const decideOrderApprovalSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    comment: z.string().max(2000).optional(),
    // P-11 counter-offer (upfront): approve the estimate at a LOWER agreed sum than quoted.
    approvedAmount: z
      .number()
      .finite()
      .positive()
      .max(1_000_000_000)
      .refine((v) => Number(v.toFixed(2)) === v, 'Сума: ≤2 десяткових знаки')
      .optional(),
  })
  .refine((d) => d.decision !== 'reject' || (d.comment != null && d.comment.trim().length > 0), {
    message: 'Вкажіть причину відхилення',
    path: ['comment'],
  })
  .refine((d) => d.decision !== 'reject' || d.approvedAmount == null, {
    message: 'approvedAmount застосовний лише при погодженні',
    path: ['approvedAmount'],
  })
export type DecideOrderApprovalInput = z.infer<typeof decideOrderApprovalSchema>

/**
 * POST /workspace|portal/billing/charges/:id/approval (P-11, on_actuals) — release or refuse
 * a draft charge. `approvedAmount` is the optional counter-offer: approve at a LOWER figure
 * than billed (the difference is recorded as a concession). Rejection MUST carry a reason.
 */
export const decideChargeApprovalSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    comment: z.string().max(2000).optional(),
    approvedAmount: z
      .number()
      .finite()
      .positive()
      .max(1_000_000_000)
      .refine((v) => Number(v.toFixed(2)) === v, 'Сума: ≤2 десяткових знаки')
      .optional(),
  })
  .refine((d) => d.decision !== 'reject' || (d.comment != null && d.comment.trim().length > 0), {
    message: 'Вкажіть причину відхилення',
    path: ['comment'],
  })
  .refine((d) => d.decision !== 'reject' || d.approvedAmount == null, {
    message: 'approvedAmount застосовний лише при погодженні',
    path: ['approvedAmount'],
  })
export type DecideChargeApprovalInput = z.infer<typeof decideChargeApprovalSchema>

/** PATCH /orders/:id/assign — assign an executor (null = unassign). */
export const assignOrderSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
})

/** POST /orders/:orderId/tasks — workspace-only internal subtask. */
export const createInternalTaskSchema = z.object({
  title: z.string().min(1).max(255),
  assigneeId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
})

/** PATCH /orders/:orderId/tasks/:taskId — partial update. */
export const updateInternalTaskSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    status: z.nativeEnum(InternalTaskStatus).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Потрібно вказати хоча б одне поле для оновлення',
  })
