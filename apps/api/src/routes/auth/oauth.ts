import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, buildDefaultPreferenceRows } from '@workflo/types'
import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { resolvePlatformAgencyId } from '../../auth/agency.js'
import { hashPassword, verifyPassword } from '../../auth/password.js'
import { generateUniqueCompanySlug } from '../../auth/slug.js'
import { issueRefreshToken, setRefreshCookie } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import {
  buildAuthUrl,
  exchangeCode,
  type GoogleIdentity,
  googleOauthConfig,
  type OauthApp,
  signState,
  verifyState,
} from '../../services/googleOauth.js'
import { dispatchNotification } from '../../services/notifications.js'
import { isEnabled } from '../../services/twoFactor.js'
import { signChallenge } from './twoFactor.js'

/**
 * Google OAuth (S9, canon §E). The callback is a top-level browser navigation,
 * so outcomes travel as redirects, never JSON: success plants the refresh
 * cookie and lands on the SPA (its boot flow does refresh→me); failures land
 * on /login?oauthError=<code>; 2FA-enabled profiles get NO session — they land
 * on /login?oauth2fa=<challenge> and finish with a TOTP/backup code exactly
 * like password login.
 */

const appSchema = z.object({ app: z.enum(['portal', 'workspace']).default('portal') })
const providerParamSchema = z.object({ provider: z.enum(['google']) })

function appUrl(app: OauthApp): string {
  return app === 'workspace'
    ? (process.env.WORKSPACE_URL ?? 'https://work.workflo.space')
    : (process.env.PORTAL_URL ?? 'https://portal.workflo.space')
}

function loginRedirect(reply: FastifyReply, app: OauthApp, params: Record<string, string>) {
  const q = new URLSearchParams(params)
  return reply.redirect(`${appUrl(app)}/login?${q.toString()}`, 302)
}

