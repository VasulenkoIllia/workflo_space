import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, LoyaltyTier } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { resolveBroadcastRecipients } from '../../services/broadcast.js'
import { enqueueOutbox } from '../../services/outbox.js'

/**
 * S12-07 BULK-РОЗСИЛКИ (owner-only): лист сегменту клієнтів. Флоу: чернетка →
 * preview (скільки отримають) → send (атомарний claim draft→sending + outbox
 * `broadcast.send`; доставку робить воркер через notify-матрицю — вимкнений
 * system-email клієнта поважається). Правка/видалення — лише чернетки.
 */

const segmentSchema = z.enum(['all', 'debtors', 'tier'])
const bodySchema = z
  .object({
    subject: z.string().trim().min(3).max(150),
    body: z.string().trim().min(10).max(5000),
    segment: segmentSchema.default('all'),
    tier: z.nativeEnum(LoyaltyTier).nullish(),
  })
  .strict()
  .refine((d) => d.segment !== 'tier' || d.tier != null, {
    message: 'Для сегмента "tier" вкажіть loyalty-тір',
  })

const BROADCAST_SELECT = {
  id: true,
  subject: true,
  body: true,
  segment: true,
  tier: true,
  status: true,
  recipientCount: true,
  sentCount: true,
  sentAt: true,
  createdAt: true,
} as const

function assertOwner(
  user: { agencyMemberships: { agencyId: string; role: string }[] },
  agencyId: string
): void {
  if (!isAgencyOwner(user as never, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Розсилки — лише власник агенції', 403)
  }
}

const broadcastsRoute: FastifyPluginAsync = (fastify) => {
  // ── Список ────────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/broadcasts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      assertOwner(request.user, agencyId)
      const broadcasts = await withTenant((tx) =>
        tx.broadcast.findMany({
          where: { agencyId },
          orderBy: { createdAt: 'desc' },
          select: BROADCAST_SELECT,
          take: 100,
        })
      )
      return reply.send({ success: true, data: { broadcasts } })
    }
  )

  // ── Створити чернетку ─────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/broadcasts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      assertOwner(request.user, agencyId)
      const input = bodySchema.parse(request.body)
      const broadcast = await withTenant((tx) =>
        tx.broadcast.create({
          data: {
            agencyId,
            subject: input.subject,
            body: input.body,
            segment: input.segment,
            tier: input.segment === 'tier' ? input.tier : null,
            createdById: request.user.sub,
          },
          select: BROADCAST_SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'broadcast.created',
        resourceType: 'broadcast',
        resourceId: broadcast.id,
        result: 'allowed',
        metadata: { segment: input.segment },
      })
      return reply.status(201).send({ success: true, data: { broadcast } })
    }
  )

  // ── Правка чернетки ───────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/broadcasts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      assertOwner(request.user, agencyId)
      const input = bodySchema.parse(request.body)
      const updated = await withTenant((tx) =>
        tx.broadcast.updateMany({
          where: { id: request.params.id, agencyId, status: 'draft' },
          data: {
            subject: input.subject,
            body: input.body,
            segment: input.segment,
            tier: input.segment === 'tier' ? input.tier : null,
          },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Чернетку не знайдено (або вже надіслано)', 404)
      }
      const broadcast = await withTenant((tx) =>
        tx.broadcast.findFirst({
          where: { id: request.params.id, agencyId },
          select: BROADCAST_SELECT,
        })
      )
      return reply.send({ success: true, data: { broadcast } })
    }
  )

  // ── Видалити чернетку ─────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/broadcasts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      assertOwner(request.user, agencyId)
      const removed = await withTenant((tx) =>
        tx.broadcast.deleteMany({ where: { id: request.params.id, agencyId, status: 'draft' } })
      )
      if (removed.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Чернетку не знайдено (або вже надіслано)', 404)
      }
      return reply.send({ success: true, data: { deleted: true } })
    }
  )

  // ── Preview: скільки клієнтів отримають ───────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/broadcasts/:id/preview',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      assertOwner(request.user, agencyId)
      const b = await withTenant((tx) =>
        tx.broadcast.findFirst({
          where: { id: request.params.id, agencyId },
          select: { segment: true, tier: true },
        })
      )
      if (!b) throw new AppError(ApiErrorCode.NOT_FOUND, 'Розсилку не знайдено', 404)
      const ids = await withTenant((tx) =>
        resolveBroadcastRecipients(tx, agencyId, b.segment, b.tier)
      )
      return reply.send({ success: true, data: { recipientCount: ids.length } })
    }
  )

  // ── Надіслати (draft → sending → воркер) ──────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/broadcasts/:id/send',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      assertOwner(request.user, agencyId)
      const broadcast = await tenantTransaction(prisma, async (tx) => {
        // Атомарний claim: подвійний клік/двоє власників → рівно один send
        const claim = await tx.broadcast.updateMany({
          where: { id: request.params.id, agencyId, status: 'draft' },
          data: { status: 'sending' },
        })
        if (claim.count === 0) {
          const exists = await tx.broadcast.findFirst({
            where: { id: request.params.id, agencyId },
            select: { id: true },
          })
          if (!exists) throw new AppError(ApiErrorCode.NOT_FOUND, 'Розсилку не знайдено', 404)
          throw new AppError(ApiErrorCode.CONFLICT, 'Розсилку вже надіслано', 409)
        }
        await enqueueOutbox(tx, {
          type: 'broadcast.send',
          payload: { broadcastId: request.params.id, actorId: request.user.sub },
          agencyId,
        })
        return tx.broadcast.findFirstOrThrow({
          where: { id: request.params.id },
          select: BROADCAST_SELECT,
        })
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'broadcast.sent',
        resourceType: 'broadcast',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { segment: broadcast.segment },
      })
      return reply.send({ success: true, data: { broadcast } })
    }
  )

  return Promise.resolve()
}

export default broadcastsRoute
