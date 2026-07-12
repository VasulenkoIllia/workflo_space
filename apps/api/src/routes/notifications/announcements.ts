import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency, requireOwnerAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * ANNOUNCEMENTS (07-В, Фаза B, 11.07): оголошення агенції. Owner створює/публікує/архівує;
 * активні (published && !archived) показуються sticky-банером у workspace (audience
 * team/all) та порталі (clients/all). ✕ банера = read-receipt (unique per profile) —
 * банер зникає для цього юзера; owner-адмінка бачить % прочитань по цільовій аудиторії.
 */
const createSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(3).max(2000),
    audience: z.enum(['team', 'clients', 'all']).default('all'),
  })
  .strict()

const updateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    body: z.string().trim().min(3).max(2000).optional(),
    audience: z.enum(['team', 'clients', 'all']).optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Порожній запит' })

const SELECT = {
  id: true,
  title: true,
  body: true,
  audience: true,
  published: true,
  archivedAt: true,
  createdAt: true,
  _count: { select: { reads: true } },
} as const

/** Розмір цільової аудиторії — знаменник % прочитань. */
async function audienceCounts(agencyId: string): Promise<{ team: number; clients: number }> {
  return withTenant(async (tx) => {
    const [team, clientRows] = await Promise.all([
      tx.agencyMember.count({ where: { agencyId } }),
      // клієнти агенції = distinct-профілі учасників її компаній
      tx.companyMember.findMany({
        where: { company: { is: { agencyId } } },
        select: { profileId: true },
        distinct: ['profileId'],
      }),
    ])
    return { team, clients: clientRows.length }
  })
}

const announcementsRoute: FastifyPluginAsync = (fastify) => {
  function assertOwner(request: { user: Parameters<typeof requireOwnerAgency>[0] }): string {
    return requireOwnerAgency(request.user, 'Оголошення керує лише власник')
  }

  // ── Owner-адмінка: список з % прочитань ────────────────────────────────────────
  fastify.get(
    '/workspace/announcements',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const [rows, counts] = await Promise.all([
        withTenant((tx) =>
          tx.announcement.findMany({
            where: { agencyId },
            orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
            select: SELECT,
          })
        ),
        audienceCounts(agencyId),
      ])
      const announcements = rows.map((a) => {
        const target =
          a.audience === 'team'
            ? counts.team
            : a.audience === 'clients'
              ? counts.clients
              : counts.team + counts.clients
        return {
          ...a,
          readCount: a._count.reads,
          targetCount: target,
          readPct: target > 0 ? Math.round((a._count.reads / target) * 100) : null,
        }
      })
      return reply.send({ success: true, data: { announcements } })
    }
  )

  // ── Create (чернетка) ────────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/announcements',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const body = createSchema.parse(request.body)
      const announcement = await withTenant((tx) =>
        tx.announcement.create({
          data: { agencyId, title: body.title, body: body.body, audience: body.audience },
          select: SELECT,
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'announcement.created',
        resourceType: 'announcement',
        resourceId: announcement.id,
        result: 'allowed',
        metadata: { title: announcement.title, audience: announcement.audience },
      })
      return reply.status(201).send({ success: true, data: { announcement } })
    }
  )

  // ── Update / publish / archive ───────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/announcements/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const body = updateSchema.parse(request.body)
      const announcement = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.announcement.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true, archivedAt: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Оголошення не знайдено', 404)
        return tx.announcement.update({
          where: { id: existing.id },
          data: {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.body !== undefined ? { body: body.body } : {}),
            ...(body.audience !== undefined ? { audience: body.audience } : {}),
            ...(body.published !== undefined ? { published: body.published } : {}),
            // archived=true штампує час один раз; false — знімає з архіву
            ...(body.archived !== undefined
              ? { archivedAt: body.archived ? (existing.archivedAt ?? new Date()) : null }
              : {}),
          },
          select: SELECT,
        })
      })
      return reply.send({ success: true, data: { announcement } })
    }
  )

  // ── Delete ───────────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/announcements/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.announcement.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Оголошення не знайдено', 404)
        await tx.announcement.delete({ where: { id: existing.id } })
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── Активний банер для МЕНЕ (обидві апки): моя аудиторія, ще не прочитане ────────
  fastify.get(
    '/announcements/active',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const audiences: Array<'team' | 'clients' | 'all'> = isInternalTeam(user)
        ? ['team', 'all']
        : ['clients', 'all']
      const rows = await withTenant((tx) =>
        tx.announcement.findMany({
          where: {
            agencyId,
            published: true,
            archivedAt: null,
            audience: { in: audiences },
            reads: { none: { profileId: user.sub } },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, title: true, body: true, createdAt: true },
        })
      )
      return reply.send({ success: true, data: { announcements: rows } })
    }
  )

  // ── Read-receipt (✕ банера) — ідемпотентний ─────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/announcements/:id/read',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      await tenantTransaction(prisma, async (tx) => {
        const a = await tx.announcement.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!a) throw new AppError(ApiErrorCode.NOT_FOUND, 'Оголошення не знайдено', 404)
        await tx.announcementRead.upsert({
          where: {
            announcementId_profileId: { announcementId: a.id, profileId: user.sub },
          },
          update: {},
          create: { agencyId, announcementId: a.id, profileId: user.sub },
        })
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  return Promise.resolve()
}

export default announcementsRoute
