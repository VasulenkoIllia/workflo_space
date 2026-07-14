import { sendEmail } from '@workflo/notifications'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireOwnerAgency } from '../../auth/tenant.js'
import { cronRegistry } from '../../cron/makeCron.js'
import { prisma } from '@workflo/db'

/**
 * DSN-3 (workspace-admin-settings.jsx): ops-таби налаштувань.
 * - GET /workspace/agency/smtp-status — санітизований стан SMTP з env (БЕЗ паролів);
 *   конфіг лишається env-only (рішення: креденшли пошти не зберігаємо в БД).
 * - POST /workspace/agency/smtp-test — тестовий лист власнику (перевірка доставки).
 * - GET /workspace/agency/cron-status — реєстр кронів цього процесу (makeCron).
 */
const opsSettingsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/agency/smtp-status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      requireOwnerAgency(request.user, 'Налаштування доступні лише власнику')
      const host = process.env.SMTP_HOST ?? null
      return reply.send({
        success: true,
        data: {
          configured: !!host,
          host,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          from: process.env.SMTP_FROM ?? 'noreply@workflo.space',
          fromName: process.env.SMTP_FROM_NAME ?? 'Workflo',
          authUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}…` : null,
          note: 'Змінюється через env сервера (SMTP_*) — див. .env.example',
        },
      })
    }
  )

  fastify.post(
    '/workspace/agency/smtp-test',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      requireOwnerAgency(request.user, 'Налаштування доступні лише власнику')
      const me = await prisma.profile.findUnique({
        where: { id: request.user.sub },
        select: { email: true, name: true },
      })
      if (!me) throw new AppError(ApiErrorCode.NOT_FOUND, 'Профіль не знайдено', 404)
      const result = await sendEmail({
        to: me.email,
        subject: 'Тестовий лист · workflo.space',
        html: `<p>Це тестовий лист із налаштувань workflo.space.</p>
<p>Якщо ви його бачите — SMTP налаштований коректно.</p>
<p style="color:#888;font-size:12px">Надіслано ${new Date().toISOString()}</p>`,
      })
      return reply.send({
        success: true,
        data: { to: me.email, status: result.status },
      })
    }
  )

  fastify.get(
    '/workspace/agency/cron-status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      requireOwnerAgency(request.user, 'Налаштування доступні лише власнику')
      const crons = [...cronRegistry.values()].sort((a, b) => a.name.localeCompare(b.name))
      return reply.send({
        success: true,
        data: {
          crons,
          inline: process.env.RUN_WORKERS_INLINE !== 'false',
          note:
            process.env.RUN_WORKERS_INLINE === 'false'
              ? 'Воркери винесені окремим процесом — статуси кронів живуть там'
              : null,
        },
      })
    }
  )

  return Promise.resolve()
}

export default opsSettingsRoute
