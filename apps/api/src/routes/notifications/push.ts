import { prisma } from '@workflo/db'
import { pushPublicKey } from '@workflo/notifications'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

/**
 * S12-03 Web Push: підписки браузера. Identity-scoped (без agencyId) — фронт
 * реєструє service worker → PushManager.subscribe(VAPID) → POST сюди.
 * endpoint глобально унікальний: повторна підписка того самого браузера іншим
 * акаунтом перебиває profileId (upsert). Без VAPID-ключів у env — publicKey=null,
 * фронт ховає тумблер.
 */

const subscribeSchema = z
  .object({
    endpoint: z.string().url().max(1000),
    p256dh: z.string().min(10).max(300),
    auth: z.string().min(5).max(100),
    userAgent: z.string().max(300).optional(),
  })
  .strict()

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) }).strict()

const pushRoute: FastifyPluginAsync = (fastify) => {
  // ── VAPID public key (фронту для PushManager.subscribe) ──────────────────────
  fastify.get(
    '/notifications/push/vapid-key',
    { preHandler: [fastify.authenticate] },
    async (_request, reply) => {
      return reply.send({ success: true, data: { publicKey: pushPublicKey() } })
    }
  )

  // ── Підписатись (upsert по endpoint) ─────────────────────────────────────────
  fastify.post(
    '/notifications/push/subscriptions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!pushPublicKey()) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Push не сконфігуровано', 400)
      }
      const input = subscribeSchema.parse(request.body)
      await prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          profileId: request.user.sub,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
        },
        // той самий браузер, інший акаунт → перебиваємо власника і ключі
        update: {
          profileId: request.user.sub,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
        },
      })
      return reply.status(201).send({ success: true, data: { subscribed: true } })
    }
  )

  // ── Відписатись (лише власну підписку) ───────────────────────────────────────
  fastify.delete(
    '/notifications/push/subscriptions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { endpoint } = unsubscribeSchema.parse(request.body)
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, profileId: request.user.sub },
      })
      return reply.send({ success: true, data: { unsubscribed: true } })
    }
  )

  return Promise.resolve()
}

export default pushRoute
