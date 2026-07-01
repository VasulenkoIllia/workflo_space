import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { AccessClaims } from '../../auth/tokens.js'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { decryptSecret, encryptSecret, requireKek } from '../../services/credentialCrypto.js'

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

  // ── Reveal (decrypt one secret; rate-limited + audit-logged, never cached) ──────
  fastify.post<{ Params: { id: string; credId: string } }>(
    '/workspace/clients/:id/credentials/:credId/reveal',
    {
      preHandler: [fastify.authenticate],
      // Coarse IP-based throttle against bulk exfiltration; precise per-(owner,company)
      // keying is a follow-up (rate-limit runs before authenticate, so no request.user yet).
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { id: companyId, credId } = request.params
      const agencyId = await assertOwnerCompany(request.user, companyId)
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
