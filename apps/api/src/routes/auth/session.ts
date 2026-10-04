import { prisma } from '@workflo/db'
import type { FastifyReply } from 'fastify'
import { loadAgencyMemberships, pickActiveAgencyId } from '../../auth/memberships.js'
import {
  buildAccessClaims,
  coercePermissions,
  issueRefreshToken,
  type Membership,
  type SessionMeta,
  setRefreshCookie,
} from '../../auth/tokens.js'
import { type TwoFactorSetupState, twoFactorSetupState } from '../../services/twoFactorPolicy.js'

/** The `data` block both /auth/login and /auth/2fa/login-verify return on success. */
export interface SessionResponse {
  accessToken: string
  profile: { id: string; email: string; displayName: string; role: string }
  activeCompanyId: string | null
  companies: { id: string; name: string | null; slug: string | null; role: string }[]
  /** 2FA-POLICY: present only when the agency requires TOTP this member lacks. */
  twoFactorSetup?: TwoFactorSetupState
  /** 01-Д: акаунт із тимчасовим паролем — треба змінити. */
  mustChangePassword?: boolean
}

/**
 * Build the full session (access token + refresh cookie + profile/companies block)
 * for an already-authenticated profile. Shared by password login (after the 2FA gate)
 * and the 2FA login-verify step so both mint identical sessions. Returns null if the
 * account vanished/deactivated between the two steps.
 */
export async function issueSessionForProfile(
  reply: FastifyReply,
  profileId: string,
  meta: SessionMeta = {}
): Promise<SessionResponse | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      isActive: true,
      lastActiveAgencyId: true,
      mustChangePassword: true,
    },
  })
  if (!profile || !profile.isActive) return null

  const memberRows = await prisma.companyMember.findMany({
    where: { profileId: profile.id },
    select: {
      companyId: true,
      role: true,
      permissions: true,
      company: { select: { name: true, slug: true, agencyId: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const memberships: Membership[] = memberRows.map((m) => ({
    companyId: m.companyId,
    role: m.role,
    permissions: coercePermissions(m.permissions),
  }))
  const activeCompanyId = memberships[0]?.companyId ?? null

  const agencyMemberships = await loadAgencyMemberships(prisma, profile.id)
  const activeAgencyId =
    (agencyMemberships.length > 0
      ? pickActiveAgencyId(agencyMemberships, profile.lastActiveAgencyId)
      : memberRows.find((m) => m.companyId === activeCompanyId)?.company?.agencyId) ?? null

  // 2FA-POLICY: does an agency of this member require TOTP they don't have yet?
  const twoFactorSetup = await twoFactorSetupState(profile.id, agencyMemberships)

  // Refresh row first — its familyId is the session id (sid) inside the access token.
  const refresh = await issueRefreshToken(prisma, profile.id, meta)
  setRefreshCookie(reply, refresh.token)

  const claims = buildAccessClaims({
    profileId: profile.id,
    email: profile.email,
    role: profile.role,
    activeAgencyId,
    activeCompanyId,
    agencyMemberships,
    memberships,
    sid: refresh.familyId,
    tfaDue: twoFactorSetup.blocking,
  })
  const accessToken = await reply.jwtSign(claims)

  return {
    accessToken,
    profile: {
      id: profile.id,
      email: profile.email,
      displayName: profile.name,
      role: profile.role,
    },
    activeCompanyId,
    companies: memberRows.map((m) => ({
      id: m.companyId,
      name: m.company?.name ?? null,
      slug: m.company?.slug ?? null,
      role: m.role,
    })),
    ...(twoFactorSetup.required ? { twoFactorSetup } : {}),
    // 01-Д: тимчасовий пароль → фронт показує банер «змініть пароль»
    ...(profile.mustChangePassword ? { mustChangePassword: true } : {}),
  }
}
