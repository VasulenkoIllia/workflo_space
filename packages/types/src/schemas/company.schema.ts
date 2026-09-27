import { z } from 'zod'

/**
 * CORE-FLOWS (D4): агенція сама заводить компанію-клієнта (раніше — лише самореєстрація
 * клієнта). Контакт запрошується окремим викликом `/workspace/clients/:id/members/invite`;
 * перший, хто прийме запрошення в компанію без власника, стає її власником.
 */
export const createClientCompanySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    language: z.enum(['uk', 'en']).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
export type CreateClientCompanyInput = z.infer<typeof createClientCompanySchema>

/** POST /workspace/leads/:id/convert — у наявну компанію АБО в нову (назва). */
export const convertLeadSchema = z
  .object({
    companyId: z.string().min(1).optional(),
    newCompanyName: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((d) => (d.companyId ? 1 : 0) + (d.newCompanyName ? 1 : 0) === 1, {
    message: 'Оберіть компанію або вкажіть назву нової',
  })
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>
