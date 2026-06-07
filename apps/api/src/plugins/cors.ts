import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'
import { isOriginAllowed } from '../config/origins.js'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    // Single source of truth (config/origins.ts) — the SAME function the
    // /auth/refresh CSRF guard calls, so CORS and CSRF can never drift (audit 2026-06).
    origin: (origin, cb) =>
      isOriginAllowed(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'), false),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
  })
}

export default corsPlugin
