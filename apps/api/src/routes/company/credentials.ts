import { prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { AccessClaims } from '../../auth/tokens.js'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { verifyPassword } from '../../auth/password.js'
import { writeAuditAsync } from '../../services/audit.js'
import { decryptSecret, encryptSecret, requireKek } from '../../services/credentialCrypto.js'
import { issueRevealGrant, verifyRevealGrant } from '../../services/vaultGrant.js'

/**
 * Credentials Vault (module 17) — agency-side. Envelope-encrypted secrets bound to a CLIENT
 * company (CRM logins, API keys, FTP…). Sensitive → agency OWNER only (executors never, even
 * on assigned orders), tenant-scoped (company must belong to the active agency → 404). Listing
 * never returns plaintext; a dedicated `/reveal` decrypts one secret (audit-logged, rate-limited,
 * no-store). MVP slice — deferred to follow-ups: 2FA challenge on reveal, executor scoped-share,
 * rotation reminders, portal self-service, global cross-client view.
 */
const createSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    service: z.string().trim().max(60).optional(),
    url: z.string().trim().max(500).optional(),
    username: z.string().trim().max(200).optional(),
    secret: z.string().min(1).max(10000),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()

const stepUpSchema = z.object({ password: z.string().min(1).max(200) }).strict()

// Per-owner reveal throttle (module 17 §133): 10 reveals / hour, keyed on the owner (not IP, which
// would lock out co-located owners). Counted over the owner's own committed reveal audit rows;
// best-effort (audit writes are async, so a sub-second burst may slip a couple past the cap — fine
// for a slow-exfil guard, and step-up already blocks reveal without the password).
const REVEAL_MAX_PER_WINDOW = 10
const REVEAL_WINDOW_MS = 60 * 60 * 1000

// Plain metadata only — never the ciphertext or envelope bytes.
const LIST_SELECT = {
  id: true,
  label: true,
  service: true,
  url: true,
  username: true,
  notes: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
} as const

type ListRow = {
  id: string
  label: string
  service: string | null
  url: string | null
  username: string | null
  notes: string | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdById: string
}
const toDto = (c: ListRow) => ({
  id: c.id,
  label: c.label,
  service: c.service,
  url: c.url,
  username: c.username,
  notes: c.notes,
  revoked: c.revokedAt != null,
  revokedAt: c.revokedAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
})

/** Owner-gate + tenant-guard shared by every handler. Throws 403 / 404. */
async function assertOwnerCompany(user: AccessClaims, companyId: string) {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції має доступ до секретів', 403)
  }
  const company = await withTenant((tx) =>
    tx.company.findFirst({ where: { id: companyId, agencyId }, select: { id: true } })
  )
  if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
  return agencyId
}

