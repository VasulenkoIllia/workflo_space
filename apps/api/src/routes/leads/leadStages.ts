import { type Prisma, prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * ХВІСТ-4 (07.07): кастомні стадії воронки лідів per-agency. Читання — команда; зміни —
 * owner. open-стадії редагуються/додаються/видаляються; won/lost — термінальні (по одній,
 * захищені). Дошка сортує (open→won→lost, потім position). Lazy-seed дефолтів, якщо порожньо.
 */
const DEFAULT_STAGES = [
  { name: 'Новий', kind: 'open', position: 0 },
  { name: 'Сконтактовано', kind: 'open', position: 1 },
  { name: 'Кваліфіковано', kind: 'open', position: 2 },
  { name: 'Пропозиція', kind: 'open', position: 3 },
  { name: 'Виграно', kind: 'won', position: 4 },
  { name: 'Втрачено', kind: 'lost', position: 5 },
] as const

const STAGE_SELECT = { id: true, name: true, kind: true, position: true } as const
const KIND_RANK: Record<string, number> = { open: 0, won: 1, lost: 2 }

export async function ensureStages(tx: Prisma.TransactionClient, agencyId: string): Promise<void> {
  const count = await tx.leadStage.count({ where: { agencyId } })
  if (count === 0) {
    await tx.leadStage.createMany({
      data: DEFAULT_STAGES.map((s) => ({
        agencyId,
        name: s.name,
        kind: s.kind,
        position: s.position,
      })),
    })
  }
}

function sortStages<T extends { kind: string; position: number }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => (KIND_RANK[a.kind] ?? 0) - (KIND_RANK[b.kind] ?? 0) || a.position - b.position
  )
}

const createStageSchema = z.object({ name: z.string().trim().min(1).max(40) }).strict()
const updateStageSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати назву або позицію' })

const leadStagesRoute: FastifyPluginAsync = (fastify) => {
  // ── List (team; lazy-seed defaults) ───────────────────────────────────────────
  fastify.get(
    '/workspace/lead-stages',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isInternalTeam(request.user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const stages = await tenantTransaction(prisma, async (tx) => {
        await ensureStages(tx, agencyId)
        return tx.leadStage.findMany({ where: { agencyId }, select: STAGE_SELECT })
      })
      return reply.send({ success: true, data: { stages: sortStages(stages) } })
    }
  )

  // ── Create open stage (owner) ─────────────────────────────────────────────────
  fastify.post(
    '/workspace/lead-stages',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isAgencyOwner(request.user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Стадії редагує лише власник', 403)
      }
      const body = createStageSchema.parse(request.body)
      const stage = await tenantTransaction(prisma, async (tx) => {
        await ensureStages(tx, agencyId)
        const dup = await tx.leadStage.findFirst({
          where: { agencyId, name: body.name },
          select: { id: true },
        })
        if (dup)
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Стадія з такою назвою вже є', 400)
        const maxOpen = await tx.leadStage.aggregate({
          where: { agencyId, kind: 'open' },
          _max: { position: true },
        })
        return tx.leadStage.create({
          data: {
            agencyId,
            name: body.name,
            kind: 'open',
            position: (maxOpen._max.position ?? -1) + 1,
          },
          select: STAGE_SELECT,
        })
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'lead_stage.created',
        resourceType: 'lead_stage',
        resourceId: stage.id,
        result: 'allowed',
        metadata: { name: stage.name },
      })
      return reply.status(201).send({ success: true, data: { stage } })
    }
  )

  // ── Rename / reorder (owner) ──────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/lead-stages/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isAgencyOwner(request.user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Стадії редагує лише власник', 403)
      }
      const body = updateStageSchema.parse(request.body)
      const stage = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.leadStage.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Стадію не знайдено', 404)
        if (body.name) {
          const dup = await tx.leadStage.findFirst({
            where: { agencyId, name: body.name, id: { not: existing.id } },
            select: { id: true },
          })
          if (dup)
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Стадія з такою назвою вже є', 400)
        }
        return tx.leadStage.update({
          where: { id: existing.id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.position !== undefined ? { position: body.position } : {}),
          },
          select: STAGE_SELECT,
        })
      })
      return reply.send({ success: true, data: { stage } })
    }
  )

  // ── Delete open stage (owner; won/lost protected; reassign leads) ─────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/lead-stages/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isAgencyOwner(request.user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Стадії редагує лише власник', 403)
      }
      await tenantTransaction(prisma, async (tx) => {
        const stage = await tx.leadStage.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, kind: true },
        })
        if (!stage) throw new AppError(ApiErrorCode.NOT_FOUND, 'Стадію не знайдено', 404)
        if (stage.kind !== 'open') {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Термінальні стадії (виграно/втрачено) не видаляються',
            400
          )
        }
        // Ліди зі стадії переносимо на першу відкриту, що лишається (не втрачаємо їх).
        const fallback = await tx.leadStage.findFirst({
          where: { agencyId, kind: 'open', id: { not: stage.id } },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        if (!fallback) {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Має лишитись хоча б одна відкрита стадія',
            400
          )
        }
        await tx.lead.updateMany({
          where: { agencyId, stageId: stage.id },
          data: { stageId: fallback.id },
        })
        await tx.leadStage.delete({ where: { id: stage.id } })
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'lead_stage.deleted',
        resourceType: 'lead_stage',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  return Promise.resolve()
}

export default leadStagesRoute
