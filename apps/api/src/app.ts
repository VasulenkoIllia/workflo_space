import multipart from '@fastify/multipart'
import { MAX_ORDER_FILE_BYTES } from '@workflo/types'
import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import { registerErrorHandlers } from './plugins/errorHandler.js'
import jwtPlugin from './plugins/jwt.js'
import rateLimitingPlugin from './plugins/rateLimiting.js'
import securityHeadersPlugin from './plugins/securityHeaders.js'
import authRoutes from './routes/auth/index.js'
import billingRoutes from './routes/billing/index.js'
import fileRoutes from './routes/files/index.js'
import healthRoute from './routes/health.js'
import inviteRoutes from './routes/invites/index.js'
import orderRoutes from './routes/orders/index.js'
import profileRoutes from './routes/profile/index.js'
import tenantBrandingRoute from './routes/tenant/branding.js'

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

  // Root-level error/not-found handlers (must not be encapsulated).
  registerErrorHandlers(app)

  return app
}
