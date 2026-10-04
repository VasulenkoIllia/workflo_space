import { z } from 'zod'

/** POST /orders/:id/time-logs — a manual time entry (workspace-only). */
export const createTimeLogSchema = z.object({
  hours: z.number().positive().max(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  comment: z.string().max(2000).optional(),
})

/** PATCH /orders/:id/time-logs/:logId — partial edit of an entry. */
export const updateTimeLogSchema = z
  .object({
    hours: z.number().positive().max(24).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
      .optional(),
    comment: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Потрібно вказати хоча б одне поле для оновлення',
  })
