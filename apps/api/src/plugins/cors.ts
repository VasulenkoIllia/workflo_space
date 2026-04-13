import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'

const ALLOWED_ORIGINS_PROD = [
  'https://app.workflo.space',
  'https://work.workflo.space',
  'https://workflo.space',
]

function isAllowedDevOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true
  }

  return origin.startsWith('http://localhost')
}

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin:
      process.env.NODE_ENV === 'production'
        ? ALLOWED_ORIGINS_PROD
        : (origin, cb) => {
            if (isAllowedDevOrigin(origin)) {
              cb(null, true)
              return
            }

            cb(new Error('Not allowed by CORS'), false)
          },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
  })
}

export default corsPlugin
