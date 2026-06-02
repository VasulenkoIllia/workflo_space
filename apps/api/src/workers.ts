import type { FastifyBaseLogger } from 'fastify'
import { startChatListener, stopChatListener } from './services/chatListener.js'
import { startOutboxWorker, stopOutboxWorker } from './services/outboxWorker.js'

/**
 * Background workers (chat SSE listener + outbox drain). ADR-006: they run INLINE
 * in the API process by default (single replica), but can be hoisted into a
 * dedicated worker container by setting `RUN_WORKERS_INLINE=false` on the web
 * replicas and running `node dist/worker.js` separately — so N web replicas don't
 * each run their own drain loop (double notifications / charges) when we scale out.
 *
 * The outbox claim (`FOR UPDATE SKIP LOCKED`) is multi-runner-safe regardless; the
 * flag is about not wasting N redundant loops and isolating worker load.
 */
export function shouldRunWorkersInline(): boolean {
  return process.env.RUN_WORKERS_INLINE !== 'false'
}

export function startWorkers(logger: FastifyBaseLogger): void {
  // One LISTEN connection feeds all chat streams on this instance.
  startChatListener(logger)
  // Durable domain-event delivery (status-change notifications, …).
  startOutboxWorker(logger)
}

export async function stopWorkers(): Promise<void> {
  stopOutboxWorker()
  await stopChatListener()
}
