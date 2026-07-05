import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../auth/tokens.js'

/**
 * S11-01 (модуль 16): глобальний пошук workspace — Postgres FTS (конфіг 'simple',
 * expression-GIN індекси з міграції 20260705_fts_indexes; запити використовують ті САМІ
 * вирази, щоб індекс підхоплювався). Скоуп по ролях повторює доступ екранів:
 * замовлення — вся команда · клієнти/ліди — owner+manager · проєкти — owner+executor.
 * Останнє слово матчиться префіксно (`:*`) — «лен» знаходить «лендінг».
 */
const querySchema = z.object({ q: z.string().trim().min(2).max(120) })

/** Побудова tsquery: слова → екрановані лексеми AND-ом, останнє — з префіксом.
 * null = у запиті не лишилось лексем (самі розділювачі). */
export function buildTsQuery(raw: string): string | null {
  const words = raw
    .split(/[\s,;:!?()[\]{}"'`|&<>@#%^*+=~/\\-]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 8)
  if (words.length === 0) return null
  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(' & ')
}

const LIMIT = 5

const searchRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/search',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const { q } = querySchema.parse(request.query)
      const ts = buildTsQuery(q)
      if (!ts)
        return reply.send({
          success: true,
          data: { orders: [], companies: [], leads: [], projects: [] },
        })

      const owner = isAgencyOwner(user, agencyId)
      const manager = isAgencyManager(user, agencyId)
      const canClients = owner || manager
      const canProjects = owner || (!manager && isInternalTeam(user)) // internal-non-manager

      const data = await withTenant(async (tx) => {
        const orders = await tx.$queryRaw<
          { id: string; title: string; internalStatus: string }[]
        >(Prisma.sql`
          SELECT id, title, "internalStatus"
          FROM orders
          WHERE "agencyId" = ${agencyId} AND "deletedAt" IS NULL
            AND to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", ''))
                @@ to_tsquery('simple', ${ts})
          ORDER BY "createdAt" DESC
          LIMIT ${LIMIT}
        `)

        const companies = canClients
          ? await tx.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
              SELECT id, name FROM companies
              WHERE "agencyId" = ${agencyId}
                AND to_tsvector('simple', coalesce("name", '')) @@ to_tsquery('simple', ${ts})
              ORDER BY name ASC
              LIMIT ${LIMIT}
            `)
          : []

        const leads = canClients
          ? await tx.$queryRaw<{ id: string; name: string; status: string }[]>(Prisma.sql`
              SELECT id, name, status FROM leads
              WHERE "agencyId" = ${agencyId}
                AND to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("contactName", '') || ' ' || coalesce("email", ''))
                    @@ to_tsquery('simple', ${ts})
              ORDER BY "createdAt" DESC
              LIMIT ${LIMIT}
            `)
          : []

        const projects = canProjects
          ? await tx.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
              SELECT id, name FROM projects
              WHERE "agencyId" = ${agencyId}
                AND to_tsvector('simple', coalesce("name", '')) @@ to_tsquery('simple', ${ts})
              ORDER BY name ASC
              LIMIT ${LIMIT}
            `)
          : []

        return { orders, companies, leads, projects }
      })

      return reply.send({ success: true, data })
    }
  )

  return Promise.resolve()
}

export default searchRoute
