import { z } from 'zod'

/**
 * Client legal requisites (06-Б, P-3) — the document "to" party a client registers in
 * Portal so the agency can issue invoices/acts to them. Mirrors the agency-side
 * `LegalEntity` (20-Д), but lives flat on `Company` (one set per client; multi-entity
 * is out of scope). The contract-gate that blocks generation is P-7, not here.
 */

/**
 * Fields required for a client to be document-ready (Юр-2 analog). When all are present,
 * S6 invoice/act generation to this client is unblocked. Canon for the API recompute.
 */
export const CLIENT_REQUISITES_REQUIRED_FIELDS = [
  'legalName',
  'taxId',
  'iban',
  'signerName',
] as const

/** Whether the minimum client document fields are filled. Pure — no DB. */
export function clientRequisitesIsComplete(c: {
  legalName?: string | null
  taxId?: string | null
  iban?: string | null
  signerName?: string | null
}): boolean {
  return CLIENT_REQUISITES_REQUIRED_FIELDS.every((f) => {
    const v = c[f]
    return typeof v === 'string' && v.trim().length > 0
  })
}

const taxId = z.string().trim().min(2).max(20)
const iban = z.string().trim().min(5).max(34)
const email = z.string().trim().email().max(320)

/**
 * PATCH `/portal/company/requisites` (client) — partial update of a client's own legal
 * requisites + document email(s). At least one field required. `legalIsComplete` is
 * recomputed server-side from the merged result.
 */
export const updateClientRequisitesSchema = z
  .object({
    legalType: z.string().trim().min(2).max(40).nullish(),
    legalName: z.string().trim().min(2).max(300).nullish(),
    taxId: taxId.nullish(),
    vatPayer: z.boolean().optional(),
    vatId: taxId.nullish(),
    legalAddress: z.string().trim().max(500).nullish(),
    bankName: z.string().trim().max(200).nullish(),
    iban: iban.nullish(),
    signerName: z.string().trim().min(1).max(200).nullish(),
    signerTitle: z.string().trim().max(100).nullish(),
    documentEmail: email.nullish(),
    documentEmailCc: email.nullish(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateClientRequisitesInput = z.infer<typeof updateClientRequisitesSchema>
