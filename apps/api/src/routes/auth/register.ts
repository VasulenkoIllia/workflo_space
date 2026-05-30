import { Prisma, prisma } from '@workflo/db'
import { ApiErrorCode, AppError, registerSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { resolvePlatformAgencyId } from '../../auth/agency.js'
import { hashPassword } from '../../auth/password.js'
import { generateUniqueCompanySlug } from '../../auth/slug.js'
import {
  buildAccessClaims,
  issueRefreshToken,
  type Membership,
  setRefreshCookie,
} from '../../auth/tokens.js'
import { dispatchNotification } from '../../services/notifications.js'

const NOTIFICATION_CATEGORIES = [
  'auth',
  'orders',
  'chat',
  'billing',
  'documents',
  'loyalty',
  'system',
] as const
const NOTIFICATION_DEFAULT_CHANNELS = ['email', 'telegram', 'in_app'] as const

function defaultPreferenceRows(settingsId: string) {
  const rows: Array<{ settingsId: string; category: string; channel: string; enabled: boolean }> =
    []
  for (const category of NOTIFICATION_CATEGORIES) {
    for (const channel of NOTIFICATION_DEFAULT_CHANNELS) {
      rows.push({ settingsId, category, channel, enabled: true })
    }
  }
  return rows
}

const registerRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/register',
    {
      config: {
        // Tighter than the global limit: registration is a sensitive,
        // abuse-prone endpoint.
        rateLimit: { max: 10, timeWindow: '15 minutes' },
      },
    },
    async (request, reply) => {
      const input = registerSchema.parse(request.body)
      const email = input.email.toLowerCase().trim()

      const existing = await prisma.profile.findUnique({ where: { email }, select: { id: true } })
      if (existing) {
        throw new AppError(ApiErrorCode.CONFLICT, 'Користувач з таким email вже існує', 409)
      }

      const passwordHash = await hashPassword(input.password)

      let result: {
        profileId: string
        companyId: string
        companyName: string
        companySlug: string
        agencyId: string
        refreshToken: string
      }

      try {
        result = await prisma.$transaction(async (tx) => {
          const profile = await tx.profile.create({
            data: {
              email,
              passwordHash,
              name: input.displayName.trim(),
              role: 'client',
              language: 'uk',
              theme: 'system',
              isActive: true,
            },
            select: { id: true },
          })

          const slug = await generateUniqueCompanySlug(tx, input.companyName)
          // Multi-tenancy (ADR-004): attach the new client company to the
          // platform agency (Phase 0 = single tenant).
          const agencyId = await resolvePlatformAgencyId(tx)
          const company = await tx.company.create({
            data: {
              agencyId,
              name: input.companyName.trim(),
              slug,
              language: 'uk',
              currency: 'USD',
            },
            select: { id: true, name: true, slug: true },
          })

          await tx.companyMember.create({
            data: {
              companyId: company.id,
              profileId: profile.id,
              role: 'owner',
              permissions: {},
            },
          })

          const settings = await tx.notificationSettings.create({
            data: { profileId: profile.id, language: 'uk' },
            select: { id: true },
          })
          await tx.notificationPreference.createMany({
            data: defaultPreferenceRows(settings.id),
          })

          const refresh = await issueRefreshToken(tx, profile.id)

          return {
            profileId: profile.id,
            companyId: company.id,
            companyName: company.name,
            companySlug: company.slug,
            agencyId,
            refreshToken: refresh.token,
          }
        })
      } catch (err) {
        // Unique-violation fallback (race on email or slug between check and insert).
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Користувач або компанія з такими даними вже існує',
            409
          )
        }
        throw err
      }

      const memberships: Membership[] = [{ companyId: result.companyId, role: 'owner' }]
      const claims = buildAccessClaims({
        profileId: result.profileId,
        email,
        role: 'client',
        activeAgencyId: result.agencyId,
        activeCompanyId: result.companyId,
        agencyMemberships: [],
        memberships,
      })
      const accessToken = await reply.jwtSign(claims)

      setRefreshCookie(reply, result.refreshToken)

      // Fire-and-forget welcome notification (never blocks the response).
      dispatchNotification(request.log, {
        profileId: result.profileId,
        event: 'auth.welcome',
        vars: { portalUrl: process.env.PORTAL_URL ?? 'https://portal.workflo.space' },
      })

      return reply.status(201).send({
        success: true,
        data: {
          accessToken,
          profile: {
            id: result.profileId,
            email,
            displayName: input.displayName.trim(),
            role: 'client',
          },
          company: {
            id: result.companyId,
            name: result.companyName,
            slug: result.companySlug,
            role: 'owner',
          },
        },
      })
    }
  )

  return Promise.resolve()
}

export default registerRoute
