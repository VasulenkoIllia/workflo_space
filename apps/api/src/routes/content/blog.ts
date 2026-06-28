import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'

/** Public blog read API (S7-02). No auth — the landing reads published posts cross-origin
 * (CORS allowlist covers it). BlogPost is platform-level (no agencyId), plain `prisma`.
 * Editing/AI-generation is the deferred CMS (S7-05); this is read-only. UA copy for now. */

type Block = { t: string; v: string | string[]; k?: string; author?: string; lang?: string }

/** Rough reading-time from block text (≈200 wpm). */
function readingMinutes(content: unknown): number {
  const blocks = Array.isArray(content) ? (content as Block[]) : []
  let words = 0
  for (const b of blocks) {
    const text = Array.isArray(b.v) ? b.v.join(' ') : typeof b.v === 'string' ? b.v : ''
    words += text.split(/\s+/).filter(Boolean).length
  }
  return Math.max(1, Math.round(words / 200))
}

const blogRoutes: FastifyPluginAsync = (fastify) => {
  // List — published only, featured first then newest.
  fastify.get('/content/blog', async (_request, reply) => {
    const rows = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      select: {
        slug: true,
        type: true,
        titleUk: true,
        excerptUk: true,
        tags: true,
        featured: true,
        publishedAt: true,
        contentUk: true,
      },
    })
    const posts = rows.map((p) => ({
      slug: p.slug,
      type: p.type,
      title: p.titleUk,
      excerpt: p.excerptUk,
      tags: p.tags,
      featured: p.featured,
      date: p.publishedAt?.toISOString() ?? null,
      reading: `${readingMinutes(p.contentUk)} хв`,
    }))
    const tags = ['усі', ...Array.from(new Set(posts.flatMap((p) => p.tags)))]
    return reply.send({ success: true, data: { posts, tags } })
  })

  // Detail — single published post by slug.
  fastify.get<{ Params: { slug: string } }>('/content/blog/:slug', async (request, reply) => {
    const post = await prisma.blogPost.findFirst({
      where: { slug: request.params.slug, published: true },
      select: {
        slug: true,
        type: true,
        titleUk: true,
        excerptUk: true,
        tags: true,
        publishedAt: true,
        contentUk: true,
      },
    })
    if (!post) {
      return reply.status(404).send({ success: false, error: { message: 'not_found' } })
    }
    return reply.send({
      success: true,
      data: {
        slug: post.slug,
        type: post.type,
        title: post.titleUk,
        excerpt: post.excerptUk,
        tags: post.tags,
        date: post.publishedAt?.toISOString() ?? null,
        reading: `${readingMinutes(post.contentUk)} хв`,
        body: post.contentUk,
      },
    })
  })

  return Promise.resolve()
}

export default blogRoutes
