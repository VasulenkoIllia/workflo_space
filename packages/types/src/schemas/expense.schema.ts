import { z } from 'zod'
import { ExpenseCategory, ExpenseFrequency, ExpenseType } from '../enums.js'

function hasTwoFractionDigits(value: number): boolean {
  return Math.round(value * 100) === value * 100
}
const money = z
  .number()
  .finite()
  .positive()
  .max(1_000_000_000)
  .refine(hasTwoFractionDigits, 'At most 2 decimal places')

const isoDate = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Expected YYYY-MM-DD')

/**
 * POST /workspace/expenses (S5-10). Operator-entered operating cost. `source` is
 * always `manual` (executor-rate salary is synthesized in P&L, never stored). A
 * `recurring` expense needs a `frequency`; `one_time` lands fully in its start month.
 */
export const createExpenseSchema = z
  .object({
    type: z.nativeEnum(ExpenseType),
    category: z.nativeEnum(ExpenseCategory),
    vendor: z.string().max(200).optional(),
    amount: money,
    currency: z.enum(['USD', 'UAH']).default('USD'),
    frequency: z.nativeEnum(ExpenseFrequency).optional(),
    startDate: isoDate,
    endDate: isoDate.optional(),
    executorId: z.string().uuid().optional(),
  })
  .strict()
  .refine((d) => d.type !== ExpenseType.RECURRING || d.frequency != null, {
    message: 'Регулярна витрата потребує частоти',
  })
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

/** PUT /workspace/expenses/:id — full editable surface (partial). */
export const updateExpenseSchema = z
  .object({
    category: z.nativeEnum(ExpenseCategory).optional(),
    vendor: z.string().max(200).nullish(),
    amount: money.optional(),
    currency: z.enum(['USD', 'UAH']).optional(),
    frequency: z.nativeEnum(ExpenseFrequency).nullish(),
    startDate: isoDate.optional(),
    endDate: isoDate.nullish(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>

/** GET /workspace/reports/pnl — inclusive `YYYY-MM-DD` window. */
export const pnlQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
})
export type PnlQuery = z.infer<typeof pnlQuerySchema>
