import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'

const DEFAULT_ALLOWED_ORIGINS_PROD = [
  'https://dev.workflo.space',
  'https://dev-portal.workflo.space',
  'https://dev-work.workflo.space',
  'https://portal.workflo.space',
  'https://work.workflo.space',
  'https://workflo.space',
]

function getAllowedProdOrigins(): Set<string> {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (fromEnv && fromEnv.length > 0) {
    return new Set(fromEnv)
  }

  return new Set(DEFAULT_ALLOWED_ORIGINS_PROD)
}

function isAllowedDevOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true
  }

  try {
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }

    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedProdOrigins = getAllowedProdOrigins()

  await fastify.register(cors, {
    origin:
      process.env.NODE_ENV === 'production'
        ? (origin, cb) => {
            if (!origin || allowedProdOrigins.has(origin)) {
              cb(null, true)
              return
            }

            cb(new Error('Not allowed by CORS'), false)
          }
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
