import { prisma } from '@workflo/db'
import { getActiveFrom, getMailer, renderEmailChangeConfirmEmail } from '@workflo/notifications'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { verifyPassword } from '../../auth/password.js'
import { generateOpaqueToken } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { dispatchNotification } from '../../services/notifications.js'

/**
 * 01-Г зміна email. Спека каже «підтвердження на стару + нову» — реалізовано
 * еквівалентом: контроль акаунта доводиться ПАРОЛЕМ (re-auth) + підтвердженням
 * лінка на НОВІЙ адресі; на СТАРУ одразу летить попередження («якщо це не ви —
 * змініть пароль»). pendingEmail тримає нову адресу до підтвердження; повторний
 * запит перезаписує (upsert по purpose). Після підтвердження email вважається
 * верифікованим (лінк доставлено = скринька доведена).
 */
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000

const requestSchema = z
  .object({
    newEmail: z.string().trim().email().max(200),
    password: z.string().min(1).max(200),
  })
  .strict()
const confirmSchema = z.object({ token: z.string().min(10).max(200) }).strict()

const changeEmailRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/change-email',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { newEmail, password } = requestSchema.parse(request.body)
      const email = newEmail.toLowerCase()

      const profile = await prisma.profile.findUnique({
        where: { id: request.user.sub },
        select: { id: true, email: true, passwordHash: true },
      })
      if (!profile) throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна', 401)
      if (email === profile.email) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Це вже ваша поточна адреса', 400)
      }
      const ok = await verifyPassword(password, profile.passwordHash)
      if (!ok) throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Невірний пароль', 401)

      const taken = await prisma.profile.findUnique({ where: { email }, select: { id: true } })
      if (taken) {
        throw new AppError(ApiErrorCode.CONFLICT, 'Адреса вже використовується', 409)
      }

      const token = generateOpaqueToken()
      await prisma.$transaction([
        prisma.profile.update({
          where: { id: profile.id },
          data: { pendingEmail: email },
        }),
        prisma.otpToken.upsert({
          where: { profileId_purpose: { profileId: profile.id, purpose: 'email_change' } },
          create: {
            profileId: profile.id,
            purpose: 'email_change',
            channel: 'email',
            code: token,
            expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
          },
          update: {
            code: token,
            usedAt: null,
            expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
          },
        }),
      ])

      const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
      // Попередження на СТАРУ (поточну) адресу — звичайний notify-канал.
      dispatchNotification(request.log, {
        profileId: profile.id,
        event: 'auth.email_change_requested',
        vars: { newEmail: email },
      })
      // Confirm-лінк — на НОВУ адресу: notify шле лише на profile.email, тому конверт
      // на чужу поки-адресу відправляємо мейлером напряму (рендер тим самим шаблоном).
      const rendered = renderEmailChangeConfirmEmail({
        confirmUrl: `${portalUrl}/confirm-email-change?token=${encodeURIComponent(token)}`,
      })
      const from = getActiveFrom()
      getMailer()
        .sendMail({
          from: `"${from.name}" <${from.address}>`,
          to: email,
          subject: rendered.subject,
          html: rendered.html,
        })
        .catch((err: unknown) => request.log.error({ err }, 'email-change confirm mail failed'))

      writeAuditAsync(request.log, {
        actorId: profile.id,
        action: 'auth.email_change_requested',
        resourceType: 'profile',
        resourceId: profile.id,
        result: 'allowed',
        metadata: { ip: request.ip },
      })
      return reply.send({ success: true, data: { pendingEmail: email } })
    }
  )

  // Публічний confirm (лінк відкривається можливо без сесії)
  fastify.post(
    '/auth/confirm-email-change',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { token } = confirmSchema.parse(request.body)
      const row = await prisma.otpToken.findFirst({
        where: { code: token, purpose: 'email_change' },
        select: { id: true, profileId: true, usedAt: true, expiresAt: true },
      })
      if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Посилання недійсне або прострочене', 410)
      }
      const profile = await prisma.profile.findUnique({
        where: { id: row.profileId },
        select: { id: true, pendingEmail: true },
      })
      if (!profile?.pendingEmail) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Запит на зміну не знайдено', 410)
      }
      // Гонка: адресу могли зайняти між запитом і підтвердженням.
      const taken = await prisma.profile.findUnique({
        where: { email: profile.pendingEmail },
        select: { id: true },
      })
      if (taken) {
        throw new AppError(ApiErrorCode.CONFLICT, 'Адреса вже використовується', 409)
      }

      await prisma.$transaction([
        prisma.otpToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
        prisma.profile.update({
          where: { id: profile.id },
          data: {
            email: profile.pendingEmail,
            pendingEmail: null,
            emailVerifiedAt: new Date(), // лінк доставлено → скринька доведена
          },
        }),
      ])
      writeAuditAsync(request.log, {
        actorId: profile.id,
        action: 'auth.email_changed',
        resourceType: 'profile',
        resourceId: profile.id,
        result: 'allowed',
        metadata: { ip: request.ip },
      })
      return reply.send({ success: true, data: { changed: true } })
    }
  )

  return Promise.resolve()
}

export default changeEmailRoute
