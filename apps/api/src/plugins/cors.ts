import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'
import { allowedProdOrigins, isLocalOrigin } from '../config/origins.js'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // Shared allowlist (config/origins.ts) — same source the /auth/refresh CSRF
  // guard uses, so the two can never diverge again (audit 2026-06).
  const prodOrigins = allowedProdOrigins()

  await fastify.register(cors, {
    origin:
      process.env.NODE_ENV === 'production'
        ? (origin, cb) => {
            if (!origin || prodOrigins.has(origin)) {
              cb(null, true)
              return
            }

            cb(new Error('Not allowed by CORS'), false)
          }
        : (origin, cb) => {
            if (isLocalOrigin(origin)) {
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
