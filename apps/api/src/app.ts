import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import errorHandlerPlugin from './plugins/errorHandler.js'
import rateLimitingPlugin from './plugins/rateLimiting.js'
import healthRoute from './routes/health.js'

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
  })

  app.register(corsPlugin)
  app.register(rateLimitingPlugin)

  app.register(healthRoute)

  app.register(errorHandlerPlugin)

  return app
}
