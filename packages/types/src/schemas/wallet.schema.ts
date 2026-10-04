import { z } from 'zod'
import { WalletTxnType } from '../enums.js'
import { moneyAmount } from './billing.schema.js'

/**
 * POST /admin/wallet/companies/:companyId/adjust — a manual bonus credit/debit.
 * `note` is mandatory: a hand-made balance change must always carry a reason
 * (audit + the wallet invariant that manual adjustments are explained).
 */
export const walletAdjustSchema = z
  .object({
    type: z.nativeEnum(WalletTxnType),
    amount: moneyAmount,
    note: z.string().min(1, 'Потрібна причина коригування').max(1000),
  })
  .strict()
export type WalletAdjustInput = z.infer<typeof walletAdjustSchema>

/** GET /…/wallet/transactions — paginated ledger, optional direction filter. */
export const walletTxnQuerySchema = z.object({
  type: z.nativeEnum(WalletTxnType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type WalletTxnQuery = z.infer<typeof walletTxnQuerySchema>

/** GET /admin/wallet/companies — searchable, paginated company balances. */
export const walletCompaniesQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type WalletCompaniesQuery = z.infer<typeof walletCompaniesQuerySchema>

/**
 * POST /portal/invoices/:chargeId/pay-with-bonus (S5-08). Omit `amount` to apply
 * as much bonus as possible (min of the charge's outstanding and the bonus balance);
 * pass an explicit `amount` to cap it. The service clamps to that minimum either way.
 */
export const payWithBonusSchema = z.object({ amount: moneyAmount.optional() }).strict()
export type PayWithBonusInput = z.infer<typeof payWithBonusSchema>

/** GET /…/wallet/statement — inclusive `YYYY-MM-DD` date-range filter for the timeline. */
const isoDate = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Expected YYYY-MM-DD')
export const statementQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
})
export type StatementQuery = z.infer<typeof statementQuerySchema>
