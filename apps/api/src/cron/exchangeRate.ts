import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'
const STALE_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

/** NBU returns UAH per 1 unit of `cc` (e.g. USD → 41.50). */
export interface NbuRateRow {
  cc: string
  rate: number
}

function isNbuRow(v: unknown): v is NbuRateRow {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return typeof r.cc === 'string' && typeof r.rate === 'number' && Number.isFinite(r.rate)
}

/** Fetch today's NBU rates → `{ USD: 41.5, EUR: 45.2, … }` (UAH per unit). Throws on HTTP/shape failure. */
export async function fetchNbuRates(
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, number>> {
  const res = await fetchImpl(NBU_URL)
  if (!res.ok) throw new Error(`NBU exchange API ${res.status}`)
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error('NBU exchange API: expected an array')
  const out: Record<string, number> = {}
  for (const row of body) {
    if (isNbuRow(row) && row.rate > 0) out[row.cc] = row.rate
  }
  return out
}

export interface SyncOptions {
  fetchImpl?: typeof fetch
  now?: () => Date
}

export interface SyncResult {
  updated: number
  failed: boolean
  staleAgencies: number
}

/**
 * Fetch NBU rates and upsert each active agency's {@link ExchangeRate} (per-agency
 * `usdToUah`/`eurToUah`). On fetch failure the LAST rates are kept (no throw, warn),
 * and agencies whose stored rate is now older than {@link STALE_DAYS} are flagged.
 * Runs in the worker (owner connection / RLS-bypass) so it touches every tenant.
 */
export async function syncExchangeRates(
  logger: FastifyBaseLogger,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const now = opts.now?.() ?? new Date()

  const agencies = await prisma.agency.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  let rates: Record<string, number> | null = null
  try {
    rates = await fetchNbuRates(opts.fetchImpl)
  } catch (err) {
    logger.warn({ err }, 'exchangeRate: NBU fetch failed — keeping last rates')
    captureException(err, { scope: 'cron.exchangeRate' })
  }

  const usd = rates?.USD
  if (usd != null && usd > 0) {
    const eur = rates?.EUR
    let updated = 0
    for (const a of agencies) {
      await prisma.exchangeRate.upsert({
        where: { agencyId: a.id },
        create: {
          agencyId: a.id,
          usdToUah: usd,
          eurToUah: eur != null && eur > 0 ? eur : null,
          updatedBy: 'nbu-cron',
        },
        // Don't wipe a previously-set EUR if today's payload lacks it.
        update: {
          usdToUah: usd,
          ...(eur != null && eur > 0 ? { eurToUah: eur } : {}),
          updatedBy: 'nbu-cron',
        },
      })
      updated += 1
    }
    logger.info({ updated, usd, eur }, 'exchangeRate: synced from NBU')
    return { updated, failed: false, staleAgencies: 0 }
  }

  if (rates && usd == null) {
    logger.warn('exchangeRate: NBU payload missing USD — keeping last rates')
  }

  // Couldn't refresh → surface any now-stale rates so they don't silently rot.
  const staleBefore = new Date(now.getTime() - STALE_DAYS * DAY_MS)
  const staleAgencies = await prisma.exchangeRate.count({
    where: { updatedAt: { lt: staleBefore } },
  })
  if (staleAgencies > 0) {
    logger.warn({ staleAgencies }, 'exchangeRate: stale rates (>3d) and refresh failed')
  }
  return { updated: 0, failed: true, staleAgencies }
}

// ── Scheduler (daily 06:10 UTC = 09:10 Kyiv) ─────────────────────────────────
// Plain setTimeout→setInterval (no node-cron dep), mirroring the outbox worker.
// Lifecycle owned by startWorkers(); never started in tests.
let bootTimer: ReturnType<typeof setTimeout> | null = null
let dailyTimer: ReturnType<typeof setInterval> | null = null
let running = false

/** ms from `now` until the next `HH:MM` UTC occurrence. */
export function msUntilUtc(hour: number, minute: number, now: Date): number {
  const next = new Date(now)
  next.setUTCHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return // never overlap a slow run with the next tick
  running = true
  try {
    await syncExchangeRates(logger)
  } catch (err) {
    logger.error({ err }, 'exchangeRate: sync run failed')
    captureException(err, { scope: 'cron.exchangeRate' })
  } finally {
    running = false
  }
}

export function startExchangeRateCron(logger: FastifyBaseLogger): void {
  if (bootTimer || dailyTimer) return
  const delay = msUntilUtc(6, 10, new Date())
  bootTimer = setTimeout(() => {
    bootTimer = null
    void runOnce(logger)
    dailyTimer = setInterval(() => void runOnce(logger), DAY_MS)
    dailyTimer.unref()
  }, delay)
  bootTimer.unref()
  logger.info({ delayMs: delay }, 'exchangeRate cron scheduled (06:10 UTC / 09:10 Kyiv)')
}

export function stopExchangeRateCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
}
