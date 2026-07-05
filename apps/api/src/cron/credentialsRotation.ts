import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { dispatchNotification } from '../services/notifications.js'

/**
 * Cron (17-РОТАЦІЯ, спека §D): daily cross-tenant sweep — remind agency OWNERS about
 * secrets whose expiresAt is within REMIND_BEFORE (or already past). In-app only
 * (credentials.rotation_due has no email/tg templates by design — a nag, not an alert).
 * Throttle: one reminder per secret per REMIND_EVERY via rotationRemindedAt; setting a
 * new term resets the stamp. Idempotent — a duplicate run re-selects nothing fresh.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const REMIND_BEFORE_MS = 7 * DAY_MS
const REMIND_EVERY_MS = 7 * DAY_MS

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

export async function runCredentialsRotationOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  return runWithSystemContext(async () => {
    const due = await prisma.credentialVault.findMany({
      where: {
        revokedAt: null,
        expiresAt: { not: null, lte: new Date(now.getTime() + REMIND_BEFORE_MS) },
        OR: [
          { rotationRemindedAt: null },
          { rotationRemindedAt: { lt: new Date(now.getTime() - REMIND_EVERY_MS) } },
        ],
      },
      select: {
        id: true,
        agencyId: true,
        companyId: true,
        label: true,
        expiresAt: true,
        company: { select: { name: true } },
      },
      take: 200, // safety cap per sweep
    })
    if (due.length === 0) return 0

    // Owners per agency (one lookup per distinct agency in the batch).
    const agencyIds = [...new Set(due.map((d) => d.agencyId))]
    const owners = await prisma.agencyMember.findMany({
      where: { agencyId: { in: agencyIds }, role: 'owner' },
      select: { agencyId: true, profileId: true },
    })
    const ownersByAgency = new Map<string, string[]>()
    for (const o of owners) {
      ownersByAgency.set(o.agencyId, [...(ownersByAgency.get(o.agencyId) ?? []), o.profileId])
    }

    for (const cred of due) {
      const expiresAt = cred.expiresAt as Date
      const overdue = expiresAt.getTime() <= now.getTime()
      const dateStr = expiresAt.toLocaleDateString('uk-UA')
      for (const profileId of ownersByAgency.get(cred.agencyId) ?? []) {
        dispatchNotification(logger, {
          profileId,
          event: 'credentials.rotation_due',
          vars: { credentialId: cred.id, companyId: cred.companyId, label: cred.label },
          inApp: {
            title: overdue
              ? `Секрет «${cred.label}» протерміновано`
              : `Секрет «${cred.label}» потребує ротації`,
            body: `${cred.company.name}: термін доступу ${overdue ? 'минув' : 'спливає'} ${dateStr}. Оновіть секрет у сховищі та поставте новий термін.`,
          },
        })
      }
      await prisma.credentialVault.update({
        where: { id: cred.id },
        data: { rotationRemindedAt: now },
      })
    }
    logger.info({ reminded: due.length }, 'credentialsRotation: rotation reminders sent')
    return due.length
  })
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    await runCredentialsRotationOnce(logger)
  } catch (err) {
    logger.error({ err }, 'credentialsRotation: run failed')
    captureException(err, { scope: 'cron.credentialsRotation' })
  } finally {
    running = false
  }
}

export function startCredentialsRotationCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  // First sweep ~2 min after boot, then daily.
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), DAY_MS)
    intervalTimer.unref()
  }, 120_000)
  bootTimer.unref()
}

export function stopCredentialsRotationCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
