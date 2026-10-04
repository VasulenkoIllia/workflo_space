import { prisma } from '@workflo/db'
import type { AgencyMembership } from '../auth/tokens.js'
import { isEnabled } from './twoFactor.js'

/**
 * 2FA-POLICY (рішення власника 05.07): owner-тумблер «вимагати 2FA у команди».
 *
 * When an agency sets `requireTwoFactorAt`, every INTERNAL member (owner/manager/executor)
 * without TOTP gets a 7-day grace window from that timestamp. Inside the window the
 * frontends show a deadline banner; past it the session claim `tfaDue` flips on and the
 * `authenticate` gate lets only /auth/* through — the next login lands straight on the
 * 2FA setup screen. Portal clients (no agency membership) are never affected.
 */
export const TFA_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export interface TwoFactorSetupState {
  /** Policy applies to this user and they have no 2FA yet (banner / forced setup). */
  required: boolean
  /** ISO deadline (requireTwoFactorAt + grace) — null when not required. */
  deadline: string | null
  /** Grace expired → API access is gated to /auth/* until setup completes. */
  blocking: boolean
}

const NOT_REQUIRED: TwoFactorSetupState = { required: false, deadline: null, blocking: false }

/** Policy state of a profile at session-issue time (login / refresh / agency switch). */
export async function twoFactorSetupState(
  profileId: string,
  agencyMemberships: AgencyMembership[]
): Promise<TwoFactorSetupState> {
  if (agencyMemberships.length === 0) return NOT_REQUIRED // portal client — never gated
  const agencies = await prisma.agency.findMany({
    where: {
      id: { in: agencyMemberships.map((m) => m.agencyId) },
      requireTwoFactorAt: { not: null },
    },
    select: { requireTwoFactorAt: true },
  })
  if (agencies.length === 0) return NOT_REQUIRED
  if (await isEnabled(profileId)) return NOT_REQUIRED

  // Multiple agencies (SaaS-forward): the EARLIEST deadline wins.
  const deadlineMs = Math.min(
    ...agencies.map((a) => (a.requireTwoFactorAt as Date).getTime() + TFA_GRACE_MS)
  )
  return {
    required: true,
    deadline: new Date(deadlineMs).toISOString(),
    blocking: Date.now() > deadlineMs,
  }
}
