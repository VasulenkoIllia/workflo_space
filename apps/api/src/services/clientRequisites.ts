import type { Prisma } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  type UpdateClientRequisitesInput,
  clientRequisitesIsComplete,
} from '@workflo/types'

/**
 * Client legal requisites (06-Б, P-3) — the document "to" party. A partial update merges
 * over the current row and recomputes `legalIsComplete` (Юр-2 analog) from the MERGED
 * gate fields, so omitting a field keeps it and an explicit null clears it. Tenant-checked.
 */

export const REQUISITES_SELECT = {
  id: true,
  legalType: true,
  legalName: true,
  taxId: true,
  vatPayer: true,
  vatId: true,
  legalAddress: true,
  bankName: true,
  iban: true,
  signerName: true,
  signerTitle: true,
  documentEmail: true,
  documentEmailCc: true,
  legalIsComplete: true,
} satisfies Prisma.CompanySelect

export type RequisitesRow = Prisma.CompanyGetPayload<{ select: typeof REQUISITES_SELECT }>

export async function applyClientRequisites(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; companyId: string; input: UpdateClientRequisitesInput }
): Promise<RequisitesRow> {
  const existing = await tx.company.findUnique({
    where: { id: args.companyId },
    select: {
      id: true,
      agencyId: true,
      legalName: true,
      taxId: true,
      iban: true,
      signerName: true,
    },
  })
  if (!existing || existing.agencyId !== args.agencyId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
  }
  // Recompute the gate from the merged result: a key present in the input wins (incl. an
  // explicit null), an absent key keeps the stored value.
  const pick = <K extends 'legalName' | 'taxId' | 'iban' | 'signerName'>(k: K): string | null =>
    k in args.input ? (args.input[k] ?? null) : existing[k]
  const legalIsComplete = clientRequisitesIsComplete({
    legalName: pick('legalName'),
    taxId: pick('taxId'),
    iban: pick('iban'),
    signerName: pick('signerName'),
  })
  return tx.company.update({
    where: { id: existing.id },
    data: { ...args.input, legalIsComplete },
    select: REQUISITES_SELECT,
  })
}
