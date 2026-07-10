import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { agencyRole, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * TEAM-BOARDS (Фаза B, 10.07): команди агенції — таби глобальної дошки задач
 * (workspace-board.jsx). Читання — команда; зміни — owner. Видалення команди
 * НЕ губить людей/задачі (FK SetNull → «без команди», видно в табі «Усі»).
 */
const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6']

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .strict()
const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Порожній запит' })
const memberTeamSchema = z.object({ teamId: z.string().uuid().nullable() }).strict()

const TEAM_SELECT = {
  id: true,
  name: true,
  color: true,
  position: true,
  _count: { select: { members: true, tasks: true } },
  // TASK-COLUMNS: кастомні колонки дошки команди (kind = мапінг на канонічний статус)
  columns: {
    select: { id: true, name: true, kind: true, position: true },
    orderBy: { position: 'asc' as const },
  },
} as const

// Дефолтні колонки нової/порожньої команди — дзеркало 3 канонічних статусів.
const DEFAULT_COLUMNS = [
  { name: 'До роботи', kind: 'todo', position: 0 },
  { name: 'В роботі', kind: 'in_progress', position: 1 },
  { name: 'Готово', kind: 'done', position: 2 },
] as const

const columnCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    kind: z.enum(['todo', 'in_progress', 'done']),
  })
  .strict()
const columnUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    kind: z.enum(['todo', 'in_progress', 'done']).optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Порожній запит' })

