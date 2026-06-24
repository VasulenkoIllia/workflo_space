import { z } from 'zod'

/**
 * Agency legal entities (20-Д, LEGAL_ENTITY_SPEC). An agency issues invoices/acts
 * and signs contracts from a specific entity (ФОП/ТОВ). N per agency, ≥1 default.
 */

/**
 * Fields required for an entity to be document-ready (Юр-2 gate). When all are
 * present, generation of invoices/acts is unblocked for projects using it.
 * Canon for both the API recompute and provisioning.
 */
export const LEGAL_ENTITY_REQUIRED_FIELDS = ['legalName', 'taxId', 'iban', 'signerName'] as const

/** Whether the minimum document fields are filled (Юр-2). Pure — no DB. */
export function legalEntityIsComplete(e: {
  legalName?: string | null
  taxId?: string | null
  iban?: string | null
  signerName?: string | null
}): boolean {
  return LEGAL_ENTITY_REQUIRED_FIELDS.every((f) => {
    const v = e[f]
    return typeof v === 'string' && v.trim().length > 0
  })
}

const taxId = z.string().trim().min(2).max(20)
const iban = z.string().trim().min(5).max(34)
const shortText = z.string().trim().min(1).max(200)

/** POST /workspace/legal-entities — create an agency legal entity. */
export const createLegalEntitySchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalType: z.string().trim().min(2).max(40), // 'fop' | 'tov' | 'individual' | 'foreign' (free — П8)
  legalName: z.string().trim().min(2).max(300),
  // nullish (not optional): a cleared optional field sends `null` from the form —
  // matches every sibling here, vatId (same base), and updateLegalEntitySchema.taxId.
  taxId: taxId.nullish(),
  vatPayer: z.boolean().default(false),
  vatId: taxId.nullish(),
  legalAddress: z.string().trim().max(500).nullish(),
  bankName: z.string().trim().max(200).nullish(),
  iban: iban.nullish(),
  signerName: shortText.nullish(),
  signerTitle: z.string().trim().max(100).nullish(),
  stampUrl: z.string().trim().max(500).nullish(),
})
export type CreateLegalEntityInput = z.infer<typeof createLegalEntitySchema>

/** PATCH /workspace/legal-entities/:id — partial update. Default toggle is a separate route. */
export const updateLegalEntitySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    legalType: z.string().trim().min(2).max(40).optional(),
    legalName: z.string().trim().min(2).max(300).optional(),
    taxId: taxId.nullish(),
    vatPayer: z.boolean().optional(),
    vatId: taxId.nullish(),
    legalAddress: z.string().trim().max(500).nullish(),
    bankName: z.string().trim().max(200).nullish(),
    iban: iban.nullish(),
    signerName: shortText.nullish(),
    signerTitle: z.string().trim().max(100).nullish(),
    stampUrl: z.string().trim().max(500).nullish(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateLegalEntityInput = z.infer<typeof updateLegalEntitySchema>
