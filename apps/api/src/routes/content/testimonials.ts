import { Prisma, prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * TESTIMONIALS (Фаза B, 11.07): відгуки клієнтів для лендінга. Platform-рівень (без
 * agencyId, як BlogPost) → owner керує з /content (таб «Відгуки»), лендінг читає
 * published через публічний GET (CORS-allowlist уже покриває content-роути).
 */
const createSchema = z
  .object({
    authorName: z.string().trim().min(2).max(120),
    authorRole: z.string().trim().max(120).nullable().optional(),
    company: z.string().trim().max(120).nullable().optional(),
    text: z.string().trim().min(10).max(1000),
    rating: z.number().int().min(1).max(5).default(5),
    featured: z.boolean().default(false),
  })
  .strict()

const updateSchema = createSchema
  .extend({ published: z.boolean(), position: z.number().int().min(0).max(10_000) })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Порожній запит' })

const SELECT = {
  id: true,
  authorName: true,
  authorRole: true,
  company: true,
  text: true,
  rating: true,
  featured: true,
  published: true,
  position: true,
  updatedAt: true,
} as const

const testimonialsRoute: FastifyPluginAsync = (fastify) => {
  function assertOwner(request: { user: Parameters<typeof requireActiveAgency>[0] }): string {
    const agencyId = requireActiveAgency(request.user)
    if (!isAgencyOwner(request.user, agencyId)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Відгуки редагує лише власник', 403)
    }
    return agencyId
  }

  // ── Публічний read для лендінга: лише published, featured перші ────────────────
  fastify.get('/content/testimonials', async (_request, reply) => {
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { position: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        company: true,
        text: true,
        rating: true,
        featured: true,
      },
    })
    return reply.send({ success: true, data: { testimonials: rows } })
  })

  // ── Workspace: список з чернетками (owner-редактор) ────────────────────────────
  fastify.get(
    '/workspace/content/testimonials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const testimonials = await prisma.testimonial.findMany({
        orderBy: [{ published: 'asc' }, { featured: 'desc' }, { position: 'asc' }],
        select: SELECT,
      })
      return reply.send({ success: true, data: { testimonials } })
    }
  )

  // ── Create (чернетка) ───────────────────────────────────────────────────────────
  fastify.post(
    '/workspace/content/testimonials',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      const body = createSchema.parse(request.body)
      const testimonial = await prisma.testimonial.create({
        data: {
          authorName: body.authorName,
          authorRole: body.authorRole ?? null,
          company: body.company ?? null,
          text: body.text,
          rating: body.rating,
          featured: body.featured,
          published: false,
        },
        select: SELECT,
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'content.testimonial_created',
        resourceType: 'testimonial',
        resourceId: testimonial.id,
        result: 'allowed',
        metadata: { authorName: testimonial.authorName },
      })
      return reply.status(201).send({ success: true, data: { testimonial } })
    }
  )

  // ── Update (вкл. publish/unpublish, featured, position) ────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/content/testimonials/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const body = updateSchema.parse(request.body)
      try {
        const testimonial = await prisma.testimonial.update({
          where: { id: request.params.id },
          data: body,
          select: SELECT,
        })
        return reply.send({ success: true, data: { testimonial } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Відгук не знайдено', 404)
        }
        throw e
      }
    }
  )

  // ── Delete ──────────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/content/testimonials/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request)
      try {
        await prisma.testimonial.delete({ where: { id: request.params.id } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Відгук не знайдено', 404)
        }
        throw e
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'content.testimonial_deleted',
        resourceType: 'testimonial',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  return Promise.resolve()
}

export default testimonialsRoute
