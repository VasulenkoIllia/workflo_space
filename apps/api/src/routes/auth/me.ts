import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { loadAgencyMemberships } from '../../auth/memberships.js'
import { loadPermissionSnapshot } from '../../auth/permissions.js'
import { coercePermissions } from '../../auth/tokens.js'
import { twoFactorSetupState } from '../../services/twoFactorPolicy.js'

/**
 * GET /auth/me — return the current authenticated user.
 *
 * Loads fresh data from the DB (claims may be stale, e.g. renamed profile or
 * changed memberships). The access token only proves identity (sub).
 */
const meRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const profileId = request.user.sub

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        language: true,
        theme: true,
        isActive: true,
        avatarUrl: true,
        phone: true,
        timezone: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
        pendingEmail: true,
      },
    })

    if (!profile || !profile.isActive) {
      // Token valid but account gone/disabled → treat as unauthenticated.
      throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна', 401)
    }

    const memberRows = await prisma.companyMember.findMany({
      where: { profileId },
      select: {
        companyId: true,
        role: true,
        permissions: true, // PORTAL-MEMBER: права учасника (власник — усі)
        company: { select: { name: true, slug: true } },
      },
      orderBy: { joinedAt: 'asc' },
    })

    // activeCompanyId from the token, validated against current memberships.
    const tokenActive = request.user.activeCompanyId
    const stillMember = memberRows.some((m) => m.companyId === tokenActive)
    const activeCompanyId = stillMember ? tokenActive : (memberRows[0]?.companyId ?? null)

    // Agency (team) tenant + role (ADR-004 / MOD-4). `agencyRole` (owner|manager|executor)
    // is the CANON the workspace gates on — `profile.role` is only a UI hint (modules/01-auth.md).
    // activeAgencyId honours the token's choice if still a current membership, else first.
    const agencyMemberships = await loadAgencyMemberships(prisma, profileId)
    const tokenActiveAgency = request.user.activeAgencyId
    const stillAgencyMember = agencyMemberships.some((m) => m.agencyId === tokenActiveAgency)
    const activeAgencyId = stillAgencyMember
      ? tokenActiveAgency
      : (agencyMemberships[0]?.agencyId ?? null)
    const agencyRole = agencyMemberships.find((m) => m.agencyId === activeAgencyId)?.role ?? null

    // PERM-1: ефективні права в активній агенції — фронт гейтить меню/маршрути/кнопки ними
    // (бек однаково перевіряє кожен роут). permissionRole: owner|manager|lead|executor.
    const perms = activeAgencyId
      ? await loadPermissionSnapshot({ sub: profileId, agencyMemberships }, activeAgencyId)
      : null

    // 2FA-POLICY: banner/forced-setup state for the frontends (fresh on every /me).
    const twoFactorSetup = await twoFactorSetupState(profileId, agencyMemberships)

    return reply.status(200).send({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          displayName: profile.name,
          role: profile.role,
          language: profile.language,
          theme: profile.theme,
          avatarUrl: profile.avatarUrl,
          phone: profile.phone,
          timezone: profile.timezone,
          emailVerified: profile.emailVerifiedAt != null,
        },
        activeCompanyId,
        companies: memberRows.map((m) => ({
          id: m.companyId,
          name: m.company?.name ?? null,
          slug: m.company?.slug ?? null,
          role: m.role,
          permissions: coercePermissions(m.permissions) ?? {},
        })),
        // Agency/team axis — canon for workspace role gating.
        activeAgencyId,
        agencyRole,
        agencyMemberships,
        ...(perms
          ? {
              permissionRole: perms.role === 'executor' && perms.isLead ? 'lead' : perms.role,
              permissions: perms.levels,
            }
          : {}),
        ...(twoFactorSetup.required ? { twoFactorSetup } : {}),
        // 01-Д: тимчасовий пароль → банер «змініть пароль»
        ...(profile.mustChangePassword ? { mustChangePassword: true } : {}),
        // 01-Г: очікує підтвердження зміни email → підказка в налаштуваннях
        ...(profile.pendingEmail ? { pendingEmail: profile.pendingEmail } : {}),
      },
    })
  })

  return Promise.resolve()
}

export default meRoute
