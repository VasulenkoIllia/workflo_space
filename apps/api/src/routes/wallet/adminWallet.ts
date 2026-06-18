import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  WalletTxnSource,
  WalletTxnType,
  walletAdjustSchema,
  walletCompaniesQuerySchema,
  walletTxnQuerySchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant, isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { walletCredit, walletDebit } from '../../services/wallet.js'
import { WALLET_TXN_SELECT, walletTxnDto } from './portalWallet.js'

/**
 * Agency-side bonus-wallet management (module 25). Reads are open to the internal
 * team; the manual adjustment (which moves money-equivalent) is owner-only and
 * always audited. The `/admin/` prefix is the route name — authz is per-agency,
 * NOT the platform super-admin.
 */
const adminWalletRoute: FastifyPluginAsync = (fastify) => {
  // ── Company balances (searchable) ───────────────────────────────────────────
  fastify.get(
    '/admin/wallet/companies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = walletCompaniesQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const where: Prisma.CompanyWhereInput = {
        agencyId,
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      }
      const { rows, total } = await withTenant(async (tx) => {
        const [rows, total] = await Promise.all([
          tx.company.findMany({
            where,
            select: {
              id: true,
              name: true,
              bonusBalance: true,
              moneyBalance: true,
              currency: true,
            },
            orderBy: { name: 'asc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          tx.company.count({ where }),
        ])
        return { rows, total }
      })

      return reply.send({
        success: true,
        data: {
          companies: rows.map((c) => ({
            id: c.id,
            name: c.name,
            bonusBalance: c.bonusBalance.toFixed(2),
            moneyBalance: c.moneyBalance.toFixed(2),
            currency: c.currency,
          })),
          pagination: { page: query.page, limit: query.limit, total },
        },
      })
    }
  )

  // ── A company's ledger ──────────────────────────────────────────────────────
  fastify.get<{ Params: { companyId: string } }>(
    '/admin/wallet/companies/:companyId/transactions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = walletTxnQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const where: Prisma.WalletTransactionWhereInput = {
        agencyId,
        companyId: request.params.companyId,
        ...(query.type ? { type: query.type } : {}),
      }
      const { company, rows, total } = await withTenant(async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: request.params.companyId },
          select: { id: true, agencyId: true },
        })
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
        return { company, rows, total }
      })
      if (!company) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }
      assertSameTenant(user, company.agencyId)

      return reply.send({
        success: true,
        data: {
          transactions: rows.map(walletTxnDto),
          pagination: { page: query.page, limit: query.limit, total },
        },
      })
    }
  )

  // ── Manual adjustment (owner-only, audited) ─────────────────────────────────
  fastify.post<{ Params: { companyId: string } }>(
    '/admin/wallet/companies/:companyId/adjust',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = walletAdjustSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може коригувати бонуси',
          403
        )
      }

      const txn = await tenantTransaction(prisma, (tx) => {
        const args = {
          agencyId,
          companyId: request.params.companyId,
          source: WalletTxnSource.MANUAL_ADJUSTMENT,
          amount: input.amount,
          note: input.note,
          createdById: user.sub,
        }
        return input.type === WalletTxnType.CREDIT ? walletCredit(tx, args) : walletDebit(tx, args)
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'wallet.adjusted',
        resourceType: 'wallet_transaction',
        resourceId: txn.id,
        result: 'allowed',
        metadata: {
          companyId: request.params.companyId,
          type: input.type,
          amount: input.amount,
          note: input.note,
        },
      })

      return reply.status(201).send({ success: true, data: { transaction: txn } })
    }
  )

  return Promise.resolve()
}

export default adminWalletRoute
