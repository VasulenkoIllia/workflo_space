import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, walletTxnQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'

export interface WalletTxnRow {
  id: string
  type: string
  source: string
  amount: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  currency: string
  sourceId: string | null
  note: string | null
  createdAt: Date
}

export const WALLET_TXN_SELECT = {
  id: true,
  type: true,
  source: true,
  amount: true,
  balanceAfter: true,
  currency: true,
  sourceId: true,
  note: true,
  createdAt: true,
} satisfies Prisma.WalletTransactionSelect

export function walletTxnDto(t: WalletTxnRow) {
  return {
    id: t.id,
    type: t.type,
    source: t.source,
    amount: t.amount.toFixed(2),
    balanceAfter: t.balanceAfter.toFixed(2),
    currency: t.currency,
    sourceId: t.sourceId,
    note: t.note,
    createdAt: t.createdAt,
  }
}

/**
 * Client-facing bonus wallet (module 25). `/portal/wallet` is the balance;
 * `/portal/wallet/transactions` is the paginated ledger. Both pinned to the
 * caller's active company and gated by `billing.view`.
 */
const portalWalletRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/portal/wallet', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user
    const agencyId = requireActiveAgency(user)
    const companyId = user.activeCompanyId
    if (!companyId) {
      throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
    }
    if (!can(user, 'billing.view', { agencyId, companyId })) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до гаманця', 403)
    }

    const company = await withTenant((tx) =>
      tx.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          agencyId: true,
          bonusBalance: true,
          moneyBalance: true,
          currency: true,
        },
      })
    )
    if (!company || company.agencyId !== agencyId) {
      throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
    }

    return reply.send({
      success: true,
      data: {
        bonusBalance: company.bonusBalance.toFixed(2),
        moneyBalance: company.moneyBalance.toFixed(2),
        currency: company.currency,
      },
    })
  })

  fastify.get(
    '/portal/wallet/transactions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = walletTxnQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до гаманця', 403)
      }

      const where: Prisma.WalletTransactionWhereInput = {
        agencyId,
        companyId,
        ...(query.type ? { type: query.type } : {}),
      }
      const { rows, total } = await withTenant(async (tx) => {
        const [rows, total] = await Promise.all([
          tx.walletTransaction.findMany({
            where,
            select: WALLET_TXN_SELECT,
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          tx.walletTransaction.count({ where }),
        ])
        return { rows, total }
      })

      return reply.send({
        success: true,
        data: {
          transactions: rows.map(walletTxnDto),
          pagination: { page: query.page, limit: query.limit, total },
        },
      })
    }
  )

  return Promise.resolve()
}

export default portalWalletRoute
