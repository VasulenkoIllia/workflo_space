import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * 17-SHARE management (owner-only): grant / list / revoke executor access to the vault.
 * A grant targets EITHER one credential (point share) OR a whole client company («всі
 * секрети клієнта», covers future secrets). Indefinite until revoked — owner decision
 * 05.07 (expiresAt stays in the model for the spec's auto-expiry, not issued here).
 * The read-side enforcement lives in services/vaultShareAccess.ts.
 */
const createShareSchema = z
  .object({
    executorId: z.string().min(1),
    credentialId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
  })
  .strict()
  .refine((d) => (d.credentialId != null) !== (d.companyId != null), {
    message: 'Вкажіть або credentialId (точковий доступ), або companyId (всі секрети клієнта)',
  })

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступи виконавцям видає лише власник', 403)
  }
  return agencyId
}

const SHARE_SELECT = {
  id: true,
  credentialId: true,
  companyId: true,
  executorId: true,
  grantedById: true,
  createdAt: true,
} as const

const listQuerySchema = z.object({
  companyId: z.string().min(1).optional(),
  credentialId: z.string().min(1).optional(),
})

const vaultSharesRoute: FastifyPluginAsync = (fastify) => {
  // ── List active shares (owner UI: «хто має доступ») ──────────────────────────
  fastify.get(
    '/workspace/vault/shares',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const q = listQuerySchema.parse(request.query)
      const rows = await withTenant((tx) =>
        tx.credentialShare.findMany({
          where: {
            agencyId,
            revokedAt: null,
            ...(q.credentialId ? { credentialId: q.credentialId } : {}),
            // company filter matches BOTH kinds: wholesale grants for the company and
            // point grants on its credentials.
            ...(q.companyId
              ? {
                  OR: [{ companyId: q.companyId }, { credential: { companyId: q.companyId } }],
                }
              : {}),
          },
          select: SHARE_SELECT,
          orderBy: { createdAt: 'desc' },
        })
      )
      return reply.send({ success: true, data: { shares: rows } })
    }
  )

  // ── Grant ─────────────────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/vault/shares',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const input = createShareSchema.parse(request.body)

      const share = await withTenant(async (tx) => {
        // Target must be an EXECUTOR of this agency (managers are credential-blocked by
        // canon; owners don't need shares).
        const member = await tx.agencyMember.findFirst({
          where: { agencyId, profileId: input.executorId, role: 'executor' },
          select: { id: true },
        })
        if (!member) {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Одержувач має бути виконавцем цієї агенції',
            400
          )
        }

        // Tenant-guard the target: the credential/company must belong to this agency.
        if (input.credentialId) {
          const cred = await tx.credentialVault.findFirst({
            where: { id: input.credentialId, agencyId },
            select: { id: true },
          })
          if (!cred) throw new AppError(ApiErrorCode.NOT_FOUND, 'Секрет не знайдено', 404)
        } else if (input.companyId) {
          const company = await tx.company.findFirst({
            where: { id: input.companyId, agencyId },
            select: { id: true },
          })
          if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }

        // Idempotency: an identical ACTIVE grant already exists → 409.
        const dup = await tx.credentialShare.findFirst({
          where: {
            agencyId,
            executorId: input.executorId,
            revokedAt: null,
            credentialId: input.credentialId ?? null,
            companyId: input.companyId ?? null,
          },
          select: { id: true },
        })
        if (dup) {
          throw new AppError(ApiErrorCode.CONFLICT, 'Такий доступ уже видано', 409)
        }

        return tx.credentialShare.create({
          data: {
            agencyId,
            credentialId: input.credentialId ?? null,
            companyId: input.companyId ?? null,
            executorId: input.executorId,
            grantedById: request.user.sub,
          },
          select: SHARE_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.share_granted',
        resourceType: input.credentialId ? 'credential' : 'company',
        resourceId: input.credentialId ?? input.companyId ?? '',
        result: 'allowed',
        metadata: { executorId: input.executorId, shareId: share.id },
      })
      return reply.status(201).send({ success: true, data: { share } })
    }
  )

  // ── Revoke (soft — history stays) ─────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/vault/shares/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const share = await withTenant(async (tx) => {
        const row = await tx.credentialShare.findFirst({
          where: { id: request.params.id, agencyId, revokedAt: null },
          select: { id: true, credentialId: true, companyId: true, executorId: true },
        })
        if (!row) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Доступ не знайдено або вже відкликано', 404)
        }
        await tx.credentialShare.update({
          where: { id: row.id },
          data: { revokedAt: new Date() },
        })
        return row
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'credentials.share_revoked',
        resourceType: share.credentialId ? 'credential' : 'company',
        resourceId: share.credentialId ?? share.companyId ?? '',
        result: 'allowed',
        metadata: { executorId: share.executorId, shareId: share.id },
      })
      return reply.send({ success: true, data: { revoked: share.id } })
    }
  )

  return Promise.resolve()
}

export default vaultSharesRoute
