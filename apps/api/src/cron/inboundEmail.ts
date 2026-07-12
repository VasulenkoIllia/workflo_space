import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { inboundEmailConfig, pollInboundMailbox } from '../services/inboundEmail.js'

/**
 * S12-05 EMAIL-INBOUND полер: кожні ~2 хв читає UNSEEN зі спільної support-скриньки
 * і перетворює листи на тікети (див. services/inboundEmail.ts). Graceful-off: без
 * INBOUND_IMAP_* env крон навіть не стартує — фіча просто вимкнена, воркер живий.
 * Single-flight (`running`) — повільний IMAP-прохід не накладається на наступний тік.
 */
const INTERVAL_MS = 2 * 60 * 1000

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    const summary = await pollInboundMailbox(logger)
    if (summary.processed > 0) {
      logger.info(summary, 'inboundEmail: poll complete')
    }
  } catch (err) {
    logger.error({ err }, 'inboundEmail: poll failed')
    captureException(err, { scope: 'cron.inboundEmail' })
  } finally {
    running = false
  }
}

export function startInboundEmailCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  // Без креденшлів — не стартуємо взагалі (тихо, як VAPID-push).
  if (!inboundEmailConfig()) {
    logger.info('inboundEmail: INBOUND_IMAP_* не задані — полінг вимкнено')
    return
  }
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), INTERVAL_MS)
    intervalTimer.unref()
  }, 120_000)
  bootTimer.unref()
}

export function stopInboundEmailCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
