import { type Prisma, prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { decryptSecret, encryptSecret, requireKek } from '../../services/credentialCrypto.js'
import {
  isTypedCreateBody,
  revealPayload,
  splitTypedFields,
  typedCreateSchema,
} from '../../services/vaultFields.js'
import { issueRevealGrant, verifyRevealGrant } from '../../services/vaultGrant.js'
import { STEP_UP_FAILURE_MESSAGE, verifyVaultStepUp } from '../../services/vaultStepUp.js'

/**
 * Credentials Vault — PORTAL self-service (17-А «двосторонній ввід» + 17-Б client-facing
 * journal). The client's COMPANY OWNER manages the secrets of their own active company:
 * add (encrypted the same envelope way), reveal (step-up password + throttle, like the
 * workspace), revoke ANY secret («відкликати будь-який доступ у будь-який момент» — канон
 * дизайну), hard-delete only the ones THEY created (agency-added rows are the agency's to
 * delete). Company members (non-owners) never see the vault (`can credentials.*` — ADR-002).
 *
 * Sensitive actions additionally require a VERIFIED EMAIL (the S9 gate deferred exactly to
 * this slice): an unverified fresh signup can look at metadata but cannot create/reveal/
 * revoke/delete until the mailbox is proven.
 *
 * The client journal deliberately omits IP/user-agent — the client sees WHO and WHEN
 * («хто з команди і коли відкривав»), the operational telemetry stays agency-internal.
 */
const createSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    service: z.string().trim().max(60).nullish(),
    url: z.string().trim().max(500).nullish(),
    username: z.string().trim().max(200).nullish(),
    secret: z.string().min(1).max(10000),
    notes: z.string().trim().max(2000).nullish(),
    // 17-РОТАЦІЯ: optional access expiry (ISO)
    expiresAt: z.string().datetime().nullish(),
  })
  .strict()

// TOTP-first step-up (рішення власника 05.07): клієнт із увімкненим 2FA підтверджує
// reveal кодом автентифікатора; без 2FA — пароль-фолбек.
const stepUpSchema = z
  .object({
    password: z.string().min(1).max(200).optional(),
    code: z.string().trim().min(6).max(20).optional(),
  })
  .strict()
  .refine((d) => d.password != null || d.code != null, {
    message: 'Потрібен пароль або код автентифікатора',
  })

// Same anti-exfil budget as the workspace side: 10 reveals / hour per profile.
const REVEAL_MAX_PER_WINDOW = 10
const REVEAL_WINDOW_MS = 60 * 60 * 1000

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
const toDto = (c: ListRow, viewerId: string) => ({
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
  // client can hard-delete only rows they created themselves
  mine: c.createdById === viewerId,
})

/** Active-company + company-owner gate (can credentials.*). Throws 400 / 403. */
function assertVaultAccess(
  user: AccessClaims,
  action: 'credentials.read' | 'credentials.update'
): { agencyId: string; companyId: string } {
  const agencyId = requireActiveAgency(user)
  const companyId = user.activeCompanyId
  if (!companyId) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
  }
  if (!can(user, action, { agencyId, companyId })) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Секрети доступні лише власнику компанії', 403)
  }
  return { agencyId, companyId }
}

/** S9 gate (deferred to this slice): sensitive vault actions need a proven mailbox. */
async function requireVerifiedEmail(profileId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { emailVerifiedAt: true },
  })
  if (!profile?.emailVerifiedAt) {
    throw new AppError(
      ApiErrorCode.FORBIDDEN,
      'Спершу підтвердьте email — лист можна надіслати повторно в Налаштуваннях',
      403
    )
  }
}

