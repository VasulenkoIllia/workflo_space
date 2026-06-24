import { randomBytes } from 'node:crypto'
import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

/** Telegram account linking (15-bot, S6-05/06).
 *
 * Flow: the user hits POST /profile/telegram/connect → we mint a one-time `telegram_link`
 * OtpToken and hand back a `t.me/<bot>?start=<code>` deep link. They open it; the bot calls
 * POST /telegram/link (bot-secret auth) with the code + their chat id; we stamp the chat id
 * onto their NotificationSettings so notify()'s telegram channel can reach them.
 *
 * otp_tokens / notification_settings carry no RLS (cross-tenant, per-profile), so plain
 * `prisma` is correct here — the bot endpoint has no request tenant-context at all.
 */
const LINK_TTL_MS = 10 * 60 * 1000

const linkSchema = z.object({
  code: z.string().min(8).max(128),
  chatId: z.string().min(1).max(64),
})

const telegramRoutes: FastifyPluginAsync = (fastify) => {
  // ── User: mint a connect deep link ──────────────────────────────────────────
  fastify.post(
    '/profile/telegram/connect',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const username = process.env.TELEGRAM_BOT_USERNAME
      if (!username) {
        return reply
          .status(503)
          .send({ success: false, error: { message: 'Telegram-бот не налаштовано' } })
      }
      const profileId = request.user.sub
      const code = randomBytes(16).toString('hex')
      const expiresAt = new Date(Date.now() + LINK_TTL_MS)

      // One active link-code per profile (the @@unique([profileId, purpose])); re-issue resets it.
      await prisma.otpToken.upsert({
        where: { profileId_purpose: { profileId, purpose: 'telegram_link' } },
        create: { profileId, purpose: 'telegram_link', channel: 'telegram', code, expiresAt },
        update: { code, expiresAt, usedAt: null, channel: 'telegram' },
      })

      return reply.send({
        success: true,
        data: { deepLink: `https://t.me/${username}?start=${code}`, expiresAt },
      })
    }
  )

  // ── User: link status ───────────────────────────────────────────────────────
  fastify.get(
    '/profile/telegram',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const settings = await prisma.notificationSettings.findUnique({
        where: { profileId: request.user.sub },
        select: { telegramChatId: true, telegramLinkedAt: true },
      })
      return reply.send({
        success: true,
        data: { linked: !!settings?.telegramChatId, linkedAt: settings?.telegramLinkedAt ?? null },
      })
    }
  )

  // ── User: unlink ─────────────────────────────────────────────────────────────
  fastify.delete(
    '/profile/telegram',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await prisma.notificationSettings.updateMany({
        where: { profileId: request.user.sub },
        data: { telegramChatId: null, telegramLinkedAt: null },
      })
      return reply.send({ success: true, data: { linked: false } })
    }
  )

  // ── Bot: complete the link (shared-secret auth, no user session) ─────────────
  fastify.post('/telegram/link', async (request, reply) => {
    const secret = process.env.BOT_LINK_SECRET
    if (!secret) {
      return reply
        .status(503)
        .send({ success: false, error: { message: 'telegram_link_not_configured' } })
    }
    if (request.headers['x-bot-secret'] !== secret) {
      return reply.status(401).send({ success: false, error: { message: 'unauthorized' } })
    }
    const { code, chatId } = linkSchema.parse(request.body)

    const token = await prisma.otpToken.findFirst({
      where: {
        code,
        purpose: 'telegram_link',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, profileId: true, profile: { select: { name: true } } },
    })
    if (!token) {
      return reply
        .status(400)
        .send({ success: false, error: { message: 'invalid_or_expired_code' } })
    }

    const now = new Date()
    // A Telegram chat links to exactly one profile — release it from any other first.
    await prisma.notificationSettings.updateMany({
      where: { telegramChatId: chatId, profileId: { not: token.profileId } },
      data: { telegramChatId: null, telegramLinkedAt: null },
    })
    await prisma.notificationSettings.upsert({
      where: { profileId: token.profileId },
      create: { profileId: token.profileId, telegramChatId: chatId, telegramLinkedAt: now },
      update: { telegramChatId: chatId, telegramLinkedAt: now },
    })
    await prisma.otpToken.update({ where: { id: token.id }, data: { usedAt: now } })

    return reply.send({ success: true, data: { profileName: token.profile.name } })
  })

  return Promise.resolve()
}

export default telegramRoutes
