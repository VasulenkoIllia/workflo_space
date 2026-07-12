import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'

/**
 * R4 (аудит r6): спільний life-cycle для self-rescheduling кронів. До цього
 * bootTimer + intervalTimer + single-flight guard + try/catch/captureException +
 * unref() були скопійовані у ~12 файлах. Тут — одна перевірена реалізація:
 * `start` чекає bootDelayMs (число або функція — для daily-at-UTC), виконує
 * прогін і далі тікає кожні intervalMs; `stop` знімає обидва таймери.
 * Overlap-guard: повільний прогін не накладається на наступний тік.
 */
export interface CronSpec {
  /** Ім'я для Sentry-скоупу (`cron.<name>`) і логів. */
  name: string
  /** Затримка першого прогону: мс або функція (напр., msUntilUtc для daily). */
  bootDelayMs: number | (() => number)
  intervalMs: number
  run: (logger: FastifyBaseLogger) => Promise<unknown>
}

export interface CronHandle {
  start: (logger: FastifyBaseLogger) => void
  stop: () => void
}

export function makeCron(spec: CronSpec): CronHandle {
  let bootTimer: ReturnType<typeof setTimeout> | null = null
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let running = false

  async function runOnce(logger: FastifyBaseLogger): Promise<void> {
    if (running) return
    running = true
    try {
      await spec.run(logger)
    } catch (err) {
      logger.error({ err }, `${spec.name}: run failed`)
      captureException(err, { scope: `cron.${spec.name}` })
    } finally {
      running = false
    }
  }

  return {
    start(logger) {
      if (bootTimer || intervalTimer) return
      const delay = typeof spec.bootDelayMs === 'function' ? spec.bootDelayMs() : spec.bootDelayMs
      bootTimer = setTimeout(() => {
        void runOnce(logger)
        intervalTimer = setInterval(() => void runOnce(logger), spec.intervalMs)
        intervalTimer.unref()
      }, delay)
      bootTimer.unref()
    },
    stop() {
      if (bootTimer) {
        clearTimeout(bootTimer)
        bootTimer = null
      }
      if (intervalTimer) {
        clearInterval(intervalTimer)
        intervalTimer = null
      }
    },
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000

/** Мс до наступної UTC-години hh:mm (для daily-кронів з фіксованим часом). */
export function msUntilUtc(hour: number, minute: number, now: Date = new Date()): number {
  const next = new Date(now)
  next.setUTCHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}