const portalCredentialsRoute: FastifyPluginAsync = (fastify) => {
  // ── Step-up: client re-enters password → 5-min reveal grant ──────────────────
  fastify.post(
    '/portal/vault/step-up',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { agencyId } = assertVaultAccess(request.user, 'credentials.read')
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
            metadata: { ip: request.ip, via: 'portal', reason: result.reason },
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

  // ── List: metadata of the active company's secrets (no plaintext) ────────────
  fastify.get(
    '/portal/credentials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { companyId } = assertVaultAccess(request.user, 'credentials.read')
      const rows = await withTenant((tx) =>
        tx.credentialVault.findMany({
          where: { companyId },
          select: LIST_SELECT,
          orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
        })
      )
      return reply.send({
        success: true,
        data: { credentials: rows.map((r) => toDto(r, request.user.sub)) },
      })
    }
  )

  // ── Access journal for one secret (17-Б, client-facing — WHO/WHEN, no IP) ─────
  fastify.get<{ Params: { credId: string } }>(
    '/portal/credentials/:credId/audit',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { companyId } = assertVaultAccess(request.user, 'credentials.read')
      const cred = await withTenant((tx) =>
        tx.credentialVault.findFirst({
          where: { id: request.params.credId, companyId },
          select: { id: true },
        })
      )
      if (!cred) throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
      const rows = await withTenant((tx) =>
        tx.auditLog.findMany({
          where: { resourceType: 'credential', resourceId: request.params.credId },
          select: {
            id: true,
            action: true,
            result: true,
            createdAt: true,
            actor: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      )
      return reply.send({
        success: true,
        data: {
          entries: rows.map((r) => ({
            id: r.id,
            action: r.action,
            result: r.result,
            actorName: r.actor?.name ?? null,
            createdAt: r.createdAt,
          })),
        },
      })
    }
  )

  // ── Create: client adds a secret for the agency (17-А) ───────────────────────
  fastify.post(
    '/portal/credentials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, companyId } = assertVaultAccess(request.user, 'credentials.update')
      await requireVerifiedEmail(request.user.sub)
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
          service: input.resourceType,
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
        metadata: { companyId, label: created.label, via: 'portal' },
      })
      return reply
        .status(201)
        .send({ success: true, data: { credential: toDto(created, request.user.sub) } })
    }
  )

  // ── Reveal: step-up grant + per-profile throttle + audit, never cached ────────
  fastify.post<{ Params: { credId: string } }>(
    '/portal/credentials/:credId/reveal',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, companyId } = assertVaultAccess(request.user, 'credentials.read')
      await requireVerifiedEmail(request.user.sub)

      const { grant } = (request.body ?? {}) as { grant?: unknown }
      if (!verifyRevealGrant(typeof grant === 'string' ? grant : null, request.user.sub)) {
        throw new AppError(
          ApiErrorCode.STEP_UP_REQUIRED,
          'Підтвердьте пароль, щоб показати секрет',
          403
        )
      }

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
          resourceId: request.params.credId,
          result: 'denied',
          metadata: { companyId, ip: request.ip, via: 'portal' },
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
          where: { id: request.params.credId, companyId },
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
        resourceId: request.params.credId,
        result: 'allowed',
        metadata: {
          companyId,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
          via: 'portal',
        },
      })

      void reply.header('Cache-Control', 'no-store')
      // 17-Д: typed rows return the decrypted secret FIELDS; legacy rows the raw string.
      return reply.send({ success: true, data: revealPayload(row.resourceType, secret) })
    }
  )

  // ── Revoke: the client may kill ANY access of their company at any moment ─────
  fastify.post<{ Params: { credId: string } }>(
    '/portal/credentials/:credId/revoke',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, companyId } = assertVaultAccess(request.user, 'credentials.update')
      await requireVerifiedEmail(request.user.sub)

      const updated = await withTenant((tx) =>
        tx.credentialVault.updateMany({
          where: { id: request.params.credId, companyId, revokedAt: null },
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
        resourceId: request.params.credId,
        result: 'allowed',
        metadata: { companyId, via: 'portal' },
      })
      return reply.send({ success: true, data: { revoked: request.params.credId } })
    }
  )

  // ── Expiry (17-РОТАЦІЯ): the client sets/clears the term of any company secret ──
  fastify.patch<{ Params: { credId: string } }>(
    '/portal/credentials/:credId/expiry',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, companyId } = assertVaultAccess(request.user, 'credentials.update')
      await requireVerifiedEmail(request.user.sub)
      const { expiresAt } = z
        .object({ expiresAt: z.string().datetime().nullable() })
        .strict()
        .parse(request.body)

      const updated = await withTenant((tx) =>
        tx.credentialVault.updateMany({
          where: { id: request.params.credId, companyId },
          data: {
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            rotationRemindedAt: null,
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
        resourceId: request.params.credId,
        result: 'allowed',
        metadata: { companyId, field: 'expiresAt', expiresAt, via: 'portal' },
      })
      return reply.send({ success: true, data: { id: request.params.credId, expiresAt } })
    }
  )

  // ── Hard delete: only rows the client created themselves (agency rows stay) ───
  fastify.delete<{ Params: { credId: string } }>(
    '/portal/credentials/:credId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, companyId } = assertVaultAccess(request.user, 'credentials.update')
      await requireVerifiedEmail(request.user.sub)

      const deleted = await withTenant((tx) =>
        tx.credentialVault.deleteMany({
          where: { id: request.params.credId, companyId, createdById: request.user.sub },
        })
      )
      if (deleted.count === 0) {
        // Distinguish «not yours to delete» from «doesn't exist» for an honest error.
        const exists = await withTenant((tx) =>
          tx.credentialVault.findFirst({
            where: { id: request.params.credId, companyId },
            select: { id: true },
          })
        )
        if (exists) {
          throw new AppError(
            ApiErrorCode.FORBIDDEN,
            'Видаляти можна лише секрети, додані вами. Цей додала команда — його можна відкликати.',
            403
          )
        }
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
      }

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.deleted',
        resourceType: 'credential',
        resourceId: request.params.credId,
        result: 'allowed',
        metadata: { companyId, via: 'portal' },
      })
      return reply.send({ success: true, data: { deleted: request.params.credId } })
    }
  )

  return Promise.resolve()
}

export default portalCredentialsRoute