/** Create profile + company + tenant for a first-time Google sign-in. */
async function oauthSignup(
  identity: GoogleIdentity,
  meta: { userAgent: string | null; ip: string }
) {
  // Unusable random password — the mailbox is verified, so forgot-password can
  // mint a real one whenever the user wants password login too.
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url'))
  return tenantTransaction(prisma, async (tx) => {
    const profile = await tx.profile.create({
      data: {
        email: identity.email,
        passwordHash,
        name: identity.name,
        role: 'client',
        language: 'uk',
        theme: 'system',
        isActive: true,
        avatarUrl: identity.picture,
        // Canon §E: OAuth-created accounts are email-verified by construction.
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    })
    const agencyId = await resolvePlatformAgencyId(tx)
    const slug = await generateUniqueCompanySlug(tx, agencyId, identity.name)
    const company = await tx.company.create({
      data: { agencyId, name: identity.name, slug, language: 'uk', currency: 'USD' },
      select: { id: true },
    })
    await tx.companyMember.create({
      data: { companyId: company.id, profileId: profile.id, role: 'owner', permissions: {} },
    })
    const settings = await tx.notificationSettings.create({
      data: { profileId: profile.id, language: 'uk' },
      select: { id: true },
    })
    await tx.notificationPreference.createMany({ data: buildDefaultPreferenceRows(settings.id) })
    await tx.oAuthAccount.create({
      data: {
        profileId: profile.id,
        provider: 'google',
        providerAccountId: identity.providerAccountId,
        email: identity.email,
      },
    })
    const refresh = await issueRefreshToken(tx, profile.id, meta)
    return { profileId: profile.id, refreshToken: refresh.token }
  })
}

const oauthRoute: FastifyPluginAsync = (fastify) => {
  // ── Which providers are configured (frontends hide absent buttons) ───────────
  fastify.get('/auth/oauth/providers', (_request, reply) => {
    return reply.send({ success: true, data: { google: googleOauthConfig() != null } })
  })

  // ── Kick off the flow: redirect the browser to Google ────────────────────────
  fastify.get(
    '/auth/oauth/google',
    { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } },
    (request, reply) => {
      const cfg = googleOauthConfig()
      if (!cfg) {
        throw new AppError(ApiErrorCode.INTERNAL_ERROR, 'Google OAuth не налаштовано', 503)
      }
      const { app } = appSchema.parse(request.query)
      return reply.redirect(buildAuthUrl(cfg, signState({ v: 'login', app })), 302)
    }
  )

  // ── Signed URL for the "link Google" button of a LOGGED-IN user ──────────────
  fastify.get(
    '/auth/oauth/google/link-url',
    { preHandler: [fastify.authenticate] },
    (request, reply) => {
      const cfg = googleOauthConfig()
      if (!cfg) {
        throw new AppError(ApiErrorCode.INTERNAL_ERROR, 'Google OAuth не налаштовано', 503)
      }
      const { app } = appSchema.parse(request.query)
      const url = buildAuthUrl(cfg, signState({ v: 'link', app, p: request.user.sub }))
      return reply.send({ success: true, data: { url } })
    }
  )

  // ── Google sends the browser back here ────────────────────────────────────────
  fastify.get(
    '/auth/oauth/google/callback',
    { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const cfg = googleOauthConfig()
      if (!cfg) {
        throw new AppError(ApiErrorCode.INTERNAL_ERROR, 'Google OAuth не налаштовано', 503)
      }
      const q = request.query as { code?: string; state?: string; error?: string }
      const state = q.state ? verifyState(q.state) : null
      if (!state) {
        // Forged/expired state — no app context to trust, land on the portal.
        return loginRedirect(reply, 'portal', { oauthError: 'state' })
      }
      if (q.error || !q.code) {
        return loginRedirect(reply, state.app, { oauthError: 'denied' })
      }
      const identity = await exchangeCode(cfg, q.code)
      if (!identity) {
        return loginRedirect(reply, state.app, { oauthError: 'exchange' })
      }

      const linked = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: identity.providerAccountId,
          },
        },
        select: { profileId: true },
      })

      // ── Link intent: attach this Google identity to the logged-in profile ────
      if (state.v === 'link') {
        const profileId = state.p
        if (!profileId) return loginRedirect(reply, state.app, { oauthError: 'state' })
        if (linked && linked.profileId !== profileId) {
          return reply.redirect(`${appUrl(state.app)}/settings?oauthError=taken`, 302)
        }
        if (!linked) {
          await prisma.oAuthAccount.create({
            data: {
              profileId,
              provider: 'google',
              providerAccountId: identity.providerAccountId,
              email: identity.email,
            },
          })
          writeAuditAsync(request.log, {
            actorId: profileId,
            action: 'auth.oauth_linked',
            resourceType: 'profile',
            resourceId: profileId,
            result: 'allowed',
            metadata: { provider: 'google', ip: request.ip },
          })
        }
        return reply.redirect(`${appUrl(state.app)}/settings?oauthLinked=1`, 302)
      }

      // ── Login intent ──────────────────────────────────────────────────────────
      const meta = { userAgent: request.headers['user-agent'] ?? null, ip: request.ip }
      let profileId: string

      if (linked) {
        profileId = linked.profileId
      } else {
        const existing = await prisma.profile.findUnique({
          where: { email: identity.email },
          select: { id: true },
        })
        if (existing) {
          // Auto-link is safe ONLY when Google itself vouches for the address —
          // otherwise anyone could mint a Google account over a victim's email.
          if (!identity.emailVerified) {
            return loginRedirect(reply, state.app, { oauthError: 'unverified' })
          }
          await prisma.oAuthAccount.create({
            data: {
              profileId: existing.id,
              provider: 'google',
              providerAccountId: identity.providerAccountId,
              email: identity.email,
            },
          })
          // Google proved the mailbox → also counts as email verification (S9).
          await prisma.profile.updateMany({
            where: { id: existing.id, emailVerifiedAt: null },
            data: { emailVerifiedAt: new Date() },
          })
          writeAuditAsync(request.log, {
            actorId: existing.id,
            action: 'auth.oauth_autolinked',
            resourceType: 'profile',
            resourceId: existing.id,
            result: 'allowed',
            metadata: { provider: 'google', ip: request.ip },
          })
          profileId = existing.id
        } else {
          if (!identity.emailVerified) {
            return loginRedirect(reply, state.app, { oauthError: 'unverified' })
          }
          const created = await oauthSignup(identity, meta)
          dispatchNotification(request.log, {
            profileId: created.profileId,
            event: 'auth.welcome',
            vars: { portalUrl: process.env.PORTAL_URL ?? 'https://portal.workflo.space' },
          })
          writeAuditAsync(request.log, {
            actorId: created.profileId,
            action: 'auth.oauth_signup',
            resourceType: 'profile',
            resourceId: created.profileId,
            result: 'allowed',
            metadata: { provider: 'google', ip: request.ip },
          })
          setRefreshCookie(reply, created.refreshToken)
          return reply.redirect(`${appUrl(state.app)}/?oauth=ok`, 302)
        }
      }

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { isActive: true },
      })
      if (!profile || !profile.isActive) {
        return loginRedirect(reply, state.app, { oauthError: 'inactive' })
      }

      // 2FA gate — identical to password login: NO session, only a challenge.
      if (await isEnabled(profileId)) {
        writeAuditAsync(request.log, {
          actorId: profileId,
          action: 'auth.2fa_challenge_issued',
          resourceType: 'profile',
          resourceId: profileId,
          result: 'allowed',
          metadata: { ip: request.ip, via: 'oauth' },
        })
        return loginRedirect(reply, state.app, { oauth2fa: signChallenge(profileId) })
      }

      const refresh = await issueRefreshToken(prisma, profileId, meta)
      setRefreshCookie(reply, refresh.token)
      writeAuditAsync(request.log, {
        actorId: profileId,
        action: 'auth.login_success',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { ip: request.ip, via: 'oauth' },
      })
      return reply.redirect(`${appUrl(state.app)}/?oauth=ok`, 302)
    }
  )

  // ── Linked identities of the current user (settings card) ────────────────────
  fastify.get(
    '/auth/oauth/accounts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const rows = await prisma.oAuthAccount.findMany({
        where: { profileId: request.user.sub },
        select: { provider: true, email: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      return reply.send({ success: true, data: { accounts: rows } })
    }
  )

  // ── Unlink. Canon: never drop the last way in — password re-auth proves the
  //    user still holds a working password, so ≥1 method remains by definition.
  fastify.delete(
    '/auth/oauth/:provider',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { provider } = providerParamSchema.parse(request.params)
      const { password } = z.object({ password: z.string().min(1) }).parse(request.body ?? {})
      const profile = await prisma.profile.findUnique({
        where: { id: request.user.sub },
        select: { passwordHash: true },
      })
      if (!profile || !(await verifyPassword(password, profile.passwordHash))) {
        throw new AppError(
          ApiErrorCode.UNAUTHORIZED,
          'Невірний пароль — щоб відʼєднати Google, потрібен робочий пароль',
          401
        )
      }
      const deleted = await prisma.oAuthAccount.deleteMany({
        where: { profileId: request.user.sub, provider },
      })
      if (deleted.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Акаунт не привʼязано', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'auth.oauth_unlinked',
        resourceType: 'profile',
        resourceId: request.user.sub,
        result: 'allowed',
        metadata: { provider, ip: request.ip },
      })
      return reply.send({ success: true, data: { unlinked: true } })
    }
  )

  return Promise.resolve()
}

export default oauthRoute
