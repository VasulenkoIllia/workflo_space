import { type Prisma, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  createLegalEntitySchema,
  legalEntityIsComplete,
  updateLegalEntitySchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { type AccessClaims, isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { moduleEnabled } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * Agency legal entities (20-Д, S5.6 P-1б). Workspace-admin CRUD over the entities
 * an agency issues documents from. Tenant-scoped; gated by `moduleEnabled('legal_entity')`
 * (MOD-2 discipline). `isComplete` (Юр-2 document-gate) is recomputed on every write.
 */

const ENTITY_SELECT = {
  id: true,
  name: true,
  legalType: true,
  legalName: true,
  taxId: true,
  vatPayer: true,
  vatId: true,
  legalAddress: true,
  bankName: true,
  iban: true,
  signerName: true,
  signerTitle: true,
  stampUrl: true,
  isDefault: true,
  isComplete: true,
  active: true,
  createdAt: true,
} satisfies Prisma.LegalEntitySelect

type EntityRow = Prisma.LegalEntityGetPayload<{ select: typeof ENTITY_SELECT }>

function toDto(e: EntityRow) {
  return { ...e, createdAt: e.createdAt.toISOString() }
}

/** Workspace-only: internal team (NOT manager — legal/IBAN = settings, 20-А) manages
 *  the agency's legal entities. */
function assertInternal(user: Pick<AccessClaims, 'agencyMemberships'>, agencyId: string): void {
  if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
  }
}

/** MOD-2 gate — module must be enabled for the tenant (Phase 0: always on). */
async function assertModule(agencyId: string): Promise<void> {
  if (!(await moduleEnabled(agencyId, 'legal_entity'))) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Модуль юр-осіб вимкнено', 403)
  }
}

const legalEntitiesRoute: FastifyPluginAsync = (fastify) => {
  // ── List ────────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/legal-entities',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user, agencyId)
      await assertModule(agencyId)
      const rows = await withTenant((tx) =>
        tx.legalEntity.findMany({
          where: { agencyId },
          select: ENTITY_SELECT,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        })
      )
      return reply.send({ success: true, data: { legalEntities: rows.map(toDto) } })
    }
  )

  // ── Create ──────────────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/legal-entities',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createLegalEntitySchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user, agencyId)
      await assertModule(agencyId)

      const entity = await withTenant((tx) =>
        tx.legalEntity.create({
          data: {
            agencyId,
            name: input.name,
            legalType: input.legalType,
            legalName: input.legalName,
            taxId: input.taxId ?? null,
            vatPayer: input.vatPayer,
            vatId: input.vatId ?? null,
            legalAddress: input.legalAddress ?? null,
            bankName: input.bankName ?? null,
            iban: input.iban ?? null,
            signerName: input.signerName ?? null,
            signerTitle: input.signerTitle ?? null,
            stampUrl: input.stampUrl ?? null,
            isComplete: legalEntityIsComplete(input),
          },
          select: ENTITY_SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'legal_entity.created',
        resourceType: 'legal_entity',
        resourceId: entity.id,
        result: 'allowed',
        metadata: { name: input.name, isComplete: entity.isComplete },
      })
      return reply.status(201).send({ success: true, data: { legalEntity: toDto(entity) } })
    }
  )

  // ── Update ──────────────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/legal-entities/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateLegalEntitySchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user, agencyId)
      await assertModule(agencyId)

      const entity = await withTenant(async (tx) => {
        const existing = await tx.legalEntity.findUnique({
          where: { id: request.params.id },
          select: { ...ENTITY_SELECT, agencyId: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Юр-особу не знайдено', 404)
        }
        // Recompute the document-gate from the post-update field set (Юр-2).
        const merged = {
          legalName: input.legalName ?? existing.legalName,
          taxId: input.taxId !== undefined ? input.taxId : existing.taxId,
          iban: input.iban !== undefined ? input.iban : existing.iban,
          signerName: input.signerName !== undefined ? input.signerName : existing.signerName,
        }
        return tx.legalEntity.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.legalType !== undefined ? { legalType: input.legalType } : {}),
            ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
            ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
            ...(input.vatPayer !== undefined ? { vatPayer: input.vatPayer } : {}),
            ...(input.vatId !== undefined ? { vatId: input.vatId } : {}),
            ...(input.legalAddress !== undefined ? { legalAddress: input.legalAddress } : {}),
            ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
            ...(input.iban !== undefined ? { iban: input.iban } : {}),
            ...(input.signerName !== undefined ? { signerName: input.signerName } : {}),
            ...(input.signerTitle !== undefined ? { signerTitle: input.signerTitle } : {}),
            ...(input.stampUrl !== undefined ? { stampUrl: input.stampUrl } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            isComplete: legalEntityIsComplete(merged),
          },
          select: ENTITY_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'legal_entity.updated',
        resourceType: 'legal_entity',
        resourceId: entity.id,
        result: 'allowed',
        metadata: { fields: Object.keys(input), isComplete: entity.isComplete },
      })
      return reply.send({ success: true, data: { legalEntity: toDto(entity) } })
    }
  )

  // ── Set default (Юр-3) ────────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/legal-entities/:id/default',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user, agencyId)
      await assertModule(agencyId)

      const entity = await withTenant(async (tx) => {
        const existing = await tx.legalEntity.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, active: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Юр-особу не знайдено', 404)
        }
        if (!existing.active) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Не можна зробити дефолтною неактивну юр-особу',
            409
          )
        }
        // Exactly one default per agency: clear the rest, set this one.
        await tx.legalEntity.updateMany({
          where: { agencyId, isDefault: true, id: { not: existing.id } },
          data: { isDefault: false },
        })
        return tx.legalEntity.update({
          where: { id: existing.id },
          data: { isDefault: true },
          select: ENTITY_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'legal_entity.set_default',
        resourceType: 'legal_entity',
        resourceId: entity.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { legalEntity: toDto(entity) } })
    }
  )

  // ── Delete ────────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/legal-entities/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      assertInternal(user, agencyId)
      await assertModule(agencyId)

      await withTenant(async (tx) => {
        const existing = await tx.legalEntity.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, isDefault: true },
        })
        if (!existing || existing.agencyId !== agencyId) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Юр-особу не знайдено', 404)
        }
        // The default entity anchors the project→agency cascade (Юр-3) — make
        // another default before removing it.
        if (existing.isDefault) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Не можна видалити дефолтну юр-особу — спершу призначте іншу дефолтною',
            409
          )
        }
        // Refuse to orphan issued documents (FK would null them out).
        const docs = await tx.document.count({ where: { legalEntityId: existing.id } })
        if (docs > 0) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Не можна видалити юр-особу з виставленими документами',
            409
          )
        }
        await tx.legalEntity.delete({ where: { id: existing.id } })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'legal_entity.deleted',
        resourceType: 'legal_entity',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { deleted: true } })
    }
  )

  return Promise.resolve()
}

export default legalEntitiesRoute
