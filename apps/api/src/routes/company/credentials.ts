import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { type AccessClaims, isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { STEP_UP_FAILURE_MESSAGE, verifyVaultStepUp } from '../../services/vaultStepUp.js'
import { decryptSecret, encryptSecret, requireKek } from '../../services/credentialCrypto.js'
import {
  isTypedCreateBody,
  revealPayload,
  splitTypedFields,
  typedCreateSchema,
} from '../../services/vaultFields.js'
import { issueRevealGrant, verifyRevealGrant } from '../../services/vaultGrant.js'
import {
  executorShareMap,
  resolveVaultScope,
  scopeCoversCredential,
} from '../../services/vaultShareAccess.js'

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
    // nullish (not just optional): фронт шле `null` для порожніх опційних полів
    // (порожнє → null), а null — валідне «немає значення» для цих nullable-колонок.
    service: z.string().trim().max(60).nullish(),
    url: z.string().trim().max(500).nullish(),
    username: z.string().trim().max(200).nullish(),
    secret: z.string().min(1).max(10000),
    notes: z.string().trim().max(2000).nullish(),
    // 17-РОТАЦІЯ: optional access expiry (ISO)
    expiresAt: z.string().datetime().nullish(),
  })
  .strict()

// TOTP-first step-up (рішення власника 05.07): у кого 2FA увімкнено — reveal вимагає
// код автентифікатора (або backup-код), інакше лишається пароль-фолбек.
const stepUpSchema = z
  .object({
    password: z.string().min(1).max(200).optional(),
    code: z.string().trim().min(6).max(20).optional(),
  })
  .strict()
  .refine((d) => d.password != null || d.code != null, {
    message: 'Потрібен пароль або код автентифікатора',
  })

// Per-owner reveal throttle (module 17 §133): 10 reveals / hour, keyed on the owner (not IP, which
// would lock out co-located owners). Counted over the owner's own committed reveal audit rows;
// best-effort (audit writes are async, so a sub-second burst may slip a couple past the cap — fine
// for a slow-exfil guard, and step-up already blocks reveal without the password).
const REVEAL_MAX_PER_WINDOW = 10
const REVEAL_WINDOW_MS = 60 * 60 * 1000

// Plain metadata only — never the ciphertext or envelope bytes. publicFields are the
// NON-secret fields of a typed card (17-Д) — plain by definition.
const LIST_SELECT = {
  id: true,
  label: true,
  service: true,
  url: true,
  username: true,
  resourceType: true,
  publicFields: true,
  notes: true,
  expiresAt: true,
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
  resourceType: string | null
  publicFields: unknown
  notes: string | null
  expiresAt: Date | null
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
  resourceType: c.resourceType,
  publicFields: c.publicFields ?? null,
  notes: c.notes,
  expiresAt: c.expiresAt,
  revoked: c.revokedAt != null,
  revokedAt: c.revokedAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
})

/** Owner-gate + tenant-guard shared by every WRITE handler. Throws 403 / 404. */
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

/** READ-gate (17-SHARE): owner → all; executor → their share scope; others → 403.
 * Returns the scope so list/reveal can filter. Throws 403 / 404. */
