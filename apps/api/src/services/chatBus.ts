import { EventEmitter } from 'node:events'

/** Payload carried on the Postgres `chat_events` channel (IDs only — small). */
export interface ChatEvent {
  orderId: string
  commentId: string
  authorId: string
  isInternal: boolean
  createdAt: string
}

/**
 * Per-instance in-memory fan-out for chat SSE. The pg LISTEN client
 * (`chatListener`) feeds events in via `publishChatEvent`; each open SSE handler
 * `subscribeChat`s to a single order. Decoupled from Postgres on purpose:
 *
 *  - unit-tests without a DB connection;
 *  - 1000+ SSE clients share ONE LISTEN connection per instance instead of
 *    opening a Postgres connection each (which would exhaust the server).
 */
const emitter = new EventEmitter()
// SSE fan-out legitimately has many concurrent listeners — disable the warning cap.
emitter.setMaxListeners(0)

const channel = (orderId: string) => `order:${orderId}`

/** Subscribe to one order's events. Returns an unsubscribe fn (call on disconnect). */
export function subscribeChat(orderId: string, handler: (event: ChatEvent) => void): () => void {
  const ch = channel(orderId)
  emitter.on(ch, handler)
  return () => emitter.off(ch, handler)
}

/** Fan a received event out to the local subscribers of its order. */
export function publishChatEvent(event: ChatEvent): void {
  emitter.emit(channel(event.orderId), event)
}

// ── Read receipts (S10) ───────────────────────────────────────────────────────
// Published in-process by the mark-read route (no pg NOTIFY hop — single-replica
// deployment, and a lost read event only delays a ✓✓ until the next refetch).

export interface ChatReadEvent {
  orderId: string
  profileId: string
  name: string
  lastReadAt: string
}

const readChannel = (orderId: string) => `order:${orderId}:reads`

export function subscribeReads(
  orderId: string,
  handler: (event: ChatReadEvent) => void
): () => void {
  const ch = readChannel(orderId)
  emitter.on(ch, handler)
  return () => emitter.off(ch, handler)
}

export function publishReadEvent(event: ChatReadEvent): void {
  emitter.emit(readChannel(event.orderId), event)
}

// ── Message changes: edit / delete / reaction (S10, канон 03-B/C) ─────────────
// In-process (routes publish directly): the stream re-fetches the row from DB
// truth on `updated`, so leak-guards stay authoritative exactly like inserts.

export interface ChatChangeEvent {
  orderId: string
  commentId: string
  kind: 'updated' | 'deleted'
}

const changeChannel = (orderId: string) => `order:${orderId}:changes`

export function subscribeChanges(
  orderId: string,
  handler: (event: ChatChangeEvent) => void
): () => void {
  const ch = changeChannel(orderId)
  emitter.on(ch, handler)
  return () => emitter.off(ch, handler)
}

export function publishChangeEvent(event: ChatChangeEvent): void {
  emitter.emit(changeChannel(event.orderId), event)
}

// ── Typing indicator (S10, 03-Б): ephemeral, never touches the DB ─────────────

export interface ChatTypingEvent {
  orderId: string
  profileId: string
  name: string
  /** Team is drafting an internal note → the stream hides this from clients. */
  internal: boolean
}

const typingChannel = (orderId: string) => `order:${orderId}:typing`

export function subscribeTyping(
  orderId: string,
  handler: (event: ChatTypingEvent) => void
): () => void {
  const ch = typingChannel(orderId)
  emitter.on(ch, handler)
  return () => emitter.off(ch, handler)
}

export function publishTypingEvent(event: ChatTypingEvent): void {
  emitter.emit(typingChannel(event.orderId), event)
}
