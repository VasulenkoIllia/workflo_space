import { z } from 'zod'
import { OrderInternalStatus, OrderPriority, OrderType } from '../enums.js'

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
