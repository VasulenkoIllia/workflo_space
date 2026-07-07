import { EventEmitter } from 'node:events'

/**
 * 29 Support: per-instance in-memory fan-out для SSE тредів тікетів. Роут публікує
 * подію напряму після створення повідомлення (in-process, single-replica — як
 * chatBus для reads). SSE-хендлер re-fetch'ить рядок з БД і застосовує leak-guard,
 * тож payload несе лише IDs.
 */
export interface TicketEvent {
  ticketId: string
  messageId: string
  authorId: string
  isInternal: boolean
  createdAt: string
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

const channel = (ticketId: string) => `ticket:${ticketId}`

/** Підписка на тред одного тікета. Повертає unsubscribe (викликати на disconnect). */
export function subscribeTicket(
  ticketId: string,
  handler: (event: TicketEvent) => void
): () => void {
  const ch = channel(ticketId)
  emitter.on(ch, handler)
  return () => emitter.off(ch, handler)
}

/** Розіслати подію локальним підписникам треду. */
export function publishTicketEvent(event: TicketEvent): void {
  emitter.emit(channel(event.ticketId), event)
}
