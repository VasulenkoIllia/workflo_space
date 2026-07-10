import { Prisma, prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { generateBlogDraft } from '../../services/blogAi.js'

/**
 * S7-05 МІНІ-CMS (рішення власника 10.07): керування блогом + кейсами з workspace
 * `/content`. BlogPost — platform-рівень (без agencyId; лендінг читає published через
 * публічний /content/blog) → редагує ЛИШЕ owner агенції (single-agency = власник
 * платформи), plain `prisma` без tenant-шва. Homepage-копірайт лишається в коді
 * (рішення 27.06); повний landing-CMS = S14 (не зараз).
 *
 * Контент — масив блоків `{t, v}` рівно в shape, який рендерить лендінг
 * (`blog/[slug]/page.tsx`): h2 · p · ul · code · callout · quote.
 */
const blockSchema = z
  .object({
    t: z.enum(['h2', 'p', 'ul', 'code', 'callout', 'quote']),
    v: z.union([z.string().max(20_000), z.array(z.string().max(2_000)).max(50)]),
    k: z.string().max(100).optional(),
    author: z.string().max(200).optional(),
    lang: z.string().max(40).optional(),
  })
  .strict()

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const createSchema = z
  .object({
    slug: z.string().min(3).max(120).regex(SLUG_RE, 'kebab-case: лише a-z, 0-9 і дефіси'),
    type: z.enum(['article', 'case_study']),
    titleUk: z.string().trim().min(3).max(200),
    titleEn: z.string().trim().min(3).max(200),
    excerptUk: z.string().trim().min(3).max(500),
    excerptEn: z.string().trim().min(3).max(500),
    contentUk: z.array(blockSchema).min(1).max(200),
    contentEn: z.array(blockSchema).min(1).max(200),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    featured: z.boolean().default(false),
  })
  .strict()

const updateSchema = createSchema.partial().refine((d) => Object.keys(d).length > 0, {
  message: 'Порожній запит',
})

const publishSchema = z.object({ published: z.boolean() }).strict()

const generateSchema = z
  .object({
    topic: z.string().trim().min(5).max(500),
    type: z.enum(['article', 'case_study']).default('article'),
  })
  .strict()

const LIST_SELECT = {
  id: true,
  slug: true,
  type: true,
  titleUk: true,
  tags: true,
  published: true,
  featured: true,
  publishedAt: true,
  updatedAt: true,
} as const

const FULL_SELECT = {
  ...LIST_SELECT,
  titleEn: true,
  excerptUk: true,
  excerptEn: true,
  contentUk: true,
  contentEn: true,
} as const

const cmsRoutes: FastifyPluginAsync = (fastify) => {
  function assertOwner(request: { user: Parameters<typeof requireActiveAgency>[0] }): void {
    const agencyId = requireActiveAgency(request.user)
    if (!isAgencyOwner(request.user, agencyId)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Контент редагує лише власник', 403)
    }
  }

  // ── List (усі, включно з чернетками) ─────────────────────────────────────────
  fastify.get(
    '/workspace/content/posts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const posts = await prisma.blogPost.findMany({
        orderBy: [{ published: 'asc' }, { updatedAt: 'desc' }],
        select: LIST_SELECT,
      })
      return reply.send({ success: true, data: { posts } })
    }
  )

  // ── Full read (обидві мови — для редактора) ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/content/posts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const post = await prisma.blogPost.findUnique({
        where: { id: request.params.id },
        select: FULL_SELECT,
      })
      if (!post) throw new AppError(ApiErrorCode.NOT_FOUND, 'Пост не знайдено', 404)
      return reply.send({ success: true, data: { post } })
    }
  )

  // ── Create (чернетка; publish окремо) ─────────────────────────────────────────
  fastify.post(
    '/workspace/content/posts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const body = createSchema.parse(request.body)
      try {
        const post = await prisma.blogPost.create({
          data: {
            slug: body.slug,
            type: body.type,
            titleUk: body.titleUk,
            titleEn: body.titleEn,
            excerptUk: body.excerptUk,
            excerptEn: body.excerptEn,
            contentUk: body.contentUk,
            contentEn: body.contentEn,
            tags: body.tags,
            featured: body.featured,
            published: false,
            authorId: request.user.sub,
          },
          select: FULL_SELECT,
        })
        writeAuditAsync(request.log, {
          actorId: request.user.sub,
          agencyId: requireActiveAgency(request.user),
          action: 'content.post_created',
          resourceType: 'blog_post',
          resourceId: post.id,
          result: 'allowed',
          metadata: { slug: post.slug, type: post.type },
        })
        return reply.status(201).send({ success: true, data: { post } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new AppError(ApiErrorCode.CONFLICT, 'Slug уже зайнятий', 409)
        }
        throw e
      }
    }
  )

  // ── Update ────────────────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/content/posts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const body = updateSchema.parse(request.body)
      try {
        const post = await prisma.blogPost.update({
          where: { id: request.params.id },
          data: body,
          select: FULL_SELECT,
        })
        return reply.send({ success: true, data: { post } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Пост не знайдено', 404)
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new AppError(ApiErrorCode.CONFLICT, 'Slug уже зайнятий', 409)
        }
        throw e
      }
    }
  )

  // ── Publish / unpublish (publishedAt штампуємо ОДИН раз — стабільна дата) ─────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/content/posts/:id/publish',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      const { published } = publishSchema.parse(request.body)
      const existing = await prisma.blogPost.findUnique({
        where: { id: request.params.id },
        select: { id: true, publishedAt: true },
      })
      if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Пост не знайдено', 404)
      const post = await prisma.blogPost.update({
        where: { id: existing.id },
        data: {
          published,
          ...(published && !existing.publishedAt ? { publishedAt: new Date() } : {}),
        },
        select: LIST_SELECT,
      })
      return reply.send({ success: true, data: { post } })
    }
  )

  // ── Delete ────────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/content/posts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      assertOwner(request)
      try {
        await prisma.blogPost.delete({ where: { id: request.params.id } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Пост не знайдено', 404)
        }
        throw e
      }
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId: requireActiveAgency(request.user),
        action: 'content.post_deleted',
        resourceType: 'blog_post',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  // ── AI-чернетка (S7-05 «+AI-генерація») ───────────────────────────────────────
  fastify.post(
    '/workspace/content/generate',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      assertOwner(request)
      const body = generateSchema.parse(request.body)
      const draft = await generateBlogDraft(body.topic, body.type)
      return reply.send({ success: true, data: { draft } })
    }
  )

  return Promise.resolve()
}

export default cmsRoutes
