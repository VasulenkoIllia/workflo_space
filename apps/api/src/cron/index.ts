import type { FastifyBaseLogger } from 'fastify'
import { startExchangeRateCron, stopExchangeRateCron } from './exchangeRate.js'

/**
 * Scheduled background jobs (Sprint 5+). They run wherever the workers run —
 * inline in the API process by default, or in the dedicated worker container
 * (`RUN_WORKERS_INLINE=false`). Started by `startWorkers()`; lifecycle is owned by
 * the bootstrap, so tests never start real timers.
 *
 * Upserts are idempotent, so a duplicate run across replicas is harmless.
 */
export function startCronJobs(logger: FastifyBaseLogger): void {
  startExchangeRateCron(logger)
}

export function stopCronJobs(): void {
  stopExchangeRateCron()
}
