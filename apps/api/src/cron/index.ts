import type { FastifyBaseLogger } from 'fastify'
import { startCredentialsRotationCron, stopCredentialsRotationCron } from './credentialsRotation.js'
import { startSlaCheckCron, stopSlaCheckCron } from './slaCheck.js'
import { startExchangeRateCron, stopExchangeRateCron } from './exchangeRate.js'
import { startIdempotencyKeySweepCron, stopIdempotencyKeySweepCron } from './idempotencyKeySweep.js'
import { startLoyaltyRecalcCron, stopLoyaltyRecalcCron } from './loyaltyRecalc.js'
import { startClientMonthlyReportCron, stopClientMonthlyReportCron } from './clientMonthlyReport.js'
import { startDunningCron, stopDunningCron } from './dunning.js'
import { startMonthlyReportCron, stopMonthlyReportCron } from './monthlyReport.js'
import { startRecurringChargesCron, stopRecurringChargesCron } from './recurringCharges.js'
import { startRefreshTokenSweepCron, stopRefreshTokenSweepCron } from './refreshTokenSweep.js'
import { startTimerAutoStopCron, stopTimerAutoStopCron } from './timerAutoStop.js'

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
  startRecurringChargesCron(logger)
  startLoyaltyRecalcCron(logger)
  startRefreshTokenSweepCron(logger)
  startIdempotencyKeySweepCron(logger)
  startTimerAutoStopCron(logger)
  startCredentialsRotationCron(logger)
  startSlaCheckCron(logger)
  startMonthlyReportCron(logger)
  startClientMonthlyReportCron(logger)
  startDunningCron(logger)
}

export function stopCronJobs(): void {
  stopExchangeRateCron()
  stopRecurringChargesCron()
  stopLoyaltyRecalcCron()
  stopRefreshTokenSweepCron()
  stopIdempotencyKeySweepCron()
  stopTimerAutoStopCron()
  stopCredentialsRotationCron()
  stopSlaCheckCron()
  stopMonthlyReportCron()
  stopClientMonthlyReportCron()
  stopDunningCron()
}
