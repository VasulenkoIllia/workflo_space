import type { FastifyBaseLogger } from 'fastify'
import { Client } from 'pg'
import { type ChatEvent, publishChatEvent } from './chatBus.js'

/**
 * Single shared Postgres LISTEN connection per API instance (ADR: SSE
 * multi-instance). A DB trigger on `order_comments` `pg_notify`s the
 * `chat_events` channel; we fan each event out to local SSE subscribers via
 * `chatBus`. One connection serves all SSE clients on this instance, and the
 * bus works across replicas because every instance LISTENs the same channel.
 *
 * Lifecycle is owned by the server bootstrap (index.ts), NOT `buildApp()`, so
 * unit tests never open a real connection.
 */
const CHANNEL = 'chat_events'
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 60_000

let client: Client | null = null
let stopped = false
let reconnecting = false
let backoff = INITIAL_BACKOFF_MS

export function startChatListener(log: FastifyBaseLogger): void {
  stopped = false
  void connect(log)
}

async function connect(log: FastifyBaseLogger): Promise<void> {
  if (stopped) return
  reconnecting = false
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  client = c

  c.on('notification', (msg) => {
    if (msg.channel !== CHANNEL || !msg.payload) return
    try {
      publishChatEvent(JSON.parse(msg.payload) as ChatEvent)
    } catch (err) {
      log.warn({ err }, 'chatListener: ignoring malformed payload')
    }
  })
  c.on('error', (err) => {
    log.warn({ err }, 'chatListener: connection error → reconnecting')
    scheduleReconnect(log)
  })

  try {
    await c.connect()
    await c.query(`LISTEN ${CHANNEL}`)
    backoff = INITIAL_BACKOFF_MS
    log.info('chatListener: LISTEN chat_events established')
  } catch (err) {
    log.warn({ err }, 'chatListener: connect failed → retrying')
    scheduleReconnect(log)
  }
}

function scheduleReconnect(log: FastifyBaseLogger): void {
  if (stopped || reconnecting) return
  reconnecting = true
  const dead = client
  client = null
  if (dead) void dead.end().catch(() => undefined)

  const delay = backoff
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  setTimeout(() => void connect(log), delay).unref()
}

export async function stopChatListener(): Promise<void> {
  stopped = true
  const c = client
  client = null
  if (c) await c.end().catch(() => undefined)
}
