import multipart from '@fastify/multipart'
import { MAX_ORDER_FILE_BYTES } from '@workflo/types'
import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import { registerErrorHandlers } from './plugins/errorHandler.js'
import jwtPlugin from './plugins/jwt.js'
import rateLimitingPlugin from './plugins/rateLimiting.js'
import securityHeadersPlugin from './plugins/securityHeaders.js'
import adminRoutes from './routes/admin/index.js'
import authRoutes from './routes/auth/index.js'
import billingRoutes from './routes/billing/index.js'
import companyRoutes from './routes/company/index.js'
import contentRoutes from './routes/content/index.js'
import documentRoutes from './routes/documents/index.js'
import fileRoutes from './routes/files/index.js'
import financeRoutes from './routes/finance/index.js'
import healthRoute from './routes/health.js'
import inviteRoutes from './routes/invites/index.js'
import loyaltyRoutes from './routes/loyalty/index.js'
import notificationRoutes from './routes/notifications/index.js'
import orderRoutes from './routes/orders/index.js'
import profileRoutes from './routes/profile/index.js'
import referralRoutes from './routes/referral/index.js'
import serviceRoutes from './routes/services/index.js'
import teamRoutes from './routes/team/index.js'
import telegramLinkRoutes from './routes/telegram/index.js'
import tenantBrandingRoute from './routes/tenant/branding.js'
import walletRoutes from './routes/wallet/index.js'

function buildLoggerConfig() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-bot-secret"]',
        'req.body.password',
        'req.body.passwordHash',
        'req.body.token',
        'req.body.refreshToken',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req(request: { method: string; url: string; socket?: { remoteAddress?: string } }) {
        return {
          method: request.method,
          url: request.url,
          remoteAddress: request.socket?.remoteAddress,
        }
      },
      res(reply: { statusCode: number }) {
        return {
          statusCode: reply.statusCode,
        }
      },
    },
  }
}

export function buildApp() {
  const app = Fastify({
    logger: buildLoggerConfig(),
    // Trust exactly ONE proxy hop (Traefik). `true` trusted ALL X-Forwarded-For
    // hops → request.ip could be spoofed to bypass IP rate-limits (audit 31.05).
    trustProxy: 1,
    // AR-30: close idle keep-alive connections on app.close() so shutdown doesn't
    // wait on them. Live SSE streams are ended explicitly (closeAllChatStreams).
    forceCloseConnections: 'idle',
  })

  app.register(corsPlugin)
  app.register(securityHeadersPlugin)
  app.register(rateLimitingPlugin)
  app.register(jwtPlugin)
  app.register(multipart, {
    limits: { fileSize: MAX_ORDER_FILE_BYTES, files: 1 },
  })

  app.register(healthRoute)
  app.register(tenantBrandingRoute)
  app.register(authRoutes)
  app.register(profileRoutes)
  app.register(inviteRoutes)
  app.register(orderRoutes)
  app.register(fileRoutes)
  app.register(billingRoutes)
  app.register(companyRoutes)
  app.register(documentRoutes)
  app.register(telegramLinkRoutes)
  app.register(serviceRoutes)
  app.register(walletRoutes)
  app.register(referralRoutes)
  app.register(loyaltyRoutes)
  app.register(notificationRoutes)
  app.register(teamRoutes)
  app.register(financeRoutes)
  app.register(adminRoutes)
  app.register(contentRoutes)

  // Root-level error/not-found handlers (must not be encapsulated).
  registerErrorHandlers(app)

  return app
}