async function assertReadCompany(user: AccessClaims, companyId: string) {
  const agencyId = requireActiveAgency(user)
  const company = await withTenant((tx) =>
    tx.company.findFirst({ where: { id: companyId, agencyId }, select: { id: true } })
  )
  if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
  const scope = await resolveVaultScope(user, companyId)
  // An executor WITHOUT shares still gets an empty list (graceful 360°-tab), but a
  // client/manager gets a hard 403 — the workspace vault is not their surface.
  if (scope === null && !(isInternalTeam(user) && !isAgencyManager(user, agencyId))) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до секретів', 403)
  }
  return { agencyId, scope }
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
      // 17-SHARE: owner sees everything; an executor sees the union of their shares
      // (whole-company grants + point grants); manager/client — nothing.
      let shareFilter: object | null = null
      if (!isAgencyOwner(request.user, agencyId)) {
        const map = await executorShareMap(request.user)
        if (!map) {
          throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до секретів', 403)
        }
        shareFilter = {
          OR: [
            ...(map.companyIds.length > 0 ? [{ companyId: { in: map.companyIds } }] : []),
            ...(map.credentialIds.length > 0 ? [{ id: { in: map.credentialIds } }] : []),
          ],
        }
        // no shares at all → honest empty vault, not a 403 (nav stays usable)
        if (map.companyIds.length === 0 && map.credentialIds.length === 0) {
          return reply.send({ success: true, data: { credentials: [] } })
        }
      }
      const rows = await withTenant((tx) =>
        tx.credentialVault.findMany({
          where: { agencyId, ...(shareFilter ?? {}) },
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
      // 17-SHARE: executors with shares need grants too — manager stays blocked (canon).
      if (!isInternalTeam(request.user) || isAgencyManager(request.user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до секретів', 403)
      }
      const input = stepUpSchema.parse(request.body)

      const result = await verifyVaultStepUp(request.user.sub, input)
      if (!result.ok) {
        const fail = STEP_UP_FAILURE_MESSAGE[result.reason]
        if (fail.status === 401) {
          writeAuditAsync(request.log, {
            actorId: request.user.sub,
            agencyId,
            action: 'credentials.step_up_failed',
            resourceType: 'profile',
            resourceId: request.user.sub,
            result: 'denied',
            metadata: { ip: request.ip, reason: result.reason },
          })
        }
        throw new AppError(
          fail.status === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.VALIDATION_ERROR,
          fail.message,
          fail.status
        )
      }

      const { grant, expiresAt } = issueRevealGrant(request.user.sub)
      void reply.header('Cache-Control', 'no-store')
      return reply.send({ success: true, data: { grant, expiresAt } })
    }
  )

  // ── List (metadata only, no plaintext; 17-SHARE: executor sees their scope) ────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/clients/:id/credentials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const companyId = request.params.id
      const { scope } = await assertReadCompany(request.user, companyId)
      if (scope === null) {
        // executor without any share on this client — graceful empty tab
        return reply.send({ success: true, data: { credentials: [] } })
      }
      const rows = await withTenant((tx) =>
        tx.credentialVault.findMany({
          where: {
            companyId,
            ...(scope.kind === 'subset' ? { id: { in: scope.credentialIds } } : {}),
          },
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
      const kek = requireKek()

      // 17-Д: typed card (resourceType + fields[]) or legacy freeform (single secret).
      let data: Omit<
        Prisma.CredentialVaultUncheckedCreateInput,
        'agencyId' | 'companyId' | 'createdById'
      >
      if (isTypedCreateBody(request.body)) {
        const input = typedCreateSchema.parse(request.body)
        const { publicFields, secretPlaintext } = splitTypedFields(input.fields)
        data = {
          label: input.label,
          service: input.resourceType, // keeps the /vault service filter meaningful
          resourceType: input.resourceType,
          // interface → Prisma JSON input (interfaces lack the implicit index signature)
          publicFields: publicFields as unknown as Prisma.InputJsonValue,
          notes: input.notes ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          ...encryptSecret(secretPlaintext, kek),
        }
      } else {
        const input = createSchema.parse(request.body)
        data = {
          label: input.label,
          service: input.service ?? null,
          url: input.url ?? null,
          username: input.username ?? null,
          notes: input.notes ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          ...encryptSecret(input.secret, kek),
        }
      }

      const created = await withTenant((tx) =>
        tx.credentialVault.create({
          data: {
            agencyId,
            companyId,
            createdById: request.user.sub,
            ...data,
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
      // 17-SHARE: reveal opens for executors within their share scope.
      const { agencyId, scope } = await assertReadCompany(request.user, companyId)
      if (!scopeCoversCredential(scope, credId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до цього секрету', 403)
      }

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
            resourceType: true,
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
      // 17-Д: typed rows return the decrypted secret FIELDS; legacy rows the raw string.
      return reply.send({ success: true, data: revealPayload(row.resourceType, secret) })
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

  // ── Expiry (17-РОТАЦІЯ): set/clear the access term; resets the reminder window ──
  fastify.patch<{ Params: { id: string; credId: string } }>(
    '/workspace/clients/:id/credentials/:credId/expiry',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: companyId, credId } = request.params
      const agencyId = await assertOwnerCompany(request.user, companyId)
      const { expiresAt } = z
        .object({ expiresAt: z.string().datetime().nullable() })
        .strict()
        .parse(request.body)

      const updated = await withTenant((tx) =>
        tx.credentialVault.updateMany({
          where: { id: credId, companyId },
          data: {
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            rotationRemindedAt: null, // new term → new reminder window
          },
        })
      )
      if (updated.count === 0) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.updated',
        resourceType: 'credential',
        resourceId: credId,
        result: 'allowed',
        metadata: { companyId, field: 'expiresAt', expiresAt },
      })
      return reply.send({ success: true, data: { id: credId, expiresAt } })
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
