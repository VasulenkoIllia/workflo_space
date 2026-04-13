import { z } from 'zod'
import { OrderPriority, OrderType } from '../enums.js'

export const createOrderSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.nativeEnum(OrderType),
  priority: z.nativeEnum(OrderPriority),
  dueDate: z.string().datetime().optional(),
})
