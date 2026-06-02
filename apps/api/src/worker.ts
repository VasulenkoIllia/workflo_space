import { prisma } from '@workflo/db'
import Fastify from 'fastify'
import { validateRuntimeEnv } from './config/env.js'
import { startWorkers, stopWorkers } from './workers.js'

/**
 * Dedicated worker entrypoint (ADR-006). Run as a separate container/process:
 *   node apps/api/dist/worker.js
 * with `RUN_WORKERS_INLINE=false` on the web replicas. No HTTP server — just the
 * chat-listener + outbox drain. Scale web and worker independently.
 */
validateRuntimeEnv()

// A bare Fastify instance (never listens) purely for its pino logger config.
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })
const logger = app.log

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker: received shutdown signal')
  await stopWorkers()
  await prisma.$disconnect()
  await app.close()
  logger.info('worker: stopped cleanly')
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

startWorkers(logger)
logger.info('workflo worker started (chat-listener + outbox drain)')
