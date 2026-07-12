import { inboundEmailConfig, pollInboundMailbox } from '../services/inboundEmail.js'
import { makeCron } from './makeCron.js'

/**
 * S12-05 EMAIL-INBOUND полер: кожні ~2 хв читає UNSEEN зі спільної support-скриньки
 * і перетворює листи на тікети (див. services/inboundEmail.ts). Graceful-off: без
 * INBOUND_IMAP_* env крон навіть не стартує — фіча просто вимкнена, воркер живий.
 * Single-flight (`running`) — повільний IMAP-прохід не накладається на наступний тік.
 */
const INTERVAL_MS = 2 * 60 * 1000

const cron = makeCron({
  name: 'inboundEmail',
  bootDelayMs: 120_000,
  intervalMs: INTERVAL_MS,
  run: async (logger) => {
    const summary = await pollInboundMailbox(logger)
    if (summary.processed > 0) {
      logger.info(summary, 'inboundEmail: poll complete')
    }
  },
})

export function startInboundEmailCron(logger: Parameters<typeof cron.start>[0]): void {
  // Без креденшлів — не стартуємо взагалі (тихо, як VAPID-push).
  if (!inboundEmailConfig()) {
    logger.info('inboundEmail: INBOUND_IMAP_* не задані — полінг вимкнено')
    return
  }
  cron.start(logger)
}
export const stopInboundEmailCron = cron.stop
