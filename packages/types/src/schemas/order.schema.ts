import { z } from 'zod'
import { OrderPriority, OrderType } from '../enums.js'

const dueDateSchema = z
  .string()
  .datetime()
  .refine((value) => new Date(value).getTime() > Date.now(), 'dueDate must be in the future')

export const createOrderSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.nativeEnum(OrderType),
  priority: z.nativeEnum(OrderPriority),
  dueDate: dueDateSchema.optional(),
})
