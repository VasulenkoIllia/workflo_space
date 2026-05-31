import { z } from 'zod'
import {
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

/** GET /orders query — comma-separated status/priority, pagination, sort. */
export const listOrdersQuerySchema = z.object({
  status: z.string().max(200).optional(),
  priority: z.string().max(100).optional(),
  companyId: z.string().uuid().optional(),
  assigneeId: z.string().optional(), // uuid, or 'none' for unassigned (workspace)
  search: z.string().max(200).optional(),
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
