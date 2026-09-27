import { prisma } from '@workflo/db'
import { sendEmail, sendTelegram } from '@workflo/notifications'
import { ApiErrorCode, AppError, testNotificationSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'

/**
 * DSN-7 · хаб «Сповіщення» → «Тест» (design-v2 workspace-notify.jsx NfTest): тестове
 * сповіщення СОБІ через обраний канал — перевірити, що email/Telegram/in-app доходять.
 * Оминає матрицю вподобань і тихі години навмисно (це діагностика каналу). Будь-яка
 * автентифікована роль (команда й клієнт) — лише на власні контакти.
 */
const testNotificationRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/notifications/test',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { channel } = testNotificationSchema.parse(request.body)
      const profileId = request.user.sub
      const stamp = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })

      if (channel === 'in_app') {
        await prisma.notification.create({
          data: {
            profileId,
            type: 'test',
            title: 'Тестове сповіщення',
            body: `Канал in-app працює · ${stamp}`,
          },
        })
        return reply.send({ success: true, data: { channel, status: 'sent' } })
      }

      if (channel === 'email') {
        const me = await prisma.profile.findUnique({
          where: { id: profileId },
          select: { email: true },
        })
        if (!me) throw new AppError(ApiErrorCode.NOT_FOUND, 'Профіль не знайдено', 404)
        const r = await sendEmail({
          to: me.email,
          subject: 'Тестове сповіщення · workflo.space',
          html: `<p>Це тестове сповіщення з хабу «Сповіщення».</p>
<p>Якщо ви його бачите — email-канал працює.</p>
<p style="color:#888;font-size:12px">${stamp}</p>`,
        })
        if (r.status !== 'sent') {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Лист не відправлено — перевірте SMTP (Налаштування → SMTP · Крони)',
            400
          )
        }
        return reply.send({ success: true, data: { channel, status: 'sent', to: me.email } })
      }

      // telegram
      const settings = await prisma.notificationSettings.findUnique({
        where: { profileId },
        select: { telegramChatId: true },
      })
      if (!settings?.telegramChatId) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Telegram не підключено — привʼяжіть бота в налаштуваннях акаунта',
          400
        )
      }
      const r = await sendTelegram({
        chatId: settings.telegramChatId,
        text: `✅ <b>Тестове сповіщення</b>\nTelegram-канал працює · ${stamp}`,
      })
      if (r.status !== 'sent') {
        const why =
          r.status === 'skipped'
            ? 'бот не налаштований на сервері'
            : r.reason === 'blocked'
              ? 'бот заблокований у Telegram — розблокуйте й повторіть'
              : 'помилка доставки'
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, `Не надіслано: ${why}`, 400)
      }
      return reply.send({ success: true, data: { channel, status: 'sent' } })
    }
  )
  return Promise.resolve()
}

export default testNotificationRoute