const credentialsRoute: FastifyPluginAsync = (fastify) => {
  // ── Global vault (17-ГЛОБАЛ): all secrets across the agency's clients, metadata only ──
  // Same table + reveal path, just an agency-wide view; each row carries its companyId so the
  // client-side reveal/revoke/delete can route back to the per-company endpoints. Owner-only.
  fastify.get(
    '/workspace/vault',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isAgencyOwner(request.user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції має доступ до секретів',
          403
        )
      }
      const rows = await withTenant((tx) =>
        tx.credentialVault.findMany({
          where: { agencyId },
          select: { ...LIST_SELECT, companyId: true, company: { select: { name: true } } },
          orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
        })
      )
      return reply.send({
        success: true,
        data: {
          credentials: rows.map((r) => ({
            ...toDto(r),
            companyId: r.companyId,
            companyName: r.company.name,
          })),
        },
      })
    }
  )

  // ── Step-up: re-enter password → short-lived reveal grant (2FA-on-reveal) ──────
  // Owner re-proves identity; success mints a 5-min grant the reveal endpoint requires. A
  // borrowed session alone can't exfiltrate plaintext without the password. Rate-limited to
  // blunt password guessing.
  fastify.post(
    '/workspace/vault/step-up',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isAgencyOwner(request.user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції має доступ до секретів',
          403
        )
      }
      const { password } = stepUpSchema.parse(request.body)

      const profile = await prisma.profile.findUnique({
        where: { id: request.user.sub },
        select: { passwordHash: true },
      })
      const ok = profile ? await verifyPassword(password, profile.passwordHash) : false
      if (!ok) {
        writeAuditAsync(request.log, {
          actorId: request.user.sub,
          agencyId,
          action: 'credentials.step_up_failed',
          resourceType: 'profile',
          resourceId: request.user.sub,
          result: 'denied',
          metadata: { ip: request.ip },
        })
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Невірний пароль', 401)
      }

      const { grant, expiresAt } = issueRevealGrant(request.user.sub)
      void reply.header('Cache-Control', 'no-store')
      return reply.send({ success: true, data: { grant, expiresAt } })
    }
  )

  // ── List (metadata only, no plaintext) ────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/clients/:id/credentials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const companyId = request.params.id
      await assertOwnerCompany(request.user, companyId)
      const rows = await withTenant((tx) =>
        tx.credentialVault.findMany({
          where: { companyId },
          select: LIST_SELECT,
          orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
        })
      )
      return reply.send({ success: true, data: { credentials: rows.map(toDto) } })
    }
  )

  // ── Access journal for one secret (17-Б, owner-facing) ─────────────────────────
  // Read-only over audit_logs (credentials.* actions already carry actor + IP). Answers
  // "хто з команди і коли відкривав/змінював цей секрет". No new store — RLS-scoped.
  fastify.get<{ Params: { id: string; credId: string } }>(
    '/workspace/clients/:id/credentials/:credId/audit',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: companyId, credId } = request.params
      await assertOwnerCompany(request.user, companyId)
      // The secret must belong to THIS company (else an owner could read the journal of a
      // credential from another of their client companies by pairing an owned companyId with a
      // foreign credId). Mirrors the reveal/revoke/delete existence check.
      const cred = await withTenant((tx) =>
        tx.credentialVault.findFirst({ where: { id: credId, companyId }, select: { id: true } })
      )
      if (!cred) throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
      const rows = await withTenant((tx) =>
        tx.auditLog.findMany({
          where: { resourceType: 'credential', resourceId: credId },
          select: {
            id: true,
            action: true,
            result: true,
            createdAt: true,
            actorId: true,
            actor: { select: { name: true } },
            metadata: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      )
      const entries = rows.map((r) => ({
        id: r.id,
        action: r.action,
        result: r.result,
        actorId: r.actorId,
        actorName: r.actor?.name ?? null,
        ip: (r.metadata as { ip?: string } | null)?.ip ?? null,
        createdAt: r.createdAt,
      }))
      return reply.send({ success: true, data: { entries } })
    }
  )

  // ── Create (encrypts the secret before store) ──────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/clients/:id/credentials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const companyId = request.params.id
      const agencyId = await assertOwnerCompany(request.user, companyId)
      const input = createSchema.parse(request.body)
      const kek = requireKek()
      const enc = encryptSecret(input.secret, kek)

      const created = await withTenant((tx) =>
        tx.credentialVault.create({
          data: {
            agencyId,
            companyId,
            label: input.label,
            service: input.service ?? null,
            url: input.url ?? null,
            username: input.username ?? null,
            notes: input.notes ?? null,
            createdById: request.user.sub,
            ...enc,
          },
          select: LIST_SELECT,
        })
      )

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.created',
        resourceType: 'credential',
        resourceId: created.id,
        result: 'allowed',
        // Never the secret — label only.
        metadata: { companyId, label: created.label },
      })
      return reply.status(201).send({ success: true, data: { credential: toDto(created) } })
    }
  )

  // ── Reveal (decrypt one secret; owner-throttled + audit-logged, never cached) ───
  fastify.post<{ Params: { id: string; credId: string } }>(
    '/workspace/clients/:id/credentials/:credId/reveal',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: companyId, credId } = request.params
      const agencyId = await assertOwnerCompany(request.user, companyId)

      // Step-up gate (2FA-on-reveal): a live password grant is required before any decrypt.
      // 403 (not 401) so the API client doesn't mistake it for session-expiry and refresh/logout.
      const { grant } = (request.body ?? {}) as { grant?: unknown }
      if (!verifyRevealGrant(typeof grant === 'string' ? grant : null, request.user.sub)) {
        throw new AppError(
          ApiErrorCode.STEP_UP_REQUIRED,
          'Підтвердьте пароль, щоб показати секрет',
          403
        )
      }

      // Per-owner reveal throttle (anti-exfil) — keyed on the owner, not IP.
      const revealsThisWindow = await withTenant((tx) =>
        tx.auditLog.count({
          where: {
            actorId: request.user.sub,
            action: 'credentials.revealed',
            createdAt: { gte: new Date(Date.now() - REVEAL_WINDOW_MS) },
          },
        })
      )
      if (revealsThisWindow >= REVEAL_MAX_PER_WINDOW) {
        writeAuditAsync(request.log, {
          actorId: request.user.sub,
          agencyId,
          action: 'credentials.reveal_rate_limited',
          resourceType: 'credential',
          resourceId: credId,
          result: 'denied',
          metadata: { companyId, ip: request.ip },
        })
        throw new AppError(
          ApiErrorCode.RATE_LIMITED,
          'Забагато переглядів секретів. Спробуйте за годину.',
          429
        )
      }

      const kek = requireKek()

      const row = await withTenant((tx) =>
        tx.credentialVault.findFirst({
          where: { id: credId, companyId },
          select: {
            id: true,
            revokedAt: true,
            encryptedDek: true,
            dekIv: true,
            dekAuthTag: true,
            ciphertext: true,
            ciphertextIv: true,
            ciphertextAuthTag: true,
          },
        })
      )
      if (!row) throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
      if (row.revokedAt != null) {
        throw new AppError(ApiErrorCode.CONFLICT, 'Секрет відкликано — reveal заборонено', 409)
      }

      const secret = decryptSecret(row, kek)

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.revealed',
        resourceType: 'credential',
        resourceId: credId,
        result: 'allowed',
        metadata: { companyId, ip: request.ip, userAgent: request.headers['user-agent'] ?? null },
      })

      // Secrets must never be cached by any intermediary or the browser.
      void reply.header('Cache-Control', 'no-store')
      return reply.send({ success: true, data: { secret } })
    }
  )

  // ── Revoke (soft — keeps history, blocks future reveals) ────────────────────────
  fastify.post<{ Params: { id: string; credId: string } }>(
    '/workspace/clients/:id/credentials/:credId/revoke',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: companyId, credId } = request.params
      const agencyId = await assertOwnerCompany(request.user, companyId)

      const updated = await withTenant((tx) =>
        tx.credentialVault.updateMany({
          where: { id: credId, companyId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено або вже відкликано', 404)
      }

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.revoked',
        resourceType: 'credential',
        resourceId: credId,
        result: 'allowed',
        metadata: { companyId },
      })
      return reply.send({ success: true, data: { revoked: credId } })
    }
  )

  // ── Hard delete ─────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string; credId: string } }>(
    '/workspace/clients/:id/credentials/:credId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: companyId, credId } = request.params
      const agencyId = await assertOwnerCompany(request.user, companyId)

      const deleted = await withTenant((tx) =>
        tx.credentialVault.deleteMany({ where: { id: credId, companyId } })
      )
      if (deleted.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
      }

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.deleted',
        resourceType: 'credential',
        resourceId: credId,
        result: 'allowed',
        metadata: { companyId },
      })
      return reply.send({ success: true, data: { deleted: credId } })
    }
  )

  return Promise.resolve()
}

export default credentialsRoute
