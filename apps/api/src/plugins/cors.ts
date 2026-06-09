import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
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

// MUST be fp-wrapped: @fastify/cors adds its onRequest hook in the registering
// context. Without fp this plugin is encapsulated, so the hook never reaches the
// sibling route plugins — preflight (a global OPTIONS * route) still gets ACAO,
// but ACTUAL responses ship without Access-Control-Allow-Origin and every browser
// client is blocked from reading them (caught during S5 UI testing, 2026-06).
export default fp(corsPlugin, { name: 'cors-plugin', fastify: '5.x' })
