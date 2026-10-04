import { prisma } from '@workflo/db'
import { verifyUnsubscribeToken } from '@workflo/notifications'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * S12-05 (хвіст) UNSUBSCRIBE: публічна відписка від маркетинг-подібних листів
 * (broadcast). Токен — HMAC-підписаний email (без стану), тож роут no-auth:
 * GET — людина з листа (HTML-підтвердження); POST — one-click з поштових
 * клієнтів (RFC 8058, List-Unsubscribe-Post). Обидва ідемпотентні (upsert).
 * EmailSuppression — identity-рівень (без tenant-RLS), читається raw prisma.
 */
const PAGE = (title: string, body: string) => `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e6e8eb;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px}p{color:#8a8f98;font-size:14px}</style>
</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`

const unsubscribeRoute: FastifyPluginAsync = (fastify) => {
  // RFC 8058 one-click POST шле `List-Unsubscribe=One-Click` як
  // application/x-www-form-urlencoded. Тіло нам не потрібне (адреса — у токені),
  // тож приймаємо як рядок і не парсимо. Парсер енкапсульований у цьому плагіні.
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, _body, done) => {
      done(null, undefined)
    }
  )

  const handler = async (token: string, log: Parameters<typeof writeAuditAsync>[0]) => {
    const email = verifyUnsubscribeToken(token)
    if (!email) return null
    await prisma.emailSuppression.upsert({
      where: { email },
      update: { reason: 'unsubscribe', source: 'unsubscribe_link' },
      create: { email, reason: 'unsubscribe', source: 'unsubscribe_link' },
    })
    writeAuditAsync(log, {
      actorId: 'public',
      action: 'notifications.unsubscribed',
      resourceType: 'email_suppression',
      resourceId: email,
      result: 'allowed',
    })
    return email
  }

  // Людина клікнула лінк у листі → підтвердження HTML-сторінкою.
  fastify.get<{ Params: { token: string } }>(
    '/public/unsubscribe/:token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const email = await handler(request.params.token, request.log)
      reply.header('Content-Type', 'text/html; charset=utf-8')
      if (!email) {
        return reply
          .status(400)
          .send(PAGE('Посилання недійсне', 'Токен відписки не розпізнано або пошкоджено.'))
      }
      return reply.send(
        PAGE('Ви відписані', `Адреса ${email} більше не отримуватиме розсилки workflo.space.`)
      )
    }
  )

  // One-click відписка поштового клієнта (RFC 8058) — POST без тіла/з form-data.
  fastify.post<{ Params: { token: string } }>(
    '/public/unsubscribe/:token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const email = await handler(request.params.token, request.log)
      if (!email) return reply.status(400).send({ success: false })
      return reply.send({ success: true })
    }
  )

  return Promise.resolve()
}

export default unsubscribeRoute