const teamsRoute: FastifyPluginAsync = (fastify) => {
  function assertOwner(request: { user: Parameters<typeof requireActiveAgency>[0] }): string {
    const agencyId = requireActiveAgency(request.user)
    if (!isAgencyOwner(request.user, agencyId)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Команди редагує лише власник', 403)
    }
    return agencyId
  }

  // Колонки дошки налаштовує owner АБО manager (тімлід своєї дошки; дизайн canConfig=!exec)
  function assertBoardConfig(request: { user: Parameters<typeof requireActiveAgency>[0] }): string {
    const agencyId = requireActiveAgency(request.user)
    const role = agencyRole(request.user as Parameters<typeof agencyRole>[0], agencyId)
    if (role !== 'owner' && role !== 'manager') {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Дошку налаштовує власник або тімлід', 403)
    }
    return agencyId
  }

  // ── List (уся команда — таби дошки) ───────────────────────────────────────────
  fastify.get(
    '/workspace/teams',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      if (!isInternalTeam(request.user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const teams = await tenantTransaction(prisma, async (tx) => {
        // TASK-COLUMNS lazy-seed: команда без жодної колонки отримує 3 дефолтні (канонічні)
        const empty = await tx.team.findMany({
          where: { agencyId, columns: { none: {} } },
          select: { id: true },
        })
        if (empty.length > 0) {
          await tx.teamColumn.createMany({
            data: empty.flatMap((t) =>
              DEFAULT_COLUMNS.map((c) => ({
                agencyId,
                teamId: t.id,
                name: c.name,
                kind: c.kind,
                position: c.position,
              }))
            ),
          })
        }
        return tx.team.findMany({
          where: { agencyId },
          orderBy: { position: 'asc' },
          select: TEAM_SELECT,
        })
      })
      return reply.send({ success: true, data: { teams } })
    }
  )

  // ── Create (owner; колір — з палітри за позицією, якщо не заданий) ────────────
  fastify.post(
    '/workspace/teams',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const body = createSchema.parse(request.body)
      const team = await tenantTransaction(prisma, async (tx) => {
        const dup = await tx.team.findFirst({
          where: { agencyId, name: body.name },
          select: { id: true },
        })
        if (dup)
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Команда з такою назвою вже є', 400)
        const max = await tx.team.aggregate({ where: { agencyId }, _max: { position: true } })
        const position = (max._max.position ?? -1) + 1
        return tx.team.create({
          data: {
            agencyId,
            name: body.name,
            color: body.color ?? PALETTE[position % PALETTE.length],
            position,
          },
          select: TEAM_SELECT,
        })
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'team.created',
        resourceType: 'team',
        resourceId: team.id,
        result: 'allowed',
        metadata: { name: team.name },
      })
      return reply.status(201).send({ success: true, data: { team } })
    }
  )

  // ── Rename / recolor / reorder (owner) ────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/teams/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const body = updateSchema.parse(request.body)
      const team = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.team.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Команду не знайдено', 404)
        if (body.name) {
          const dup = await tx.team.findFirst({
            where: { agencyId, name: body.name, id: { not: existing.id } },
            select: { id: true },
          })
          if (dup)
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Команда з такою назвою вже є', 400)
        }
        return tx.team.update({
          where: { id: existing.id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.color !== undefined ? { color: body.color } : {}),
            ...(body.position !== undefined ? { position: body.position } : {}),
          },
          select: TEAM_SELECT,
        })
      })
      return reply.send({ success: true, data: { team } })
    }
  )

  // ── Delete (owner; члени/задачі стають «без команди» через FK SetNull) ────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/teams/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.team.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Команду не знайдено', 404)
        await tx.team.delete({ where: { id: existing.id } })
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'team.deleted',
        resourceType: 'team',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── TASK-COLUMNS: колонки дошки команди (owner/manager) ───────────────────────
  fastify.post<{ Params: { teamId: string } }>(
    '/workspace/teams/:teamId/columns',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertBoardConfig(request)
      const body = columnCreateSchema.parse(request.body)
      const column = await tenantTransaction(prisma, async (tx) => {
        const team = await tx.team.findFirst({
          where: { id: request.params.teamId, agencyId },
          select: { id: true },
        })
        if (!team) throw new AppError(ApiErrorCode.NOT_FOUND, 'Команду не знайдено', 404)
        const dup = await tx.teamColumn.findFirst({
          where: { teamId: team.id, name: body.name },
          select: { id: true },
        })
        if (dup)
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Колонка з такою назвою вже є', 400)
        const max = await tx.teamColumn.aggregate({
          where: { teamId: team.id },
          _max: { position: true },
        })
        return tx.teamColumn.create({
          data: {
            agencyId,
            teamId: team.id,
            name: body.name,
            kind: body.kind,
            position: (max._max.position ?? -1) + 1,
          },
          select: { id: true, name: true, kind: true, position: true },
        })
      })
      return reply.status(201).send({ success: true, data: { column } })
    }
  )

  fastify.patch<{ Params: { teamId: string; columnId: string } }>(
    '/workspace/teams/:teamId/columns/:columnId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertBoardConfig(request)
      const body = columnUpdateSchema.parse(request.body)
      const column = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.teamColumn.findFirst({
          where: { id: request.params.columnId, teamId: request.params.teamId, agencyId },
          select: { id: true, kind: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Колонку не знайдено', 404)
        const updated = await tx.teamColumn.update({
          where: { id: existing.id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.kind !== undefined ? { kind: body.kind } : {}),
            ...(body.position !== undefined ? { position: body.position } : {}),
          },
          select: { id: true, name: true, kind: true, position: true },
        })
        // МАПІНГ: зміна kind колонки пере-дзеркалює статуси її задач — головна дошка
        // («Усі», канонічні статуси) лишається консистентною автоматично.
        if (body.kind !== undefined && body.kind !== String(existing.kind)) {
          await tx.internalTask.updateMany({
            where: { columnId: existing.id },
            data: { status: body.kind },
          })
        }
        return updated
      })
      return reply.send({ success: true, data: { column } })
    }
  )

  fastify.delete<{ Params: { teamId: string; columnId: string } }>(
    '/workspace/teams/:teamId/columns/:columnId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertBoardConfig(request)
      await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.teamColumn.findFirst({
          where: { id: request.params.columnId, teamId: request.params.teamId, agencyId },
          select: { id: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Колонку не знайдено', 404)
        // Задачі колонки лишаються (FK SetNull) — рендеряться у fallback-колонці свого kind.
        await tx.teamColumn.delete({ where: { id: existing.id } })
      })
      return reply.send({ success: true, data: { id: request.params.columnId } })
    }
  )

  // ── Призначити члена агенції в команду (owner; null = прибрати) ───────────────
  fastify.patch<{ Params: { profileId: string } }>(
    '/workspace/executors/:profileId/team',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const { teamId } = memberTeamSchema.parse(request.body)
      await tenantTransaction(prisma, async (tx) => {
        const member = await tx.agencyMember.findFirst({
          where: { agencyId, profileId: request.params.profileId },
          select: { id: true },
        })
        if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Члена агенції не знайдено', 404)
        if (teamId) {
          const team = await tx.team.findFirst({
            where: { id: teamId, agencyId },
            select: { id: true },
          })
          if (!team) throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Команду не знайдено', 400)
        }
        await tx.agencyMember.update({ where: { id: member.id }, data: { teamId } })
      })
      return reply.send({ success: true, data: { profileId: request.params.profileId, teamId } })
    }
  )

  return Promise.resolve()
}

export default teamsRoute
